'use strict';

// User account queries. SRS FR-1.1, FR-1.2, FR-7.5.
const pool = require('../config/db');

/**
 * Loads current authentication context for a user.
 * SRS FR-1.1, FR-1.2, FR-7.5: auth middleware user lookup.
 * HARD PRIVACY RULE: Never selects names, email, phone, or credentials.
 *
 * @param {string} id - User UUID
 * @param {object} [client] - Optional db client for transactions
 * @returns {Promise<object|null>} Auth context or null if not found
 */
async function findAuthContextById(id, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT
      u.id,
      u.role,
      u.status,
      u.restricted_until,
      (vi.email_verified_at IS NOT NULL OR vi.phone_verified_at IS NOT NULL) AS verified
    FROM users u
    LEFT JOIN verified_identities vi ON vi.user_id = u.id
    WHERE u.id = $1 AND u.deleted_at IS NULL
  `;
  const result = await queryExecutor.query(sql, [id]);
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    restrictedUntil: row.restricted_until ? new Date(row.restricted_until).toISOString() : null,
    verified: Boolean(row.verified),
  };
}

module.exports = {
  findAuthContextById,
};