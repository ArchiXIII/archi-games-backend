'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('order event inserts use valid YDB row sources', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'repositories', 'ordersRepository.js'),
    'utf8'
  );
  assert.equal(
    source.match(/FROM \(VALUES \(1\)\) AS seed\(dummy\)\s+WHERE \$is_new;/g).length,
    3
  );
});
