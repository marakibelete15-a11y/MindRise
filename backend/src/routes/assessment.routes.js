'use strict';

const express = require('express');
const assessmentController = require('../controllers/assessment');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// Public assessment catalog.
router.get('/assessments', assessmentController.getAssessments);
router.get('/assessments/history', requireAuth, assessmentController.getAssessmentHistory);
router.get('/assessments/:assessmentId', assessmentController.getAssessmentById);

// Authenticated assessment operations.
router.post(
'/assessments/:assessmentId/attempts',
requireAuth,
assessmentController.startAttempt
);

router.post(
'/assessments/attempts/:attemptId/submit',
requireAuth,
assessmentController.submitAttempt
);

router.delete(
'/assessments/attempts/:attemptId',
requireAuth,
assessmentController.deleteAttempt
);

module.exports = router;
