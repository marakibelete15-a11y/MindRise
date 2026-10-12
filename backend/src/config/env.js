'use strict';

// Reads and validates process environment once for configuration. SRS FR-1.x, FR-4.x, FR-7.x. TODO: validate deployment-specific settings.
const requiredInProduction = ['JWT_SECRET', 'DB_PASSWORD'];
if (process.env.NODE_ENV === 'production') {
  const missing = requiredInProduction.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5500',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 5432),
  dbName: process.env.DB_NAME || 'mindrise_dev',
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  uploadDir: process.env.UPLOAD_DIR || 'uploads/avatars',
});