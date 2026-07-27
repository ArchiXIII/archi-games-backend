'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LeaderboardService } = require('../src/services/leaderboardService');

test('leaderboard sync forwards both monotonic totals', async () => {
  const repository = {
    async sync(gameId, platform, userId, totalStars, totalXp) {
      assert.deepEqual(
        { gameId, platform, userId, totalStars, totalXp },
        {
          gameId: 'crystal-match',
          platform: 'vk',
          userId: '123',
          totalStars: 100,
          totalXp: 5000
        }
      );
      return { total_stars: 120, total_xp: 5000 };
    }
  };
  const service = new LeaderboardService(repository);
  assert.deepEqual(
    await service.sync('crystal-match', 'vk', '123', { totalStars: 100, totalXp: 5000 }),
    { totalStars: 120, totalXp: 5000 }
  );
});

test('leaderboard sync rejects invalid totals and extra fields', async () => {
  const service = new LeaderboardService({});
  await assert.rejects(
    service.sync('crystal-match', 'vk', '123', { totalStars: -1, totalXp: 0 }),
    (cause) => cause.code === 'INVALID_REQUEST'
  );
  await assert.rejects(
    service.sync('crystal-match', 'vk', '123', { totalStars: 1, totalXp: 2, coins: 3 }),
    (cause) => cause.code === 'INVALID_REQUEST'
  );
});

test('leaderboard response matches Crystal Match client contract', async () => {
  const repository = {
    async list() {
      return {
        entries: [{
          platform_user_id: '456',
          player_name: 'Alex',
          avatar_url: 'https://example.com/avatar.jpg',
          total_stars: 150,
          total_xp: 7000
        }],
        current: {
          platform_user_id: '123',
          player_name: '123',
          avatar_url: null,
          total_stars: 100,
          total_xp: 5000
        },
        rank: 7
      };
    }
  };
  const service = new LeaderboardService(repository);
  const result = await service.list(
    'crystal-match',
    'vk',
    '123',
    'stars',
    { limit: '20', offset: '5' }
  );
  assert.deepEqual(result.entries[0], {
    rank: 6,
    userId: '456',
    playerName: 'Alex',
    avatarUrl: 'https://example.com/avatar.jpg',
    score: 150,
    totalStars: 150,
    totalXp: 7000,
    isCurrentUser: false
  });
  assert.equal(result.currentUser.rank, 7);
  assert.equal(result.currentUser.isCurrentUser, true);
});
