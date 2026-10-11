'use strict';

const express = require('express');
const path = require('node:path');
const pool = require('./config/db');

const app = express();

app.use(express.json());

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (_error) {
    response.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.resolve(__dirname, '../../frontend')));
}

module.exports = app;