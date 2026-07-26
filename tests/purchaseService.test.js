'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCTS } = require('../src/config');
const { ProductsService } = require('../src/services/productsService');
const { PurchaseService } = require('../src/services/purchaseService');

function setup() {
  const orders = new Map();
  let balance = 0;
  const repository = {
    async grantPurchase(order) {
      if (orders.has(order.orderId)) return { granted: false, coins: balance };
      orders.set(order.orderId, order);
      balance += order.coins;
      return { granted: true, coins: balance };
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
    productId: 'coins_1500',
    coins: 999999
  };
  const first = await service.grant(input);
  const second = await service.grant(input);
  assert.deepEqual(first, { granted: true, coins: 1500 });
  assert.deepEqual(second, { granted: false, coins: 1500 });
});

test('client cannot choose coins amount', async () => {
  const { service, orders } = setup();
  await service.grant({
    gameId: 'crystal-match',
    platform: 'vk',
    orderId: 'order-2',
    userId: '123',
    productId: 'coins_500',
    coins: 1000000
  });
  assert.equal(orders.get('order-2').coins, 500);
});
