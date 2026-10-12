'use strict';

// Database connectivity query used by the health endpoint. SRS FR-5.4. TODO: add readiness checks as needed.
const pool = require('../config/db');

module.exports = {
	check: () => pool.query('SELECT 1'),
	endPool: () => pool.end(),
};