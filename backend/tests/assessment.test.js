'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const assessmentService = require('../src/services/assessmentService');

test('GET /api/assessments returns the assessment list', async () => {
    const originalGetAssessments = assessmentService.getAssessments;

    assessmentService.getAssessments = async () => [
        {
            assessmentTypeId: 'test-assessment-id',
            slug: 'mood-check',
            title: 'Mood Check',
            version: 1
        }
    ];

    try {
        const response = await request(app).get('/api/assessments');

        assert.equal(response.status, 200);
        assert.equal(response.body.assessments.length, 1);
        assert.equal(response.body.assessments[0].slug, 'mood-check');
    } finally {
        assessmentService.getAssessments = originalGetAssessments;
    }
});

test('GET /api/assessments/:assessmentId returns assessment details', async () => {
    const originalGetAssessmentById = assessmentService.getAssessmentById;

    assessmentService.getAssessmentById = async (assessmentId) => ({
        assessmentTypeId: assessmentId,
        slug: 'mood-check',
        title: 'Mood Check',
        version: 1,
        questions: [
            {
                id: 'question-1',
                position: 1,
                prompt: 'Example question',
                isRequired: true,
                responseOptions: [
                    { value: 'option_a', label: 'Option A' },
                    { value: 'option_b', label: 'Option B' }
                ]
            }
        ],
        disclaimer: 'This is not a diagnosis.'
    });

    try {
        const response = await request(app)
            .get('/api/assessments/test-assessment-id');

        assert.equal(response.status, 200);
        assert.equal(
            response.body.assessment.assessmentTypeId,
            'test-assessment-id'
        );

        const options =
            response.body.assessment.questions[0].responseOptions;

        assert.equal(options.length, 2);
        assert.equal(options[0].value, 'option_a');

        // Public options must not expose internal scoring values.
        assert.equal(
            Object.prototype.hasOwnProperty.call(options[0], 'score'),
            false
        );
    } finally {
        assessmentService.getAssessmentById = originalGetAssessmentById;
    }
});

test('GET /api/assessments/:assessmentId returns 404 when not found', async () => {
    const originalGetAssessmentById = assessmentService.getAssessmentById;

    assessmentService.getAssessmentById = async () => null;

    try {
        const response = await request(app)
            .get('/api/assessments/missing-assessment');

        assert.equal(response.status, 404);
        assert.equal(response.body.error, 'Assessment not found');
    } finally {
        assessmentService.getAssessmentById = originalGetAssessmentById;
    }
});