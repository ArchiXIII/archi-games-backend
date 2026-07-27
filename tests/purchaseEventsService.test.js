'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PurchaseEventsService } = require('../src/services/purchaseEventsService');

test('pending purchase events are scoped to the current user', async () => {
  const repository = {
    async pending(gameId, platform, userId) {
      assert.deepEqual(
        { gameId, platform, userId },
        { gameId: 'crystal-match', platform: 'vk', userId: '123' }
      );
      return [{
        eventId: `grant_${'a'.repeat(64)}`,
        orderId: 'order-1',
        type: 'grant',
        coinsDelta: 10000
      }];
    }
  };
  const service = new PurchaseEventsService(repository);
  const events = await service.pending('crystal-match', 'vk', '123');
  assert.equal(events[0].coinsDelta, 10000);
});

test('purchase event ACK is repeat-safe and user-scoped', async () => {
  const calls = [];
  const repository = {
    async ack(...args) {
      calls.push(args);
    }
  };
  const service = new PurchaseEventsService(repository);
  const eventId = `refund_${'b'.repeat(64)}`;
  await service.ack('crystal-match', 'vk', '123', { eventId });
  await service.ack('crystal-match', 'vk', '123', { eventId });
  assert.deepEqual(calls, [
    ['crystal-match', 'vk', '123', eventId],
    ['crystal-match', 'vk', '123', eventId]
  ]);
});
