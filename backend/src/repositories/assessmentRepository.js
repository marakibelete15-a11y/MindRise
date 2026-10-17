'use strict';

const pool = require('../config/db');

// Get published assessments and their latest published versions.
async function getAssessments() {
const query = `         SELECT
            at.id AS "assessmentTypeId",
            at.slug,
            at.title,
            at.description,
            av.id AS "assessmentVersionId",
            av.version,
            av.scoring_method AS "scoringMethod"
        FROM assessment_types at
        JOIN assessment_versions av
            ON av.assessment_type_id = at.id
        WHERE at.is_active = TRUE
          AND av.published_at IS NOT NULL
          AND av.version = (
              SELECT MAX(av2.version)
              FROM assessment_versions av2
              WHERE av2.assessment_type_id = at.id
                AND av2.published_at IS NOT NULL
          )
        ORDER BY at.title ASC;
    `;

const result = await pool.query(query);
return result.rows;

}

// Get one published assessment version and its questions.
async function getAssessmentById(assessmentTypeId) {
const query = `         SELECT
            at.id AS "assessmentTypeId",
            at.slug,
            at.title,
            at.description,
            av.id AS "assessmentVersionId",
            av.version,
            av.scoring_method AS "scoringMethod",
            av.result_bands AS "resultBands",
            av.risk_threshold AS "riskThreshold",
            q.id AS "questionId",
            q.position,
            q.prompt,
            q.response_options AS "responseOptions",
            q.is_required AS "isRequired",
            q.risk_min_score AS "riskMinScore"
        FROM assessment_types at
        JOIN assessment_versions av
            ON av.assessment_type_id = at.id
        LEFT JOIN assessment_questions q
            ON q.assessment_version_id = av.id
        WHERE at.id = $1
          AND at.is_active = TRUE
          AND av.published_at IS NOT NULL
          AND av.version = (
              SELECT MAX(av2.version)
              FROM assessment_versions av2
              WHERE av2.assessment_type_id = at.id
                AND av2.published_at IS NOT NULL
          )
        ORDER BY q.position ASC;
    `;

const result = await pool.query(query, [assessmentTypeId]);

if (result.rows.length === 0) {
    return null;
}

const firstRow = result.rows[0];

return {
    assessmentTypeId: firstRow.assessmentTypeId,
    slug: firstRow.slug,
    title: firstRow.title,
    description: firstRow.description,
    assessmentVersionId: firstRow.assessmentVersionId,
    version: firstRow.version,
    scoringMethod: firstRow.scoringMethod,
    resultBands: firstRow.resultBands,
    riskThreshold: firstRow.riskThreshold,
    questions: result.rows
        .filter((row) => row.questionId !== null)
        .map((row) => ({
            id: row.questionId,
            position: row.position,
            prompt: row.prompt,
            responseOptions: row.responseOptions,
            isRequired: row.isRequired,
            riskMinScore: row.riskMinScore
        }))
};

}

// Retrieve an assessment version by its ID for internal workflows.
async function getPublishedVersionById(versionId) {
const query = `         SELECT
            id,
            assessment_type_id AS "assessmentTypeId",
            version,
            scoring_method AS "scoringMethod",
            result_bands AS "resultBands",
            risk_threshold AS "riskThreshold"
        FROM assessment_versions
        WHERE id = $1
          AND published_at IS NOT NULL;
    `;

const result = await pool.query(query, [versionId]);
return result.rows[0] || null;

}

// Get the questions for one published version.
async function getQuestionsByVersionId(versionId) {
const query = `         SELECT
            id,
            assessment_version_id AS "assessmentVersionId",
            position,
            prompt,
            response_options AS "responseOptions",
            is_required AS "isRequired",
            risk_min_score AS "riskMinScore"
        FROM assessment_questions
        WHERE assessment_version_id = $1
        ORDER BY position ASC;
    `;

const result = await pool.query(query, [versionId]);
return result.rows;

}

module.exports = {
getAssessments,
getAssessmentById,
getPublishedVersionById,
getQuestionsByVersionId
};
