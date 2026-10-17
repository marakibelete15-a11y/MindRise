'use strict';

const assessmentRepository = require('../repositories/assessmentRepository');
const attemptRepository = require('../repositories/attemptRepository');
const crisisService = require('./crisisService');

// Return the published assessment catalog.
async function getAssessments() {
return assessmentRepository.getAssessments();
}

// Return one assessment with its questions and public answer options.
async function getAssessmentById(assessmentTypeId) {
const assessment = await assessmentRepository.getAssessmentById(
assessmentTypeId
);

if (!assessment) {
    return null;
}

// Never send internal scoring information to the frontend.
return {
    assessmentTypeId: assessment.assessmentTypeId,
    slug: assessment.slug,
    title: assessment.title,
    description: assessment.description,
    version: assessment.version,
    questions: assessment.questions.map((question) => ({
        id: question.id,
        position: question.position,
        prompt: question.prompt,
        isRequired: question.isRequired,
        responseOptions: Array.isArray(question.responseOptions)
            ? question.responseOptions.map((option) => ({
                value: option.value,
                label: option.label ?? String(option.value)
            }))
            : []
    })),
    disclaimer:
        'This self-assessment is for informational purposes only. ' +
        'It does not provide a diagnosis or replace professional support.'
};

}

// Start an attempt using the latest published version.
async function startAttempt(userId, assessmentTypeId) {
if (!userId) {
throw new Error('A user ID is required');
}

const assessment = await assessmentRepository.getAssessmentById(
    assessmentTypeId
);

if (!assessment) {
    return null;
}

return attemptRepository.createAttempt(
    userId,
    assessment.assessmentVersionId
);

}

// Match an answer to an option defined by the server.
function findMatchingOption(options, submittedValue) {
if (!Array.isArray(options)) {
return undefined;
}

return options.find((option) => (
    JSON.stringify(option.value) === JSON.stringify(submittedValue)
));

}

// Find the result band that contains the calculated score.
function findResultBand(resultBands, totalScore) {
if (!Array.isArray(resultBands)) {
return null;
}

```
return resultBands.find((band) => (
    Number.isFinite(Number(band.min)) &&
    Number.isFinite(Number(band.max)) &&
    totalScore >= Number(band.min) &&
    totalScore <= Number(band.max)
)) || null;
```

}

// Submit answers and calculate the score on the server.
async function submitAttempt({ attemptId, userId, answers }) {
if (!attemptId || !userId) {
throw new Error('An attempt ID and user ID are required');
}

if (!Array.isArray(answers)) {
    throw new Error('Answers must be provided as an array');
}

const attempt = await attemptRepository.getAttemptById(
    attemptId,
    userId
);

if (!attempt) {
    return null;
}

if (attempt.status !== 'in_progress') {
    throw new Error('This assessment attempt is not in progress');
}

const version = await assessmentRepository.getPublishedVersionById(
    attempt.assessmentVersionId
);

if (!version) {
    throw new Error('The assessment version is unavailable');
}

const questions = await assessmentRepository.getQuestionsByVersionId(
    version.id
);

if (questions.length === 0) {
    throw new Error('This assessment has no questions');
}

const questionById = new Map(
    questions.map((question) => [question.id, question])
);

const submittedByQuestion = new Map();

for (const answer of answers) {
    if (
        !answer ||
        typeof answer.questionId !== 'string' ||
        !Object.prototype.hasOwnProperty.call(answer, 'value')
    ) {
        throw new Error('Each answer needs a question ID and a value');
    }

    if (!questionById.has(answer.questionId)) {
        throw new Error('An answer references an invalid question');
    }

    if (submittedByQuestion.has(answer.questionId)) {
        throw new Error('A question cannot be answered more than once');
    }

    submittedByQuestion.set(answer.questionId, answer.value);
}

const calculatedAnswers = [];
let totalScore = 0;
let hasRiskAnswer = false;

for (const question of questions) {
    const hasAnswer = submittedByQuestion.has(question.id);

    if (!hasAnswer) {
        if (question.isRequired) {
            throw new Error(
                `Required question ${question.position} is unanswered`
            );
        }

        continue;
    }

    const submittedValue = submittedByQuestion.get(question.id);
    const option = findMatchingOption(
        question.responseOptions,
        submittedValue
    );

    if (!option) {
        throw new Error(
            `Invalid answer for question ${question.position}`
        );
    }

    const score = Number(option.score);

    if (!Number.isFinite(score) || score < 0) {
        throw new Error('The configured answer score is invalid');
    }

    totalScore += score;

    if (
        question.riskMinScore !== null &&
        question.riskMinScore !== undefined &&
        score >= Number(question.riskMinScore)
    ) {
        hasRiskAnswer = true;
    }

    calculatedAnswers.push({
        questionId: question.id,
        value: submittedValue,
        score
    });
}

if (calculatedAnswers.length === 0) {
    throw new Error('At least one answer is required');
}

if (version.scoringMethod === 'average') {
    totalScore /= calculatedAnswers.length;
} else if (version.scoringMethod !== 'sum') {
    throw new Error('The configured scoring method is unsupported');
}

totalScore = Number(totalScore.toFixed(2));

const band = findResultBand(version.resultBands, totalScore);
const resultBand = band ? band.label : null;

const threshold = version.riskThreshold === null
    || version.riskThreshold === undefined
    ? null
    : Number(version.riskThreshold);

if (threshold !== null && !Number.isFinite(threshold)) {
    throw new Error('The configured risk threshold is invalid');
}

const meetsTotalRiskThreshold =
    threshold !== null && totalScore >= threshold;

// Save the result first. Raise a flag only after completion succeeds.
const completedAttempt = await attemptRepository.completeAttempt({
    attemptId,
    userId,
    answers: calculatedAnswers,
    totalScore,
    resultBand,
    resultSummary: band ? band.label : null
});

if (!completedAttempt) {
    return null;
}

let crisisFlag = null;

if (hasRiskAnswer || meetsTotalRiskThreshold) {
    crisisFlag = await crisisService.raiseFlag({
        userId,
        source: 'assessment',
        attemptId
    });
}

return {
    attempt: completedAttempt,
    safetyFlagRaised: Boolean(crisisFlag),
    disclaimer:
        'This result is informational and is not a diagnosis. ' +
        'If you feel unsafe or need immediate help, contact local ' +
        'emergency services or a trusted person.'
};

}

// Return a user's assessment history.
async function getAssessmentHistory(userId) {
if (!userId) {
throw new Error('A user ID is required');
}

return attemptRepository.getAssessmentHistory(userId);

}

// Delete one of the current user's attempts.
async function deleteAttempt(attemptId, userId) {
if (!attemptId || !userId) {
throw new Error('An attempt ID and user ID are required');
}

return attemptRepository.deleteAttempt(attemptId, userId);

}

module.exports = {
getAssessments,
getAssessmentById,
startAttempt,
submitAttempt,
getAssessmentHistory,
deleteAttempt
};
