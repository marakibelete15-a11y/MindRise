'use strict';

// Authentication routes. SRS FR-1.1, FR-1.2, FR-1.8.
const express = require('express');
const authController = require('../controllers/auth');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  registerSchema,
  verifySchema,
  resendSchema,
  loginSchema,
} = require('../validators/auth.schemas');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/verify', requireAuth, validate(verifySchema), authController.verify);
router.post('/resend-code', requireAuth, validate(resendSchema), authController.resendCode);
router.post('/login', validate(loginSchema), authController.login);

module.exports = router;