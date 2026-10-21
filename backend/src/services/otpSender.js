'use strict';

// OTP dispatching service supporting multiple drivers. SRS FR-1.1, FR-1.2, 5.4.
const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Dispatches an OTP verification code using the configured driver.
 *
 * @param {object} params
 * @param {'email'|'phone'} params.channel
 * @param {string} params.destination - Target email or phone number
 * @param {string} params.code - 6-digit numeric OTP code
 * @param {string} [params.purpose='signup']
 * @returns {Promise<void>}
 */
async function sendOtp({ channel, destination, code, purpose = 'signup' }, envOverride = null) {
  const currentEnv = envOverride || env;
  const driver = currentEnv.otpDriver;

  if (driver === 'console') {
    if (currentEnv.nodeEnv === 'production') {
      throw new AppError(500, 'INTERNAL_ERROR', 'Console OTP driver is not permitted in production.');
    }
    // Only prints in development / test environments
    console.log(`[OTP Console Driver] [${purpose.toUpperCase()}] Verification code: ${code}`);
    return;
  }

  if (driver === 'email') {
    if (channel !== 'email') {
      throw new AppError(400, 'UNSUPPORTED_CHANNEL', 'Email driver cannot deliver to phone channel.');
    }
    const transportOptions = {
      host: env.smtpHost,
      port: env.smtpPort,
    };
    if (env.smtpPassword) {
      transportOptions.auth = {
        user: env.smtpUser,
        pass: env.smtpPassword,
      };
    }
    const transporter = nodemailer.createTransport(transportOptions);

    // TO_VERIFY: Clinical & localization teams must review email subject and body copy
    const mailOptions = {
      from: '"MindRise Safety" <no-reply@mindrise.et>',
      to: destination,
      subject: 'Your MindRise verification code (TO_VERIFY)',
      text: `Welcome to MindRise. Your verification code is ${code}. It expires in ${env.otpTtlMinutes} minutes. Please do not share this code with anyone. (TO_VERIFY: Email body copy)`,
    };

    await transporter.sendMail(mailOptions);
    return;
  }

  if (driver === 'sms') {
    // Interface stub per requirements
    throw new AppError(503, 'NOT_CONFIGURED', 'SMS delivery provider is not configured.');
  }

  throw new AppError(500, 'INTERNAL_ERROR', `Unknown OTP driver: ${driver}`);
}

module.exports = {
  sendOtp,
};
