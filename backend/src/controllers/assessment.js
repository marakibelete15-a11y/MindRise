'use strict';

const assessmentService = require('../services/assessmentService');

// Get the authenticated user's ID.
// The authentication middleware must set req.user.
function getUserId(req) {
return req.user?.id || req.user?.userId || null;
}

// GET /api/assessments
async function getAssessments(req, res, next) {
try {
const assessments = await assessmentService.getAssessments();

    res.status(200).json({ assessments });
} catch (error) {
    next(error);
}

}

// GET /api/assessments/:assessmentId
async function getAssessmentById(req, res, next) {
try {
const assessment = await assessmentService.getAssessmentById(
req.params.assessmentId
);

    if (!assessment) {
        return res.status(404).json({
            error: 'Assessment not found'
        });
    }

    return res.status(200).json({ assessment });
} catch (error) {
    return next(error);
}

}

// POST /api/assessments/:assessmentId/attempts
async function startAttempt(req, res, next) {
try {
const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    const attempt = await assessmentService.startAttempt(
        userId,
        req.params.assessmentId
    );

    if (!attempt) {
        return res.status(404).json({
            error: 'Assessment not found'
        });
    }

    return res.status(201).json({ attempt });
} catch (error) {
    return next(error);
}

}

// POST /api/assessments/attempts/:attemptId/submit
async function submitAttempt(req, res, next) {
try {
const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    const result = await assessmentService.submitAttempt({
        attemptId: req.params.attemptId,
        userId,
        answers: req.body.answers
    });

    if (!result) {
        return res.status(404).json({
            error: 'Assessment attempt not found or unavailable'
        });
    }

    return res.status(200).json(result);
} catch (error) {
    return next(error);
}

}

// GET /api/assessments/history
async function getAssessmentHistory(req, res, next) {
try {
const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    const history = await assessmentService.getAssessmentHistory(userId);

    return res.status(200).json({ history });
} catch (error) {
    return next(error);
}


}

// DELETE /api/assessments/attempts/:attemptId
async function deleteAttempt(req, res, next) {
try {
const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    const deleted = await assessmentService.deleteAttempt(
        req.params.attemptId,
        userId
    );

    if (!deleted) {
        return res.status(404).json({
            error: 'Assessment attempt not found'
        });
    }

    return res.status(200).json({
        message: 'Assessment attempt deleted successfully'
    });
} catch (error) {
    return next(error);
}

}

module.exports = {
getAssessments,
getAssessmentById,
startAttempt,
submitAttempt,
getAssessmentHistory,
deleteAttempt
};
