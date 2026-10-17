'use strict';

const pool = require('../config/db');

async function createFlag({
userId,
source,
attemptId = null,
postId = null,
commentId = null
}) {
const query = `         INSERT INTO crisis_flags (
            user_id,
            source,
            attempt_id,
            post_id,
            comment_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            user_id AS "userId",
            source,
            status,
            created_at AS "createdAt";
    `;

const result = await pool.query(query, [
    userId,
    source,
    attemptId,
    postId,
    commentId
]);

return result.rows[0];

}

async function getActiveFlags() {
const query = `         SELECT
            id,
            user_id AS "userId",
            source,
            attempt_id AS "attemptId",
            post_id AS "postId",
            comment_id AS "commentId",
            status,
            assigned_to AS "assignedTo",
            created_at AS "createdAt"
        FROM crisis_flags
        WHERE status IN ('open', 'reviewing')
        ORDER BY created_at ASC;
    `;

const result = await pool.query(query);

return result.rows;

}

async function acknowledgeFlag(flagId, userId) {
const query = `         UPDATE crisis_flags
        SET user_acknowledged_at = COALESCE(
            user_acknowledged_at,
            NOW()
        )
        WHERE id = $1
          AND user_id = $2
          AND status <> 'resolved'
        RETURNING
            id,
            user_acknowledged_at AS "userAcknowledgedAt";
    `;

const result = await pool.query(query, [flagId, userId]);

return result.rows[0] || null;

}

module.exports = {
createFlag,
getActiveFlags,
acknowledgeFlag
};

