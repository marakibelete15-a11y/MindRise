'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

const requiredInProduction = ['JWT_SECRET', 'DB_PASSWORD', 'DATA_ENCRYPTION_KEY', 'OTP_PEPPER'];
if (isProd) {
  const missing = requiredInProduction.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

let jwtSecret = process.env.JWT_SECRET;
if (isTest && (!jwtSecret || jwtSecret === 'replace_with_a_long_random_secret' || jwtSecret.length < 32)) {
  jwtSecret = 'test_jwt_secret_must_be_at_least_32_characters_long_for_tests!';
}

if (!isTest) {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
  if (jwtSecret === 'replace_with_a_long_random_secret' || jwtSecret.toLowerCase().includes('replace_with')) {
    throw new Error('JWT_SECRET cannot be a placeholder value.');
  }
}

let dataEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
if (isTest && (!dataEncryptionKey || dataEncryptionKey === 'replace_with_32_byte_base64_encryption_key')) {
  dataEncryptionKey = Buffer.alloc(32, 1).toString('base64');
}

if (!isTest && dataEncryptionKey) {
  if (dataEncryptionKey === 'replace_with_32_byte_base64_encryption_key') {
    throw new Error('DATA_ENCRYPTION_KEY cannot be a placeholder value.');
  }
  const keyBuf = Buffer.from(dataEncryptionKey, 'base64');
  if (keyBuf.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be a 32-byte base64-encoded string.');
  }
}

let otpPepper = process.env.OTP_PEPPER;
if (isTest && (!otpPepper || otpPepper.includes('replace_with'))) {
  otpPepper = 'test_otp_pepper_secret_value_1234567890!';
}

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5500',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  dataEncryptionKey,
  otpPepper: otpPepper || 'dev_otp_pepper_secret_value_1234567890!',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || (isTest ? 4 : 12)),
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  otpResendSeconds: Number(process.env.OTP_RESEND_SECONDS || 60),
  otpDriver: process.env.OTP_DRIVER || (isTest ? 'console' : (process.env.NODE_ENV === 'development' ? 'console' : 'email')),
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: Number(process.env.SMTP_PORT || 1025),
  smtpUser: process.env.SMTP_USER || 'placeholder',
  smtpPassword: process.env.SMTP_PASSWORD,
  dbHost: isTest ? (process.env.TEST_DB_HOST || '/tmp') : (process.env.DB_HOST || 'localhost'),
  dbPort: Number(process.env.DB_PORT || 5432),
  dbName: isTest ? (process.env.TEST_DB_NAME || 'mindrise_test') : (process.env.DB_NAME || 'mindrise_dev'),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  uploadDir: process.env.UPLOAD_DIR || 'uploads/avatars',
});