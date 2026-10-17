'use strict';

const resourceRepository = require('../repositories/resourceRepository');

async function getResources(options = {}) {
return resourceRepository.getResources(options);
}

async function getCrisisResources(options = {}) {
return resourceRepository.getCrisisResources(options);
}

module.exports = {
getResources,
getCrisisResources
};
