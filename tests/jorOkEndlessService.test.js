'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JorOkEndlessService } = require('../src/services/jorOkEndlessService');

test('Jor OK score returns an isolated top ten and trusted player row', async () => {
  let call;
  const service = new JorOkEndlessService({
    async sync(...args) {
      call = args;
      return [
        { platform_user_id: '7', player_name: 'Top', best_score: 900 },
        { platform_user_id: '42', player_name: 'Player', best_score: 700 }
      ];
    }
  });
  const result = await service.sync('42', { score: 700, playerName: ' Player ' });
  assert.deepEqual(call, ['42', 700, 'Player']);
  assert.equal(result.entries.length, 2);
  assert.equal(result.currentUser.rank, 2);
  assert.equal(result.bestScore, 700);
  assert.equal(result.limit, 10);
});

test('Jor OK score rejects invalid requests', async () => {
  const service = new JorOkEndlessService({});
  for (const body of [{}, { score: -1 }, { score: 1.5 }, { score: '10' }, { score: 1, extra: true }]) {
    await assert.rejects(service.sync('42', body), (cause) => cause.code === 'INVALID_REQUEST');
  }
});

test('Jor OK list does not expose rows outside the dedicated repository result', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    platform_user_id: String(index + 1),
    player_name: `P${index + 1}`,
    best_score: 100 - index
  }));
  const service = new JorOkEndlessService({ async list() { return rows; } });
  const result = await service.list('15');
  assert.equal(result.entries.length, 10);
  assert.equal(result.currentUser, null);
  assert.equal(result.offset, 0);
});
