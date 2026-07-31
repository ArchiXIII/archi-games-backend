'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCTS } = require('../src/config');
const { ProductsService } = require('../src/services/productsService');
const {
  VkPaymentsService,
  callbackSignature
} = require('../src/services/vkPaymentsService');

function signed(params, secret) {
  const result = { ...params };
  result.sig = callbackSignature(result, secret);
  return result;
}

function setup() {
  const calls = [];
  const config = {
    gameId: 'crystal-match',
    vkAppId: '42',
    vkAppSecret: 'vk-secret',
    okVkAppId: '99',
    okVkAppSecret: 'ok-vk-secret',
    okAppId: '84',
    okAppSecret: 'ok-secret'
  };
  const purchaseService = {
    async grant(input) {
      calls.push({ type: 'grant', input });
    },
    async refund(input) {
      calls.push({ type: 'refund', input });
    }
  };
  return {
    calls,
    service: new VkPaymentsService(
      config,
      new ProductsService(PRODUCTS),
      purchaseService
    )
  };
}

test('OK get_item returns configured product and price', async () => {
  const { service } = setup();
  const result = await service.process(signed({
    notification_type: 'get_item',
    app_id: '99',
    user_id: '123',
    receiver_id: '123',
    order_id: '1',
    lang: 'ru_RU',
    item: 'coins_10000'
  }, 'ok-vk-secret'));
  assert.deepEqual(result, {
    item_id: 'coins_10000',
    title: '10 000 монет',
    price: 5,
    expiration: 600
  });
});

test('OK get_item accepts the linked OK application ID', async () => {
  const { service } = setup();
  const result = await service.process(signed({
    notification_type: 'get_item',
    app_id: '84',
    user_id: '123',
    receiver_id: '123',
    order_id: '1',
    lang: 'ru_RU',
    item: 'coins_10000'
  }, 'ok-secret'));
  assert.deepEqual(result, {
    item_id: 'coins_10000',
    title: '10 000 монет',
    price: 5,
    expiration: 600
  });
});

test('VK application wins when linked VK and OK IDs are equal', () => {
  const { service } = setup();
  service.config.okVkAppId = service.config.vkAppId;
  assert.deepEqual(service.resolvePlatform(service.config.vkAppId), {
    name: 'vk',
    secret: 'vk-secret'
  });
});

test('OK chargeable order creates a confirmed grant', async () => {
  const { service, calls } = setup();
  const result = await service.process(signed({
    notification_type: 'order_status_change',
    app_id: '99',
    user_id: '123',
    receiver_id: '123',
    order_id: '77',
    item: 'coins_25000',
    item_price: '10',
    status: 'chargeable'
  }, 'ok-vk-secret'));
  assert.deepEqual(result, { order_id: 77 });
  assert.deepEqual(calls, [{
    type: 'grant',
    input: {
      gameId: 'crystal-match',
      platform: 'ok',
      orderId: '77',
      userId: '123',
      productId: 'coins_25000',
      amount: 10
    }
  }]);
});

test('refunded order creates a refund event', async () => {
  const { service, calls } = setup();
  await service.process(signed({
    notification_type: 'order_status_change',
    app_id: '42',
    user_id: '123',
    order_id: '78',
    item: 'coins_60000',
    item_price: '20',
    status: 'refunded'
  }, 'vk-secret'));
  assert.deepEqual(calls, [{
    type: 'refund',
    input: {
      platform: 'vk',
      orderId: '78'
    }
  }]);
});

test('invalid callback signature is rejected', async () => {
  const { service } = setup();
  await assert.rejects(
    service.process({
      notification_type: 'get_item',
      app_id: '99',
      user_id: '123',
      item: 'coins_10000',
      sig: '00000000000000000000000000000000'
    }),
    (cause) => cause.callbackCode === 10
  );
});
