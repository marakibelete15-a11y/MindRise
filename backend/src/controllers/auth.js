'use strict';

// Authentication request handlers. SRS FR-1.1, FR-1.2, FR-1.8.
const authService = require('../services/authService');

/**
 * Handles user registration.
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handles challenge code verification.
 * POST /api/auth/verify
 */
async function verify(req, res, next) {
  try {
    const result = await authService.verify(req.user.id, req.body.code);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handles verification code resend.
 * POST /api/auth/resend-code
 */
async function resendCode(req, res, next) {
  try {
    const result = await authService.resendCode(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handles user login.
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const result = await authService.login(req.body.identifier, req.body.password);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handles account recovery request.
 * POST /api/auth/recover/request
 * Always returns 202.
 */
async function recoverRequest(req, res, next) {
  try {
    const result = await authService.requestRecovery(req.body.identifier);
    return res.status(202).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handles account recovery confirmation.
 * POST /api/auth/recover/confirm
 */
async function recoverConfirm(req, res, next) {
  try {
    const result = await authService.confirmRecovery(
      req.body.identifier,
      req.body.code,
      req.body.newPassword
    );
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  verify,
  resendCode,
  login,
  recoverRequest,
  recoverConfirm,
};