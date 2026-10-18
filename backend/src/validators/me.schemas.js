'use strict';

// Account, profile, and settings validation schemas. SRS FR-1.3, FR-1.7, FR-5.2.
const { z } = require('zod');

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

const handleSchema = z
  .string()
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

const updateProfileSchema = z
  .object({
    handle: handleSchema.optional(),
    bio: z.string().max(500, 'Bio must be 500 characters or fewer').nullable().optional(),
  })
  .refine((data) => data.handle !== undefined || data.bio !== undefined, {
    message: 'At least one profile field (handle or bio) must be provided.',
  });

function isValidIanaTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const updateSettingsSchema = z
  .object({
    language: z.enum(['en', 'am'], {
      errorMap: () => ({ message: 'Language must be either "en" or "am".' }),
    }).optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidIanaTimezone, {
        message: 'Invalid IANA timezone identifier (e.g., "Africa/Addis_Ababa", "UTC").',
      })
      .optional(),
    pushEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    profileVisibility: z.enum(['anonymous', 'private'], {
      errorMap: () => ({ message: 'Profile visibility must be "anonymous" or "private".' }),
    }).optional(),
  })
  .refine(
    (data) =>
      data.language !== undefined ||
      data.timezone !== undefined ||
      data.pushEnabled !== undefined ||
      data.emailEnabled !== undefined ||
      data.profileVisibility !== undefined,
    {
      message: 'At least one setting must be provided for update.',
    }
  );

module.exports = {
  updateProfileSchema,
  updateSettingsSchema,
  isValidIanaTimezone,
};
