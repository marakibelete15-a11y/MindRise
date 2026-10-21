
'use strict';

// Initial development defaults.
// The SRS requires configurability but does not specify values.
// Confirm these settings with the team before deployment.

const DEFAULT_REPORT_THRESHOLD = 3;
const DEFAULT_REPORT_WINDOW_HOURS = 24;
const DEFAULT_RESTRICTION_HOURS = 24;

function positiveInteger(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

module.exports = {
  reportThreshold: positiveInteger(
    'MODERATION_REPORT_THRESHOLD',
    DEFAULT_REPORT_THRESHOLD
  ),
  reportWindowHours: positiveInteger(
    'MODERATION_REPORT_WINDOW_HOURS',
    DEFAULT_REPORT_WINDOW_HOURS
  ),
  restrictionHours: positiveInteger(
    'MODERATION_RESTRICTION_HOURS',
    DEFAULT_RESTRICTION_HOURS
  ),
};
