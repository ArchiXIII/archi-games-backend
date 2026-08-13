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
  assert.match(source, /\$best_score > best_score/);
  assert.match(source, /\$player_name != COALESCE\(player_name, ""\)/);
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

test('Jor OK leaderboard uses a separate top-ten table', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '007_jor_ok_endless_top.sql'),
    'utf8'
  );
  const repository = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'repositories', 'jorOkEndlessRepository.js'),
    'utf8'
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS jor_ok_endless_top/);
  assert.match(migration, /PRIMARY KEY \(platform_user_id\)/);
  assert.match(repository, /LIMIT 1000 OFFSET 10/);
  assert.match(repository, /best_score = MAX_OF\(best_score, \$best_score\)/);
  assert.doesNotMatch(repository, /endless_leaderboard\s/);
});
