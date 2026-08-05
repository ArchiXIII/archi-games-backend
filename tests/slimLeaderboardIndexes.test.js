'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { statements } = require('../src/db/migrations');

test('leaderboard indexes cover only displayed names', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '005_slim_leaderboard_indexes.sql'),
    'utf8'
  );
  assert.match(sql, /idx_leaderboard_stars[\s\S]*COVER \(player_name\)/);
  assert.match(sql, /idx_endless_score[\s\S]*COVER \(player_name\)/);
  assert.doesNotMatch(sql, /avatar_url|total_xp|updated_at/);
});

test('stars leaderboard migration keeps only top ten and removes its index', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '006_keep_stars_top10.sql'),
    'utf8'
  );
  assert.match(sql, /ROW_NUMBER\(\) OVER/);
  assert.match(sql, /WHERE position > 10/);
  assert.match(sql, /DELETE FROM leaderboard_totals ON/);
  assert.match(sql, /DROP INDEX idx_leaderboard_stars/);
  const migrationStatements = statements(sql);
  assert.equal(migrationStatements.length, 2);
  assert.match(migrationStatements[0], /DELETE[\s\S]*ROW_NUMBER/);
});
