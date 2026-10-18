'use strict';

// Authentication input schemas. SRS FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5.
const { z } = require('zod');
const { normalizeEmail, normalizePhone, EMAIL_REGEX, E164_REGEX } = require('../utils/contact');

const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'moderator',
  'mod',
  'mindrise',
  'support',
  'help',
  'system',
  'root',
  'staff',
  'official',
]);

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'iloveyou',
  'welcome123',
  'mindrise123',
  'admin123',
]);

const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(1, 'Name cannot be empty')
  .max(60, 'Name must be 60 characters or fewer')
  .refine(
    (val) => /\p{L}/u.test(val),
    'Name must contain at least one letter and cannot be only digits, symbols, or emoji'
  );

const handleSchema = z
  .string({ required_error: 'Handle is required' })
  .trim()
  .min(2, 'Handle must be at least 2 characters')
  .max(40, 'Handle must be 40 characters or fewer')
  .refine(
    (val) => /^[\p{L}0-9._-]+$/u.test(val) && !/\s/.test(val),
    'Handle can only contain letters, numbers, dots, underscores, and hyphens without spaces'
  )
  .refine(
    (val) => !RESERVED_HANDLES.has(val.toLowerCase()),
    'This handle is reserved. Please choose another.'
  );

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer')
  .refine(
    (val) => !COMMON_PASSWORDS.has(val.toLowerCase()),
    'Password is too common. Please choose a stronger password.'
  );

const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    handle: handleSchema,
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    password: passwordSchema,
    termsAccepted: z.boolean().optional(),
    acceptTerms: z.boolean().optional(),
    disclaimerAccepted: z.boolean().optional(),
    acceptDisclaimer: z.boolean().optional(),
    consentVersion: z.string({ required_error: 'Consent version is required' }).trim().min(1, 'Consent version is required.'),
  })
  .superRefine((data, ctx) => {
    const terms = data.termsAccepted === true || data.acceptTerms === true;
    const disclaimer = data.disclaimerAccepted === true || data.acceptDisclaimer === true;

    if (!terms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['termsAccepted'],
        message: 'You must accept the terms of service.',
      });
    }

    if (!disclaimer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['disclaimerAccepted'],
        message: 'You must accept the safety disclaimer.',
      });
    }
    const hasEmail = Boolean(data.email && data.email.length > 0);
    const hasPhone = Boolean(data.phone && data.phone.length > 0);

    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Exactly one of email or phone must be provided.',
      });
    } else if (hasEmail && hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Provide email or phone, but not both.',
      });
    } else if (hasEmail) {
      try {
        normalizeEmail(data.email);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: err.safeMessage || 'Invalid email format.',
        });
      }
    } else if (hasPhone) {
      try {
        normalizePhone(data.phone);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phone'],
          message: err.safeMessage || 'Invalid phone number. Must be a valid phone number.',
        });
      }
    }
  })
  .transform((data) => {
    const transformed = { ...data };
    if (data.email) {
      transformed.email = normalizeEmail(data.email);
    }
    if (data.phone) {
      transformed.phone = normalizePhone(data.phone);
    }
    return transformed;
  });

const verifySchema = z.object({
  code: z
    .string({ required_error: 'Verification code is required' })
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
});

const loginSchema = z.object({
  identifier: z.string({ required_error: 'Identifier is required' }).trim().min(1, 'Identifier is required'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

const resendSchema = z.object({}).passthrough();

const recoverRequestSchema = z.object({
  identifier: z.string({ required_error: 'Identifier is required' }).trim().min(1, 'Identifier is required'),
});

const recoverConfirmSchema = z.object({
  identifier: z.string({ required_error: 'Identifier is required' }).trim().min(1, 'Identifier is required'),
  code: z
    .string({ required_error: 'Verification code is required' })
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
  newPassword: passwordSchema,
});

module.exports = {
  registerSchema,
  verifySchema,
  resendSchema,
  loginSchema,
  recoverRequestSchema,
  recoverConfirmSchema,
};