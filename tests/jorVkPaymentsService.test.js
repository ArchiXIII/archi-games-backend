'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JorVkPaymentsService, jorCallbackSignature } = require('../src/services/jorVkPaymentsService');

const products = {
  item: { titleRu: '\u0422\u043e\u0432\u0430\u0440', titleEn: 'Item', vkVotes: 5, okAmount: 19, durationDays: 0 }
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
    jorOkVkAppSecret: 'ok-vk-secret',
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
  assert.equal((await service.process(signed({ app_id: '84' }, 'ok-secret'))).price, 19);
  assert.equal((await service.process(signed({ app_id: '99' }, 'ok-vk-secret'))).price, 19);
});

test('Jor callback grants OK orders through the linked application', async () => {
  const { service, calls } = setup();
  await service.process(signed({
    notification_type: 'order_status_change',
    app_id: '84',
    order_id: '13',
    item: 'item__ru',
    item_price: '19',
    status: 'chargeable'
  }, 'ok-secret'));
  assert.equal(calls[0][1].platform, 'ok');
  assert.equal(calls[0][1].productId, 'item');
});

test('Jor callback localizes titles and keeps the base product ID', async () => {
  const { service, calls } = setup();
  assert.equal((await service.process(signed({ item: 'item__ru' }))).title, '\u0422\u043e\u0432\u0430\u0440');
  assert.equal((await service.process(signed({ item: 'item__en' }))).title, 'Item');
  await service.process(signed({
    notification_type: 'order_status_change',
    order_id: '12',
    item: 'item__ru',
    item_price: '5',
    status: 'chargeable'
  }));
  assert.equal(calls[0][1].productId, 'item');
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
