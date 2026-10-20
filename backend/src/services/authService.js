'use strict';

// Authentication and recovery business rules. SRS FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, 6.2.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { withTransaction } = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { encrypt } = require('../utils/crypto');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/otp');
const { signAccessToken } = require('../utils/tokens');
const { detectContactType, normalizeEmail, normalizePhone } = require('../utils/contact');
const userRepository = require('../repositories/userRepository');
const identityRepository = require('../repositories/identityRepository');
const challengeRepository = require('../repositories/challengeRepository');
const profileRepository = require('../repositories/profileRepository');
const otpSender = require('./otpSender');

// Fixed dummy hash for constant-time comparisons when account does not exist
const DUMMY_BCRYPT_HASH = '$2b$12$e8pB7.BvX4uM5ZfO3uGvXeO3hY5yX7w7t9z1y3x5w7v9u1t3s5r7q';

/**
 * Registers a new youth user account.
 * SRS FR-1.1, FR-1.3, FR-1.4, FR-1.5.
 *
 * @param {object} input
 * @returns {Promise<{ token: string, user: object }>}
 */
async function register(input) {
  const userId = crypto.randomUUID();
  const channel = input.email ? 'email' : 'phone';
  const destination = input.email || input.phone;

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);

  // Encrypt real names at rest (SRS 5.4 Decision C)
  const encryptedFirstName = encrypt(input.firstName);
  const encryptedLastName = encrypt(input.lastName);

  // Generate 6-digit OTP and HMAC
  const otpCode = generateOtp();
  const tokenHash = hashOtp(otpCode, env.otpPepper);
  const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);

  try {
    await withTransaction(async (client) => {
      // 1. Create user account
      await userRepository.createUser(
        { id: userId, role: 'youth', status: 'active', passwordHash },
        client
      );

      // 2. Create encrypted verified identity
      await identityRepository.createVerifiedIdentity(
        {
          userId,
          firstName: encryptedFirstName,
          lastName: encryptedLastName,
          email: input.email || null,
          phone: input.phone || null,
          termsAcceptedAt: new Date(),
          disclaimerAcceptedAt: new Date(),
          consentVersion: input.consentVersion,
        },
        client
      );

      // 3. Create profile
      await profileRepository.createProfile(
        { userId, alias: input.handle },
        client
      );

      // 4. Create user settings defaults
      await userRepository.createUserSettings(userId, client);

      // 5. Create user stats row (zeros, migration 012)
      await userRepository.createUserStats(userId, client);

      // 6. Create verification challenge
      await challengeRepository.createChallenge(
        {
          userId,
          channel,
          purpose: 'signup',
          tokenHash,
          expiresAt,
        },
        client
      );
    });
  } catch (error) {
    if (error.code === '23505') {
      const constraint = error.constraint || error.message || '';
      if (constraint.includes('profiles_alias_lower_uq')) {
        throw new AppError(409, 'HANDLE_TAKEN', 'That handle is already taken. Please choose another.');
      }
      if (
        constraint.includes('verified_identities_email_lower_uq') ||
        constraint.includes('verified_identities_phone_uq')
      ) {
        throw new AppError(409, 'ACCOUNT_EXISTS', 'An account already exists for this contact information.');
      }
    }
    throw error;
  }

  // After COMMIT: dispatch OTP
  await otpSender.sendOtp({
    channel,
    destination,
    code: otpCode,
    purpose: 'signup',
  });

  const token = signAccessToken({ id: userId, role: 'youth' });

  return {
    token,
    user: {
      id: userId,
      handle: input.handle,
      role: 'youth',
      verified: false,
    },
  };
}

/**
 * Verifies a signup challenge with 6-digit OTP.
 * SRS FR-1.2.
 *
 * @param {string} userId
 * @param {string} code
 * @returns {Promise<{ verified: boolean }>}
 */
async function verify(userId, code) {
  const challenge = await challengeRepository.findLatestUnconsumedSignupChallenge(userId);
  if (!challenge) {
    throw new AppError(400, 'INVALID_CODE', 'Verification code is invalid or has expired.');
  }

  // Increment attempts BEFORE comparing (SRS FR-1.2)
  // Must persist across failed attempts so lockout cannot be bypassed
  const attempts = await challengeRepository.incrementAttempts(challenge.id);

  const matches = verifyOtp(code, challenge.token_hash, env.otpPepper);

  if (attempts >= env.otpMaxAttempts) {
    // Consume challenge immediately upon reaching max attempts
    await challengeRepository.consumeChallenge(challenge.id);
    if (!matches) {
      throw new AppError(
        400,
        'CODE_EXHAUSTED',
        'Too many invalid attempts. This verification code has been deactivated. Please request a new code.'
      );
    }
  }

  if (!matches) {
    throw new AppError(400, 'INVALID_CODE', 'Verification code is invalid or has expired.');
  }

  // Successfully verified: atomically consume challenge and mark contact verified
  return withTransaction(async (client) => {
    await challengeRepository.consumeChallenge(challenge.id, client);
    await identityRepository.markContactVerified(userId, challenge.channel, client);
    return { verified: true };
  });
}

