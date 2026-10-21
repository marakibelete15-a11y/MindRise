'use strict';

const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const rateLimit = require('./middleware/rateLimit');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit);
app.use('/api', require('./routes'));

if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.resolve(__dirname, '../../frontend')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;