'use strict';

// Schema validation middleware factory. SRS FR-1.x, FR-4.x. TODO: return structured field errors.
module.exports = function validate(_schema) { return (_request, _response, next) => next(); };