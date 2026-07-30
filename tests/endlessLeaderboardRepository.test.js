'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('endless leaderboard uses monotonic score and valid YDB insert source', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'repositories', 'endlessLeaderboardRepository.js'),
    'utf8'
  );
  assert.match(source, /best_score = MAX_OF\(best_score, \$best_score\)/);
  assert.match(source, /WHEN \$best_score > best_score THEN CurrentUtcTimestamp\(\)/);
  assert.match(
    source,
    /FROM \(VALUES \(1\)\) AS seed\(dummy\)\s+WHERE NOT EXISTS \(/
  );
  assert.match(source, /WHERE game_id = \$game_id AND platform = \$platform/);
});

test('migration 003 creates a platform-separated endless leaderboard', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '003_ok_endless_leaderboard.sql'),
    'utf8'
  );
  assert.match(source, /platform Utf8 NOT NULL/);
  assert.match(source, /best_score Int64 NOT NULL/);
  assert.match(source, /PRIMARY KEY \(game_id, platform, platform_user_id\)/);
  assert.match(source, /INDEX idx_endless_score GLOBAL/);
});
