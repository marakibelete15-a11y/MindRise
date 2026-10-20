'use strict';

// Safe application error type. SRS FR-1.x, FR-4.x, FR-7.x. TODO: define approved public codes/messages.
class AppError extends Error {
  constructor(statusCode, code, safeMessage, data = null) {
    super(safeMessage);
    this.statusCode = statusCode;
    this.publicCode = code;
    this.safeMessage = safeMessage;
    if (data) {
      if (Array.isArray(data)) {
        this.details = data;
      } else if (data.details) {
        this.details = data.details;
      } else {
        this.data = data;
      }
    }
  }
}

module.exports = AppError;