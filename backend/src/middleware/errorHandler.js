'use strict';

// Normalizes HTTP and PostgreSQL errors. SRS FR-1.x, FR-4.x, FR-7.x. TODO: finalize public error catalog.
module.exports = function errorHandler(error, _request, response, _next) {
  const pgStatuses = { '23505': 409, '23514': 400, '23503': 409 };
  const statusCode = pgStatuses[error.code] || error.statusCode || 500;
  const code = error.publicCode || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = statusCode === 500 ? 'An unexpected error occurred.' : (error.safeMessage || 'The request could not be completed.');
  const errorPayload = { code, message };
  if (error.data) {
    errorPayload.data = error.data;
  }
  if (error.details) {
    errorPayload.details = error.details;
  }
  response.status(statusCode).json({ error: errorPayload });
};