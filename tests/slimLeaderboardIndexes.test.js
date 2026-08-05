'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('leaderboard indexes cover only displayed names', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '005_slim_leaderboard_indexes.sql'),
    'utf8'
  );
  assert.match(sql, /idx_leaderboard_stars[\s\S]*COVER \(player_name\)/);
  assert.match(sql, /idx_endless_score[\s\S]*COVER \(player_name\)/);
  assert.doesNotMatch(sql, /avatar_url|total_xp|updated_at/);
});
