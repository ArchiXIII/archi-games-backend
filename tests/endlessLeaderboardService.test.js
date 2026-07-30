'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EndlessLeaderboardService } = require('../src/services/endlessLeaderboardService');

test('endless score sync forwards trusted identity, score and cleaned name', async () => {
  let call;
  const service = new EndlessLeaderboardService({
    async sync(...args) {
      call = args;
      return { best_score: 25000 };
    }
  });
  const result = await service.sync('crystal-match', 'ok', '456', {
    score: 24685,
    playerName: '  Alex\nSmith  '
  });
  assert.deepEqual(call, ['crystal-match', 'ok', '456', 24685, 'Alex Smith']);
  assert.deepEqual(result, { bestScore: 25000 });
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
  const updatedAt = new Date('2026-07-30T10:00:00.000Z');
  const service = new EndlessLeaderboardService({
    async list(gameId, platform, userId, limit, offset) {
      assert.deepEqual(
        { gameId, platform, userId, limit, offset },
        {
          gameId: 'crystal-match',
          platform: 'ok',
          userId: '456',
          limit: 20,
          offset: 5
        }
      );
      return {
        entries: [{
          platform_user_id: '789',
          player_name: 'Player',
          best_score: 30000,
          updated_at: updatedAt
        }],
        current: {
          platform_user_id: '456',
          player_name: 'Alex',
          best_score: 24685,
          updated_at: updatedAt
        },
        rank: 7
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
    updatedAt: '2026-07-30T10:00:00.000Z',
    isCurrentUser: false
  });
  assert.equal(result.currentUser.rank, 7);
  assert.equal(result.currentUser.isCurrentUser, true);
});
