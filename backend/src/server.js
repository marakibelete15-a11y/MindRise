'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`MindRise backend listening on port ${port}`);
});