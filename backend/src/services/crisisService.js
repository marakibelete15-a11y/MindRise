'use strict';

const crisisRepository = require('../repositories/crisisRepository');

// Allowed sources that can create a crisis flag.
const ALLOWED_SOURCES = ['assessment', 'post', 'comment'];

// Create a crisis flag after a potential safety concern is identified.
async function raiseFlag({
userId,
source,
attemptId = null,
postId = null,
commentId = null
}) {
if (!userId) {
throw new Error('userId is required');
}

if (!ALLOWED_SOURCES.includes(source)) {
    throw new Error('Invalid crisis flag source');
}

// Each source must match its corresponding database record.
const sourceIds = {
    assessment: attemptId,
    post: postId,
    comment: commentId
};

if (!sourceIds[source]) {
    throw new Error(`A record ID is required for source: ${source}`);
}

// A flag must not reference records from multiple sources.
const suppliedIds = [attemptId, postId, commentId]
    .filter((id) => id !== null && id !== undefined);

if (suppliedIds.length !== 1) {
    throw new Error('A crisis flag must reference exactly one source record');
}

return crisisRepository.createFlag({
    userId,
    source,
    attemptId,
    postId,
    commentId
});

}

// Retrieve active flags.
// The route must restrict this operation to authorized reviewers.
async function getActiveFlags() {
return crisisRepository.getActiveFlags();
}

// Allow a user to acknowledge their own crisis flag.
async function acknowledgeFlag(flagId, userId) {
if (!flagId || !userId) {
throw new Error('flagId and userId are required');
}

return crisisRepository.acknowledgeFlag(flagId, userId);

}

module.exports = {
raiseFlag,
getActiveFlags,
acknowledgeFlag
};
