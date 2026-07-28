'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LeaderboardService } = require('../src/services/leaderboardService');

test('leaderboard sync forwards stars and name while ignoring legacy XP', async () => {
  const repository = {
    async sync(gameId, platform, userId, totalStars, playerName) {
      assert.deepEqual(
        { gameId, platform, userId, totalStars, playerName },
        {
          gameId: 'crystal-match',
          platform: 'vk',
          userId: '123',
          totalStars: 100,
          playerName: 'Alice Smith'
        }
      );
      return { total_stars: 120 };
    }
  };
  const service = new LeaderboardService(repository);
  assert.deepEqual(
    await service.sync('crystal-match', 'vk', '123', {
      totalStars: 100,
      totalXp: 5000,
      playerName: '  Alice\n\u202ESmith  '
    }),
    { totalStars: 120 }
  );
});

test('legacy totalXp is accepted without validation or persistence', async () => {
  let call;
  const repository = {
    async sync(...args) {
      call = args;
      return { total_stars: args[3] };
    }
  };
  const service = new LeaderboardService(repository);
  const result = await service.sync('crystal-match', 'vk', '123', {
    totalStars: 10,
    totalXp: { ignored: true }
  });
  assert.deepEqual(result, { totalStars: 10 });
  assert.deepEqual(call, ['crystal-match', 'vk', '123', 10, '']);
});

test('empty player name does not request an overwrite', async () => {
  let receivedName;
  const repository = {
    async sync(gameId, platform, userId, totalStars, playerName) {
      receivedName = playerName;
      return { total_stars: totalStars };
    }
  };
  const service = new LeaderboardService(repository);
  await service.sync('crystal-match', 'vk', '123', {
    totalStars: 1,
    totalXp: 2,
    playerName: ' \n\t '
  });
  assert.equal(receivedName, '');
});

test('player name is limited to 80 Unicode characters', async () => {
  let receivedName;
  const repository = {
    async sync(gameId, platform, userId, totalStars, playerName) {
      receivedName = playerName;
      return { total_stars: totalStars };
    }
  };
  const service = new LeaderboardService(repository);
  await service.sync('crystal-match', 'vk', '123', {
    totalStars: 1,
    totalXp: 2,
    playerName: '😀'.repeat(100)
  });
  assert.equal(Array.from(receivedName).length, 80);
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
  await assert.rejects(
    service.sync('crystal-match', 'vk', '123', { playerName: 'Alex' }),
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
          total_stars: 150
        }],
        current: {
          platform_user_id: '123',
          player_name: '123',
          avatar_url: null,
          total_stars: 100
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
    { limit: '20', offset: '5' }
  );
  assert.deepEqual(result.entries[0], {
    rank: 6,
    userId: '456',
    playerName: 'Alex',
    avatarUrl: 'https://example.com/avatar.jpg',
    score: 150,
    totalStars: 150,
    isCurrentUser: false
  });
  assert.equal(result.currentUser.rank, 7);
  assert.equal(result.currentUser.isCurrentUser, true);
});
