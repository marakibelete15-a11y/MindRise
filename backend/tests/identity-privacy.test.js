'use strict';

// Privacy contract test for public responses. SRS FR-1.x, FR-4.5, 5.4. TODO: assert no identity keys in all other-user responses.
const test = require('node:test');

test.todo('no response to another user contains first_name, last_name, email, or phone');