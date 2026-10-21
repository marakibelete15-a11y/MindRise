'use strict';

// Authentication routes. SRS FR-1.1, FR-1.2, FR-1.8.
const express = require('express');
const authController = require('../controllers/auth');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  signupLimiter,
  loginLimiter,
  otpVerifyLimiter,
  recoveryLimiter,
} = require('../middleware/rateLimit');
const {
  registerSchema,
  verifySchema,
  resendSchema,
  loginSchema,
  recoverRequestSchema,
  recoverConfirmSchema,
} = require('../validators/auth.schemas');

const router = express.Router();

router.post('/register', signupLimiter, validate(registerSchema), authController.register);
router.post('/verify', requireAuth, otpVerifyLimiter, validate(verifySchema), authController.verify);
router.post('/resend-code', requireAuth, validate(resendSchema), authController.resendCode);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/recover/request', recoveryLimiter, validate(recoverRequestSchema), authController.recoverRequest);
router.post('/recover/confirm', validate(recoverConfirmSchema), authController.recoverConfirm);

module.exports = router;