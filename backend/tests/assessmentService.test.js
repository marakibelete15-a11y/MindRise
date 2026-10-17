'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const assessmentService = require('../src/services/assessmentService');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const attemptRepository = require('../src/repositories/attemptRepository');
const crisisService = require('../src/services/crisisService');

test('getAssessmentById does not expose answer scores', async () => {
const original = assessmentRepository.getAssessmentById;

assessmentRepository.getAssessmentById = async () => ({
    assessmentTypeId: 'assessment-1',
    assessmentVersionId: 'version-1',
    slug: 'sample',
    title: 'Sample assessment',
    version: 1,
    questions: [{
        id: 'question-1',
        position: 1,
        prompt: 'Sample question',
        isRequired: true,
        responseOptions: [
            { value: 'yes', label: 'Yes', score: 2 }
        ]
    }]
});

try {
    const result = await assessmentService.getAssessmentById('assessment-1');

    assert.equal(
        Object.hasOwn(result.questions[0].responseOptions[0], 'score'),
        false
    );
} finally {
    assessmentRepository.getAssessmentById = original;
}

});

test('submitAttempt rejects an invalid question ID', async () => {
    const originals = {
        getAttempt: attemptRepository.getAttemptById,
        getVersion: assessmentRepository.getPublishedVersionById,
        getQuestions: assessmentRepository.getQuestionsByVersionId
    };

    // Mock the database-dependent functions.
    attemptRepository.getAttemptById = async () => ({
        id: 'attempt-1',
        status: 'in_progress',
        assessmentVersionId: 'version-1'
    });

    assessmentRepository.getPublishedVersionById = async () => ({
        id: 'version-1',
        scoringMethod: 'sum',
        resultBands: [],
        riskThreshold: null
    });

    assessmentRepository.getQuestionsByVersionId = async () => [{
        id: 'question-1',
        position: 1,
        isRequired: true,
        riskMinScore: null,
        responseOptions: [
            { value: 'yes', score: 1 }
        ]
    }];

    try {
        await assert.rejects(
            assessmentService.submitAttempt({
                attemptId: 'attempt-1',
                userId: 'user-1',
                answers: [{
                    questionId: 'unknown-question',
                    value: 'yes'
                }]
            }),
            /invalid question/i
        );
    } finally {
        attemptRepository.getAttemptById = originals.getAttempt;
        assessmentRepository.getPublishedVersionById = originals.getVersion;
        assessmentRepository.getQuestionsByVersionId = originals.getQuestions;
    }
});
test('submitAttempt rejects duplicate answers', async () => {
const originals = {
getAttempt: attemptRepository.getAttemptById,
getVersion: assessmentRepository.getPublishedVersionById,
getQuestions: assessmentRepository.getQuestionsByVersionId
};

attemptRepository.getAttemptById = async () => ({
    id: 'attempt-1',
    status: 'in_progress',
    assessmentVersionId: 'version-1'
});

assessmentRepository.getPublishedVersionById = async () => ({
    id: 'version-1',
    scoringMethod: 'sum',
    resultBands: [],
    riskThreshold: null
});

assessmentRepository.getQuestionsByVersionId = async () => [{
    id: 'question-1',
    position: 1,
    isRequired: true,
    riskMinScore: null,
    responseOptions: [{ value: 'yes', score: 1 }]
}];

try {
    await assert.rejects(
        assessmentService.submitAttempt({
            attemptId: 'attempt-1',
            userId: 'user-1',
            answers: [
                { questionId: 'question-1', value: 'yes' },
                { questionId: 'question-1', value: 'yes' }
            ]
        }),
        /more than once/i
    );
} finally {
    attemptRepository.getAttemptById = originals.getAttempt;
    assessmentRepository.getPublishedVersionById = originals.getVersion;
    assessmentRepository.getQuestionsByVersionId = originals.getQuestions;
}

});

test('submitAttempt rejects a missing required answer', async () => {
const originals = {
getAttempt: attemptRepository.getAttemptById,
getVersion: assessmentRepository.getPublishedVersionById,
getQuestions: assessmentRepository.getQuestionsByVersionId
};

attemptRepository.getAttemptById = async () => ({
    id: 'attempt-1',
    status: 'in_progress',
    assessmentVersionId: 'version-1'
});

assessmentRepository.getPublishedVersionById = async () => ({
    id: 'version-1',
    scoringMethod: 'sum',
    resultBands: [],
    riskThreshold: null
});

assessmentRepository.getQuestionsByVersionId = async () => [{
    id: 'question-1',
    position: 1,
    isRequired: true,
    riskMinScore: null,
    responseOptions: [{ value: 'yes', score: 1 }]
}];

try {
    await assert.rejects(
        assessmentService.submitAttempt({
            attemptId: 'attempt-1',
            userId: 'user-1',
            answers: []
        }),
        /required question/i
    );
} finally {
    attemptRepository.getAttemptById = originals.getAttempt;
    assessmentRepository.getPublishedVersionById = originals.getVersion;
    assessmentRepository.getQuestionsByVersionId = originals.getQuestions;
}

});

test('crisis detection returns an unconfigured result instead of inventing rules', () => {
const detectionService = require('../src/services/crisisDetectionService');

assert.deepEqual(
    detectionService.scan('Example text', 'en'),
    {
        flagged: false,
        reason: 'detection_rules_not_configured',
        languageCode: 'en'
    }
);

});
