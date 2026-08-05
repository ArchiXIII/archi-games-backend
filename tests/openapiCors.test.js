'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('API Gateway CORS allows the client protocol header', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8');
  const cors = source.slice(0, source.indexOf('components:'));
  assert.match(cors, /allowedHeaders:[\s\S]*- X-Client-Version/);
});
