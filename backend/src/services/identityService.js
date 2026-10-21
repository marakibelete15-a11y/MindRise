'use strict';

// Identity management and privileged audit-logged access. SRS 5.4, 6.1, FR-7.3.
const AppError = require('../utils/AppError');
const crypto = require('../utils/crypto');
const { withTransaction } = require('../config/db');
const userRepository = require('../repositories/userRepository');
const identityRepository = require('../repositories/identityRepository');

/**
 * Privileged identity retrieval for staff (admin only), strictly audited via identity_access_log.
 * Hard Rule 3: Any staff access to verified_identities must be audited transactionally.
 * SRS 5.4, 6.1, FR-7.3.
 *
 * @param {object} params
 * @param {string} params.actorId - Admin user performing the audit
 * @param {string} params.targetUserId - User whose identity is being accessed
 * @param {string} params.reason - Documented safeguarding/legal justification
 * @returns {Promise<object>} Decrypted identity record
 */
async function readIdentityForStaff({ actorId, targetUserId, reason }) {
  if (!actorId || typeof actorId !== 'string') {
    throw new AppError(403, 'FORBIDDEN', 'Actor ID is required for identity access.');
  }

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Target user ID is required.');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 2) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid justification reason is required for identity access audit.');
  }

  const actor = await userRepository.findAuthContextById(actorId);
  if (!actor || actor.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only administrators may access verified identity data.');
  }

  return withTransaction(async (client) => {
    // 1. Audit log write must commit atomically with the read
    await identityRepository.insertAccessLog(
      {
        actorId,
        targetUserId,
        reason: reason.trim(),
      },
      client
    );

    // 2. Fetch raw identity record
    const rawIdentity = await identityRepository.findRawIdentityByUserId(targetUserId, client);
    if (!rawIdentity) {
      throw new AppError(404, 'NOT_FOUND', 'User identity record not found.');
    }

    // 3. Decrypt first and last names
    let firstName = rawIdentity.first_name;
    let lastName = rawIdentity.last_name;

    try {
      if (firstName && firstName.startsWith('v1:')) {
        firstName = crypto.decrypt(firstName);
      }
    } catch (_err) {
      // Keep raw if decryption fails (e.g. unencrypted seed data in testing)
    }

    try {
      if (lastName && lastName.startsWith('v1:')) {
        lastName = crypto.decrypt(lastName);
      }
    } catch (_err) {
      // Keep raw if decryption fails
    }

    return {
      userId: rawIdentity.user_id,
      firstName,
      lastName,
      email: rawIdentity.email,
      phone: rawIdentity.phone,
      emailVerifiedAt: rawIdentity.email_verified_at,
      phoneVerifiedAt: rawIdentity.phone_verified_at,
      termsAcceptedAt: rawIdentity.terms_accepted_at,
      disclaimerAcceptedAt: rawIdentity.disclaimer_accepted_at,
      consentVersion: rawIdentity.consent_version,
      createdAt: rawIdentity.created_at,
      updatedAt: rawIdentity.updated_at,
    };
  });
}

module.exports = {
  readIdentityForStaff,
};