/**
 * Resends a signup verification code with cooldown and hourly limits.
 * SRS FR-1.2.
 *
 * @param {string} userId
 * @returns {Promise<{ sent: boolean }>}
 */
async function resendCode(userId) {
  const user = await userRepository.findAuthContextById(userId);
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'User not found.');
  }

  if (user.verified) {
    throw new AppError(409, 'ALREADY_VERIFIED', 'This account is already verified.');
  }

  // Rate limit: 1 request per OTP_RESEND_SECONDS
  const latestChallenge = await challengeRepository.getLatestChallenge(userId, 'signup');
  if (latestChallenge) {
    const elapsedSeconds = (Date.now() - new Date(latestChallenge.created_at).getTime()) / 1000;
    if (elapsedSeconds < env.otpResendSeconds) {
      const waitSeconds = Math.ceil(env.otpResendSeconds - elapsedSeconds);
      throw new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Please wait ${waitSeconds} seconds before requesting another code.`
      );
    }
  }

  // Rate limit: max 5 requests per hour
  const hourlyCount = await challengeRepository.getRecentResendCount(userId, 'signup', 3600);
  if (hourlyCount >= 5) {
    throw new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Maximum verification requests exceeded. Please try again in an hour.'
    );
  }

  let otpCode;
  let deliveryChannel;
  let deliveryDestination;

  await withTransaction(async (client) => {
    // Consume any older unconsumed challenges
    await challengeRepository.consumeOlderSignupChallenges(userId, client);

    const contact = await identityRepository.findContactDestinationByUserId(userId, client);
    if (!contact) {
      throw new AppError(400, 'INVALID_REQUEST', 'No registered contact found for this user.');
    }
    deliveryChannel = contact.channel;
    deliveryDestination = contact.destination;

    otpCode = generateOtp();
    const tokenHash = hashOtp(otpCode, env.otpPepper);
    const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);

    await challengeRepository.createChallenge(
      {
        userId,
        channel: deliveryChannel,
        purpose: 'signup',
        tokenHash,
        expiresAt,
      },
      client
    );
  });

  // After COMMIT: dispatch OTP
  await otpSender.sendOtp({
    channel: deliveryChannel,
    destination: deliveryDestination,
    code: otpCode,
    purpose: 'signup',
  });

  return { sent: true };
}

/**
 * Authenticates a user with email/phone and password.
 * SRS FR-1.2.
 *
 * @param {string} rawIdentifier - Email or phone
 * @param {string} password - Raw password
 * @returns {Promise<{ token: string, user: object }>}
 */
async function login(rawIdentifier, password) {
  const contactType = detectContactType(rawIdentifier);
  let normalizedIdentifier;

  if (contactType === 'email') {
    try {
      normalizedIdentifier = normalizeEmail(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier.trim().toLowerCase();
    }
  } else {
    try {
      normalizedIdentifier = normalizePhone(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier.trim();
    }
  }

  const user = await identityRepository.findAuthByIdentifier(normalizedIdentifier);

  // Constant-time defense: run dummy bcrypt compare if user is not found
  const hashToCompare = user ? user.passwordHash : DUMMY_BCRYPT_HASH;
  const passwordMatches = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid contact or password.');
  }

  if (user.status === 'suspended' || user.status === 'banned') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended.');
  }

  // Note: deletion_pending users are permitted to log in so they can cancel deletion

  const token = signAccessToken(user);

  return {
    token,
    user: {
      id: user.id,
      handle: user.alias,
      avatarUrl: user.avatarPath || null,
      role: user.role,
      verified: Boolean(user.verified),
      status: user.status,
    },
  };
}

/**
 * Initiates an account recovery challenge.
 * SRS FR-1.8.
 * Always returns 202 status and similar timing regardless of account existence.
 *
 * @param {string} rawIdentifier
 * @returns {Promise<{ message: string }>}
 */
async function requestRecovery(rawIdentifier) {
  const contactType = detectContactType(rawIdentifier);
  let normalizedIdentifier;
  if (contactType === 'email') {
    try {
      normalizedIdentifier = normalizeEmail(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier.trim().toLowerCase();
    }
  } else {
    try {
      normalizedIdentifier = normalizePhone(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier.trim();
    }
  }

  const user = await identityRepository.findAuthByIdentifier(normalizedIdentifier);

  if (user) {
    // Check rate limit: max 5 recovery requests per hour per user
    const hourlyCount = await challengeRepository.getRecentResendCount(user.id, 'recovery', 3600);
    if (hourlyCount >= 5) {
      throw new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Maximum recovery requests exceeded. Please try again in an hour.'
      );
    }

    let otpCode;
    let deliveryChannel;
    let deliveryDestination;

    await withTransaction(async (client) => {
      // Consume older recovery challenges
      await challengeRepository.consumeOlderRecoveryChallenges(user.id, client);

      const contact = await identityRepository.findContactDestinationByUserId(user.id, client);
      if (contact) {
        deliveryChannel = contact.channel;
        deliveryDestination = contact.destination;
      } else {
        deliveryChannel = contactType;
        deliveryDestination = normalizedIdentifier;
      }

      otpCode = generateOtp();
      const tokenHash = hashOtp(otpCode, env.otpPepper);
      const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);

      await challengeRepository.createChallenge(
        {
          userId: user.id,
          channel: deliveryChannel,
          purpose: 'recovery',
          tokenHash,
          expiresAt,
        },
        client
      );
    });

    await otpSender.sendOtp({
      channel: deliveryChannel,
      destination: deliveryDestination,
      code: otpCode,
      purpose: 'recovery',
    });
  } else {
    // Constant-time defense: run dummy hash to balance timing with existing account branch
    await bcrypt.hash('dummy_recovery_defense', 4);
  }

  return {
    message: 'If an account exists for this contact, a recovery code has been sent.',
  };
}

/**
 * Confirms an account recovery challenge and resets password.
 * SRS FR-1.8.
 *
 * @param {string} rawIdentifier
 * @param {string} code
 * @param {string} newPassword
 * @returns {Promise<{ message: string }>}
 */
async function confirmRecovery(rawIdentifier, code, newPassword) {
  const contactType = detectContactType(rawIdentifier);
  let normalizedIdentifier;
  if (contactType === 'email') {
    try {
      normalizedIdentifier = normalizeEmail(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier.trim().toLowerCase();
    }
  } else {
    try {
      normalizedIdentifier = normalizePhone(rawIdentifier);
    } catch {
      normalizedIdentifier = rawIdentifier.trim();
    }
  }

  const user = await identityRepository.findAuthByIdentifier(normalizedIdentifier);

  if (!user) {
    // Constant-time dummy comparison and hash
    verifyOtp(code, '0'.repeat(64), env.otpPepper);
    await bcrypt.hash(newPassword, env.bcryptRounds);
    throw new AppError(400, 'INVALID_CODE', 'Verification code is invalid or has expired.');
  }

  const challenge = await challengeRepository.findLatestUnconsumedRecoveryChallenge(user.id);
  if (!challenge) {
    // Run dummy bcrypt hash for timing consistency
    await bcrypt.hash(newPassword, env.bcryptRounds);
    throw new AppError(400, 'INVALID_CODE', 'Verification code is invalid or has expired.');
  }

  // Increment attempts BEFORE comparing (SRS FR-1.8)
  const attempts = await challengeRepository.incrementAttempts(challenge.id);
  const matches = verifyOtp(code, challenge.token_hash, env.otpPepper);

  if (attempts >= env.otpMaxAttempts) {
    await challengeRepository.consumeChallenge(challenge.id);
    if (!matches) {
      throw new AppError(
        400,
        'CODE_EXHAUSTED',
        'Too many invalid attempts. This recovery code has been deactivated. Please request a new code.'
      );
    }
  }

  if (!matches) {
    throw new AppError(400, 'INVALID_CODE', 'Verification code is invalid or has expired.');
  }

  // Valid code: hash new password and update user credentials in transaction
  const newPasswordHash = await bcrypt.hash(newPassword, env.bcryptRounds);

  await withTransaction(async (client) => {
    await userRepository.updatePassword(user.id, newPasswordHash, client);
    await challengeRepository.consumeChallenge(challenge.id, client);
  });

  return {
    message: 'Password has been reset successfully.',
  };
}

module.exports = {
  register,
  verify,
  resendCode,
  login,
  requestRecovery,
  confirmRecovery,
};