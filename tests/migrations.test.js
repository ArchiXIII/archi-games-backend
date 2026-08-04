'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { alreadyRemoved } = require('../src/db/migrations');

test('a previously removed index is safe to migrate again', () => {
  const statement = 'ALTER TABLE leaderboard_totals DROP INDEX idx_leaderboard_xp';
  assert.equal(alreadyRemoved(new Error('Path does not exist'), statement), true);
  assert.equal(alreadyRemoved(new Error('Unrelated failure'), statement), false);
  assert.equal(alreadyRemoved(new Error('Path does not exist'), 'SELECT 1'), false);
});
