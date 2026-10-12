'use strict';

// Returns a consistent unknown-route response. SRS FR-1.x, FR-4.x, FR-7.x. TODO: add route-specific guidance.
module.exports = function notFound(_request, response) {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
};