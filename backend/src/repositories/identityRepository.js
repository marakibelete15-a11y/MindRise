'use strict';

// Restricted verified-identity queries and audit writes. SRS FR-1.1, FR-1.2, FR-1.5, 5.4.
const pool = require('../config/db');

/**
 * Inserts a new verified identity record.
 * First and last names must already be encrypted before passing here.
 * SRS FR-1.1, 5.4.
 *
 * @param {object} data
 * @param {object} [client]
 * @returns {Promise<object>} Created record
 */
async function createVerifiedIdentity(data, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    INSERT INTO verified_identities (
      user_id,
      first_name,
      last_name,
      email,
      phone,
      terms_accepted_at,
      disclaimer_accepted_at,
      consent_version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING user_id, email, phone, consent_version, created_at
  `;
  const values = [
    data.userId,
    data.firstName, // Already encrypted
    data.lastName,  // Already encrypted
    data.email || null,
    data.phone || null,
    data.termsAcceptedAt || new Date(),
    data.disclaimerAcceptedAt || new Date(),
    data.consentVersion,
  ];
  const result = await queryExecutor.query(sql, values);
  return result.rows[0];
}

/**
 * Looks up user credentials and profile for login.
 * Matches normalized email or phone.
 * Hard Rule 3: Never returns names or contacts into public context.
 *
 * @param {string} identifier - Normalized email or E.164 phone
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findAuthByIdentifier(identifier, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT
      u.id,
      u.role,
      u.status,
      u.password_hash,
      u.restricted_until,
      p.alias,
      p.avatar_path,
      (vi.email_verified_at IS NOT NULL OR vi.phone_verified_at IS NOT NULL) AS verified
    FROM verified_identities vi
    JOIN users u ON u.id = vi.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE (lower(vi.email) = lower($1) OR vi.phone = $1)
      AND u.deleted_at IS NULL
    LIMIT 1
  `;
  const result = await queryExecutor.query(sql, [identifier]);
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    restrictedUntil: row.restricted_until ? new Date(row.restricted_until).toISOString() : null,
    alias: row.alias,
    avatarPath: row.avatar_path,
    verified: Boolean(row.verified),
  };
}

/**
 * Updates verified_identities to mark email or phone verified.
 * SRS FR-1.2.
 *
 * @param {string} userId
 * @param {'email'|'phone'} channel
 * @param {object} [client]
 * @returns {Promise<void>}
 */
async function markContactVerified(userId, channel, client = null) {
  const queryExecutor = client || pool;
  const column = channel === 'email' ? 'email_verified_at' : 'phone_verified_at';
  const sql = `
    UPDATE verified_identities
    SET ${column} = now(), updated_at = now()
    WHERE user_id = $1
  `;
  await queryExecutor.query(sql, [userId]);
}

/**
 * Loads transient contact destination for OTP delivery only.
 * SRS 5.4, 6.1.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<{ channel: 'email'|'phone', destination: string }|null>}
 */
async function findContactDestinationByUserId(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT email, phone
    FROM verified_identities
    WHERE user_id = $1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.email) {
    return { channel: 'email', destination: row.email };
  }
  if (row.phone) {
    return { channel: 'phone', destination: row.phone };
  }
  return null;
}

/**
 * Inserts an identity access audit log record.
 * SRS 5.4, FR-7.3.
 *
 * @param {object} params
 * @param {string} params.actorId
 * @param {string} params.targetUserId
 * @param {string} params.reason
 * @param {object} [client]
 * @returns {Promise<object>}
 */
async function insertAccessLog({ actorId, targetUserId, reason }, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    INSERT INTO identity_access_log (actor_id, target_user_id, reason)
    VALUES ($1, $2, $3)
    RETURNING id, actor_id, target_user_id, reason, created_at
  `;
  const result = await queryExecutor.query(sql, [actorId, targetUserId, reason]);
  return result.rows[0];
}

/**
 * Fetches raw verified identity record for audited staff access.
 * SRS 5.4.
 *
 * @param {string} userId
 * @param {object} [client]
 * @returns {Promise<object|null>}
 */
async function findRawIdentityByUserId(userId, client = null) {
  const queryExecutor = client || pool;
  const sql = `
    SELECT
      user_id,
      first_name,
      last_name,
      email,
      phone,
      email_verified_at,
      phone_verified_at,
      terms_accepted_at,
      disclaimer_accepted_at,
      consent_version,
      created_at,
      updated_at
    FROM verified_identities
    WHERE user_id = $1
  `;
  const result = await queryExecutor.query(sql, [userId]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

module.exports = {
  createVerifiedIdentity,
  findAuthByIdentifier,
  markContactVerified,
  findContactDestinationByUserId,
  insertAccessLog,
  findRawIdentityByUserId,
};