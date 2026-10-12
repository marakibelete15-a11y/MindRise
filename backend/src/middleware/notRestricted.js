'use strict';

// Temporary posting restriction gate placeholder. SRS FR-7.5, FR-7.7. TODO: enforce users.restricted_until.
module.exports = function notRestricted(_request, _response, next) { next(); };