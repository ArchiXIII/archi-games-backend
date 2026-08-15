'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JorVkPaymentsService, jorCallbackSignature } = require('../src/services/jorVkPaymentsService');

const products = {
  item: { title: 'Item', vkVotes: 5, okAmount: 19, durationDays: 0 }
};

function signed(overrides = {}, secret = 'vk-secret') {
  const params = {
    notification_type: 'get_item',
    app_id: '42',
    user_id: '7',
    item: 'item',
    ...overrides
  };
  params.sig = jorCallbackSignature(params, secret);
  return params;
}

function setup() {
  const calls = [];
  const service = new JorVkPaymentsService({
    jorVkAppId: '42',
    jorVkAppSecret: 'vk-secret',
    jorOkVkAppId: '99',
    jorOkAppId: '84',
    jorOkAppSecret: 'ok-secret'
  }, products, {
    async grant(value) {
      calls.push(['grant', value]);
    },
    async refund(platform, orderId) {
      calls.push(['refund', platform, orderId]);
    }
  });
  return { service, calls };
}

test('Jor callback returns platform-specific trusted prices', async () => {
  const { service } = setup();
  assert.equal((await service.process(signed())).price, 5);
  await assert.rejects(service.process(signed({ app_id: '84' }, 'ok-secret')));
});

test('Jor callback grants and refunds only valid orders', async () => {
  const { service, calls } = setup();
  await service.process(signed({
    notification_type: 'order_status_change',
    order_id: '10',
    item_price: '5',
    status: 'chargeable'
  }));
  await service.process(signed({
    notification_type: 'order_status_change',
    order_id: '10',
    item_price: '5',
    status: 'refunded'
  }));
  assert.equal(calls[0][0], 'grant');
  assert.equal(calls[0][1].productId, 'item');
  assert.deepEqual(calls[1], ['refund', 'vk', '10']);
  await assert.rejects(service.process(signed({
    notification_type: 'order_status_change',
    order_id: '11',
    item_price: '1',
    status: 'chargeable'
  })));
});
