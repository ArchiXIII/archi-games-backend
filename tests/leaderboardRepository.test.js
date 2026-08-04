'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('missing leaderboard row is filtered from a valid YDB source', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'repositories', 'leaderboardRepository.js'),
    'utf8'
  );
  assert.match(
    source,
    /FROM \(VALUES \(1\)\) AS seed\(dummy\)\s+WHERE NOT EXISTS \(/
  );
  assert.match(source, /total_stars = MAX_OF\(total_stars, \$total_stars\)/);
  assert.match(source, /\$total_stars > total_stars/);
  assert.match(source, /\$player_name != COALESCE\(player_name, ""\)/);
  assert.doesNotMatch(source, /\$total_xp|total_xp = MAX_OF/);
  assert.match(source, /\$total_stars, 0, CurrentUtcTimestamp\(\)/);
});

test('migration 004 removes the unused XP leaderboard index', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '004_drop_unused_xp_index.sql'),
    'utf8'
  );
  assert.match(source, /ALTER TABLE leaderboard_totals DROP INDEX idx_leaderboard_xp/);
});
