'use strict';

const express = require('express');
const resourceService = require('../services/resourceService');
const crisisService = require('../services/crisisService');

const router = express.Router();

function getResourceOptions(req) {
return {
language: req.query.language || 'en',
region: req.query.region || 'ET'
};
}

// GET /api/resources?language=en&region=ET
router.get('/resources', async (req, res, next) => {
try {
const options = getResourceOptions(req);
const resources = await resourceService.getResources(options);

    res.json({ resources });
} catch (error) {
    next(error);
}

});

// GET /api/resources/crisis?language=en&region=ET
router.get('/resources/crisis', async (req, res, next) => {
try {
const options = getResourceOptions(req);
const resources = await resourceService.getCrisisResources(options);

    res.json({ resources });
} catch (error) {
    next(error);
}

});

module.exports = router;
