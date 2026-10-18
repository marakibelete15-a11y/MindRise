'use strict';

// Schema validation middleware factory. SRS FR-1.1, FR-1.2, FR-4.x.
const AppError = require('../utils/AppError');

/**
 * Creates an Express middleware that validates request body, query, and params using Zod.
 * SRS FR-1.x, FR-4.x: Request input validation.
 *
 * @param {object} schema - Zod schema or { body, query, params } schema map
 * @returns {Function} Express middleware
 */
module.exports = function validate(schema) {
  return function validationMiddleware(req, _res, next) {
    const errors = [];

    const isDirectZod = schema && typeof schema.safeParse === 'function';

    if (isDirectZod) {
      const shape = schema.shape;
      if (shape && (shape.body || shape.query || shape.params)) {
        const result = schema.safeParse({
          body: req.body || {},
          query: req.query || {},
          params: req.params || {},
        });
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({
              field: issue.path.join('.'),
              message: issue.message,
            });
          }
        } else {
          if (shape.body) req.body = result.data.body;
          if (shape.query) req.query = result.data.query;
          if (shape.params) req.params = result.data.params;
        }
      } else {
        const result = schema.safeParse(req.body || {});
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            });
          }
        } else {
          req.body = result.data;
        }
      }
    } else if (schema && typeof schema === 'object') {
      const targets = ['body', 'query', 'params'];
      for (const target of targets) {
        if (schema[target] && typeof schema[target].safeParse === 'function') {
          const result = schema[target].safeParse(req[target] || {});
          if (!result.success) {
            for (const issue of result.error.issues) {
              const fieldPath = issue.path.length > 0 ? issue.path.join('.') : target;
              errors.push({
                field: fieldPath,
                message: issue.message,
              });
            }
          } else {
            req[target] = result.data;
          }
        }
      }
    }

    if (errors.length > 0) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', { details: errors }));
    }

    return next();
  };
};