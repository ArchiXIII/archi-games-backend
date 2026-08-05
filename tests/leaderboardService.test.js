'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LeaderboardService } = require('../src/services/leaderboardService');

function repositoryWithRows(initialRows, onSync) {
  let stored = (initialRows || []).map((row) => ({ ...row }));
  return {
    async list(gameId, platform, limit, offset) {
      const entries = stored
        .slice()
        .sort((left, right) => right.total_stars - left.total_stars ||
          String(left.platform_user_id).localeCompare(String(right.platform_user_id)))
        .slice(offset, offset + limit);
      return { entries };
    },
    async sync(gameId, platform, userId, totalStars, playerName) {
      if (onSync) onSync(gameId, platform, userId, totalStars, playerName);
      const current = stored.find((row) => String(row.platform_user_id) === userId);
      if (current) {
        current.total_stars = Math.max(current.total_stars, totalStars);
        if (playerName) current.player_name = playerName;
      } else {
        stored.push({
          platform_user_id: userId,
          player_name: playerName || userId,
          total_stars: totalStars
        });
      }
      return { total_stars: totalStars };
    },
    async remove(gameId, platform, userId) {
      stored = stored.filter((row) => String(row.platform_user_id) !== userId);
      return true;
    }
  };
}

test('leaderboard sync forwards stars and name while ignoring legacy XP', async () => {
  const repository = repositoryWithRows([], (gameId, platform, userId, totalStars, playerName) => {
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
  });
  const service = new LeaderboardService(repository);
  const result = await service.sync('crystal-match', 'vk', '123', {
      totalStars: 100,
      totalXp: 5000,
      playerName: '  Alice\n\u202ESmith  '
  });
  assert.equal(result.totalStars, 100);
  assert.equal(result.qualified, true);
  assert.equal(result.currentUser.userId, '123');
});

test('legacy totalXp is accepted without validation or persistence', async () => {
  let call;
  const repository = repositoryWithRows([], (...args) => { call = args; });
  const service = new LeaderboardService(repository);
  const result = await service.sync('crystal-match', 'vk', '123', {
    totalStars: 10,
    totalXp: { ignored: true }
  });
  assert.equal(result.totalStars, 10);
  assert.equal(result.qualified, true);
  assert.deepEqual(call, ['crystal-match', 'vk', '123', 10, '']);
});

test('empty player name does not request an overwrite', async () => {
  let receivedName;
  const repository = repositoryWithRows([], (gameId, platform, userId, totalStars, playerName) => {
    receivedName = playerName;
  });
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
  const repository = repositoryWithRows([], (gameId, platform, userId, totalStars, playerName) => {
    receivedName = playerName;
  });
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
          total_stars: 150
        }, {
          platform_user_id: '123',
          player_name: '123',
          total_stars: 100
        }]
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
    score: 150,
    totalStars: 150,
    isCurrentUser: false
  });
  assert.equal(result.currentUser.rank, 7);
  assert.equal(result.currentUser.isCurrentUser, true);
});

test('score below the top ten is not persisted', async () => {
  let calls = 0;
  const rows = Array.from({ length: 10 }, (_, index) => ({
    platform_user_id: String(index + 1),
    player_name: String(index + 1),
    total_stars: 100 - index
  }));
  const service = new LeaderboardService(repositoryWithRows(rows, () => { calls++; }));
  const body = { totalStars: 50, playerName: 'Alex' };
  const first = await service.sync('crystal-match', 'ok', '123', body);
  const second = await service.sync('crystal-match', 'ok', '123', body);
  assert.equal(first.qualified, false);
  assert.equal(second.qualified, false);
  assert.equal(calls, 0);
});

test('qualifying score replaces the eleventh row and keeps ten entries', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    platform_user_id: String(index + 1),
    player_name: String(index + 1),
    total_stars: 100 - index
  }));
  const service = new LeaderboardService(repositoryWithRows(rows));
  const result = await service.sync('crystal-match', 'ok', 'winner', {
    totalStars: 150,
    playerName: 'Winner'
  });
  assert.equal(result.qualified, true);
  assert.equal(result.entries.length, 10);
  assert.equal(result.entries[0].userId, 'winner');
  assert.equal(result.entries.some((item) => item.userId === '10'), false);
});

test('leaderboard top is shared between users in memory cache', async () => {
  let calls = 0;
  const service = new LeaderboardService({
    async list() {
      calls++;
      return { entries: [], current: null, rank: null };
    }
  });
  const query = { limit: '20', offset: '0' };
  await service.list('crystal-match', 'ok', '123', query);
  await service.list('crystal-match', 'ok', '456', query);
  assert.equal(calls, 1);
});
