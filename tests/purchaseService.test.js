'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCTS } = require('../src/config');
const { ProductsService } = require('../src/services/productsService');
const { PurchaseService } = require('../src/services/purchaseService');

function setup() {
  const orders = new Map();
  const repository = {
    async createGrant(order) {
      if (orders.has(order.orderId)) return { created: false, eventId: order.eventId };
      orders.set(order.orderId, order);
      return { created: true, eventId: order.eventId };
    },
    async get(platform, orderId) {
      const order = orders.get(orderId);
      return order && order.platform === platform ? {
        gameId: order.gameId,
        userId: order.userId,
        productId: order.productId,
        status: 'completed'
      } : null;
    },
    async createRefund(refund) {
      return { created: true, eventId: refund.eventId };
    }
  };
  return {
    service: new PurchaseService(new ProductsService(PRODUCTS), repository),
    orders
  };
}

test('unknown product is rejected', async () => {
  const { service } = setup();
  await assert.rejects(
    service.grant({
      gameId: 'crystal-match',
      platform: 'vk',
      orderId: 'order-1',
      userId: '123',
      productId: 'missing'
    }),
    (cause) => cause.code === 'UNKNOWN_PRODUCT'
  );
});

test('valid purchase grants catalog coins once', async () => {
  const { service } = setup();
  const input = {
    gameId: 'crystal-match',
    platform: 'vk',
    orderId: 'order-1',
    userId: '123',
    productId: 'coins_25000',
    coins: 999999
  };
  const first = await service.grant(input);
  const second = await service.grant(input);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.eventId, second.eventId);
  assert.match(first.eventId, /^grant_[a-f0-9]{64}$/);
});

test('client cannot choose coins amount', async () => {
  const { service, orders } = setup();
  await service.grant({
    gameId: 'crystal-match',
    platform: 'vk',
    orderId: 'order-2',
    userId: '123',
    productId: 'coins_10000',
    coins: 1000000
  });
  assert.equal(orders.get('order-2').coins, 10000);
});

test('OK purchase requires the catalog price', async () => {
  const { service, orders } = setup();
  await assert.rejects(
    service.grant({
      gameId: 'crystal-match',
      platform: 'ok',
      orderId: 'transaction-1',
      userId: '123',
      productId: 'coins_10000',
      amount: 1
    }),
    (cause) => cause.code === 'INVALID_PAYMENT'
  );
  await service.grant({
    gameId: 'crystal-match',
    platform: 'ok',
    orderId: 'transaction-1',
    userId: '123',
    productId: 'coins_10000',
    amount: 5
  });
  assert.equal(orders.get('transaction-1').coins, 10000);
});

test('refund uses the server catalog and deterministic event ID', async () => {
  const { service, orders } = setup();
  await service.grant({
    gameId: 'crystal-match',
    platform: 'vk',
    orderId: 'order-3',
    userId: '123',
    productId: 'coins_60000'
  });
  const first = await service.refund({ platform: 'vk', orderId: 'order-3' });
  const second = await service.refund({ platform: 'vk', orderId: 'order-3' });
  assert.equal(orders.get('order-3').coins, 60000);
  assert.equal(first.eventId, second.eventId);
  assert.match(first.eventId, /^refund_[a-f0-9]{64}$/);
});
