'use strict';

const pool = require('../config/db');

// Create a new assessment attempt for a user.
async function createAttempt(userId, assessmentVersionId) {
const query = `         INSERT INTO assessment_attempts (
            user_id,
            assessment_version_id
        )
        VALUES ($1, $2)
        RETURNING
            id,
            user_id AS "userId",
            assessment_version_id AS "assessmentVersionId",
            status,
            started_at AS "startedAt";
    `;

const result = await pool.query(query, [
    userId,
    assessmentVersionId
]);

return result.rows[0];

}

// Find an attempt belonging to a particular user.
async function getAttemptById(attemptId, userId) {
const query = `         SELECT
            id,
            user_id AS "userId",
            assessment_version_id AS "assessmentVersionId",
            status,
            started_at AS "startedAt",
            completed_at AS "completedAt",
            total_score AS "totalScore",
            result_band AS "resultBand",
            result_summary AS "resultSummary"
        FROM assessment_attempts
        WHERE id = $1
          AND user_id = $2;
    `;

const result = await pool.query(query, [attemptId, userId]);
return result.rows[0] || null;

}

// Save answers and scores, then complete an attempt atomically.
async function completeAttempt({
attemptId,
userId,
answers,
totalScore,
resultBand,
resultSummary
}) {
return pool.withTransaction(async (client) => {
const attemptQuery = `             SELECT id, assessment_version_id
            FROM assessment_attempts
            WHERE id = $1
              AND user_id = $2
              AND status = 'in_progress'
            FOR UPDATE;
        `;

    const attemptResult = await client.query(attemptQuery, [
        attemptId,
        userId
    ]);

    if (attemptResult.rows.length === 0) {
        return null;
    }

    const versionId = attemptResult.rows[0].assessment_version_id;

    for (const answer of answers) {
        const insertAnswerQuery = `
            INSERT INTO assessment_answers (
                attempt_id,
                question_id,
                answer_value,
                score
            )
            SELECT $1, q.id, $3::jsonb, $4
            FROM assessment_questions q
            WHERE q.id = $2
              AND q.assessment_version_id = $5
            ON CONFLICT (attempt_id, question_id)
            DO UPDATE SET
                answer_value = EXCLUDED.answer_value,
                score = EXCLUDED.score;
        `;

        const answerResult = await client.query(insertAnswerQuery, [
            attemptId,
            answer.questionId,
            JSON.stringify(answer.value),
            answer.score,
            versionId
        ]);

        if (answerResult.rowCount !== 1) {
            throw new Error('Invalid question for this assessment attempt');
        }
    }

    const updateQuery = `
        UPDATE assessment_attempts
        SET
            status = 'completed',
            completed_at = NOW(),
            total_score = $3,
            result_band = $4,
            result_summary = $5
        WHERE id = $1
          AND user_id = $2
          AND status = 'in_progress'
        RETURNING
            id,
            status,
            completed_at AS "completedAt",
            total_score AS "totalScore",
            result_band AS "resultBand",
            result_summary AS "resultSummary";
    `;

    const updateResult = await client.query(updateQuery, [
        attemptId,
        userId,
        totalScore,
        resultBand,
        resultSummary
    ]);

    return updateResult.rows[0] || null;
});

}

// Get a user's assessment history without exposing other users' records.
async function getAssessmentHistory(userId) {
const query = `         SELECT
            aa.id AS "attemptId",
            aa.status,
            aa.started_at AS "startedAt",
            aa.completed_at AS "completedAt",
            aa.total_score AS "totalScore",
            aa.result_band AS "resultBand",
            aa.result_summary AS "resultSummary",
            at.id AS "assessmentTypeId",
            at.slug,
            at.title,
            av.version
        FROM assessment_attempts aa
        JOIN assessment_versions av
            ON av.id = aa.assessment_version_id
        JOIN assessment_types at
            ON at.id = av.assessment_type_id
        WHERE aa.user_id = $1
        ORDER BY aa.started_at DESC;
    `;

const result = await pool.query(query, [userId]);
return result.rows;

}

// Delete one of the user's own attempts.
async function deleteAttempt(attemptId, userId) {
const query = `         DELETE FROM assessment_attempts
        WHERE id = $1
          AND user_id = $2
        RETURNING id;
    `;

const result = await pool.query(query, [attemptId, userId]);
return result.rows[0] || null;

}

module.exports = {
createAttempt,
getAttemptById,
completeAttempt,
getAssessmentHistory,
deleteAttempt
};
