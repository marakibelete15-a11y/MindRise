'use strict';

// Mounts API feature routers and database health endpoint. SRS FR-1.x through FR-7.x. TODO: implement planned handlers.
const express = require('express');
const healthRepository = require('../repositories/healthRepository');

const router = express.Router();
router.get('/health', async (_request, response) => {
  try {
    await healthRepository.check();
    response.json({ status: 'ok', database: 'connected' });
  } catch (_error) {
    response.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

router.use('/auth', require('./auth.routes'));
router.use('/', require('./me.routes'));
router.use('/', require('./assessment.routes'));
router.use('/', require('./routine.routes'));
router.use('/', require('./community.routes'));
router.use('/', require('./resource.routes'));
router.use('/', require('./moderation.routes'));
router.use('/', require('./notification.routes'));

module.exports = router;