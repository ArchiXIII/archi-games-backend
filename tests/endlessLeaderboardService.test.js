'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EndlessLeaderboardService } = require('../src/services/endlessLeaderboardService');

function repositoryWithRows(initialRows, onSync) {
  let stored = (initialRows || []).map((row) => ({ ...row }));
  return {
    async list(gameId, platform, limit, offset) {
      return {
        entries: stored.slice().sort((left, right) =>
          right.best_score - left.best_score ||
          String(left.platform_user_id).localeCompare(String(right.platform_user_id))
        ).slice(offset, offset + limit)
      };
    },
    async sync(gameId, platform, userId, bestScore, playerName) {
      if (onSync) onSync(gameId, platform, userId, bestScore, playerName);
      const current = stored.find((row) => String(row.platform_user_id) === userId);
      if (current) {
        current.best_score = Math.max(current.best_score, bestScore);
        if (playerName) current.player_name = playerName;
      } else {
        stored.push({
          platform_user_id: userId,
          player_name: playerName || userId,
          best_score: bestScore
        });
      }
      return { best_score: bestScore };
    },
    async remove(gameId, platform, userId) {
      stored = stored.filter((row) => String(row.platform_user_id) !== userId);
      return true;
    }
  };
}

test('endless score sync forwards trusted identity, score and cleaned name', async () => {
  let call;
  const service = new EndlessLeaderboardService(repositoryWithRows([], (...args) => { call = args; }));
  const result = await service.sync('crystal-match', 'ok', '456', {
    score: 24685,
    playerName: '  Alex\nSmith  '
  });
  assert.deepEqual(call, ['crystal-match', 'ok', '456', 24685, 'Alex Smith']);
  assert.equal(result.bestScore, 24685);
  assert.equal(result.qualified, true);
  assert.equal(result.currentUser.userId, '456');
});

test('endless score sync rejects invalid bodies', async () => {
  const service = new EndlessLeaderboardService({});
  for (const body of [
    {},
    { score: -1 },
    { score: 1.5 },
    { score: '10' },
    { score: 10, extra: true }
  ]) {
    await assert.rejects(
      service.sync('crystal-match', 'ok', '456', body),
      (cause) => cause.code === 'INVALID_REQUEST'
    );
  }
});

test('endless leaderboard response includes best score and current user rank', async () => {
  const service = new EndlessLeaderboardService({
    async list(gameId, platform, limit, offset) {
      assert.deepEqual(
        { gameId, platform, limit, offset },
        {
          gameId: 'crystal-match',
          platform: 'ok',
          limit: 20,
          offset: 5
        }
      );
      return {
        entries: [{
          platform_user_id: '789',
          player_name: 'Player',
          best_score: 30000
        }, {
          platform_user_id: '456',
          player_name: 'Alex',
          best_score: 24685
        }]
      };
    }
  });
  const result = await service.list(
    'crystal-match',
    'ok',
    '456',
    { limit: '20', offset: '5' }
  );
  assert.deepEqual(result.entries[0], {
    rank: 6,
    userId: '789',
    playerName: 'Player',
    score: 30000,
    bestScore: 30000,
    isCurrentUser: false
  });
  assert.equal(result.currentUser.rank, 7);
  assert.equal(result.currentUser.isCurrentUser, true);
});

test('endless score below the top ten is not persisted', async () => {
  let calls = 0;
  const rows = Array.from({ length: 10 }, (_, index) => ({
    platform_user_id: String(index + 1),
    player_name: String(index + 1),
    best_score: 1000 - index
  }));
  const service = new EndlessLeaderboardService(repositoryWithRows(rows, () => { calls++; }));
  const result = await service.sync('crystal-match', 'ok', 'weak', {
    score: 100,
    playerName: 'Weak'
  });
  assert.equal(result.qualified, false);
  assert.equal(result.entries.length, 10);
  assert.equal(calls, 0);
});

test('qualifying endless score replaces the eleventh row', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    platform_user_id: String(index + 1),
    player_name: String(index + 1),
    best_score: 1000 - index
  }));
  const service = new EndlessLeaderboardService(repositoryWithRows(rows));
  const result = await service.sync('crystal-match', 'ok', 'winner', {
    score: 2000,
    playerName: 'Winner'
  });
  assert.equal(result.qualified, true);
  assert.equal(result.entries.length, 10);
  assert.equal(result.entries[0].userId, 'winner');
  assert.equal(result.entries.some((entry) => entry.userId === '10'), false);
});
