'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCTS } = require('../src/config');
const { ProductsService } = require('../src/services/productsService');
const { PurchaseService } = require('../src/services/purchaseService');
const {
  OkPaymentsService,
  OkCallbackError,
  createOkCallbackSignature,
  CALLBACK_SIGNATURE_ERROR,
  CALLBACK_INVALID_PAYMENT
} = require('../src/services/okPaymentsService');

function callback(overrides = {}) {
  const params = {
    transaction_id: '632264039936',
    uid: '1234567890',
    amount: '5',
    method: 'callbacks.payment',
    transaction_time: '2026-07-30 12:34:56',
    product_code: 'coins_10000',
    extra_attributes: '[]',
    application_key: 'public-key',
    call_id: '1753878896000',
    ...overrides
  };
  params.sig = createOkCallbackSignature(params, 'secret');
  return params;
}

function setup() {
  const orders = new Map();
  const repository = {
    async createGrant(order) {
      const key = `${order.platform}:${order.orderId}`;
      if (orders.has(key)) return { created: false, eventId: order.eventId };
      orders.set(key, order);
      return { created: true, eventId: order.eventId };
    }
  };
  const purchaseService = new PurchaseService(new ProductsService(PRODUCTS), repository);
  return {
    service: new OkPaymentsService({
      gameId: 'crystal-match',
      okAppKey: 'public-key',
      okAppSecret: 'secret'
    }, purchaseService),
    orders
  };
}

test('valid OK callback grants catalog product once by transaction ID', async () => {
  const { service, orders } = setup();
  const first = await service.process(callback());
  const second = await service.process(callback());
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(orders.size, 1);
  assert.equal(orders.get('ok:632264039936').coins, 10000);
});

test('OK callback validates signature before payment fields', async () => {
  const { service } = setup();
  const params = callback({ amount: '1' });
  params.sig = '0'.repeat(32);
  await assert.rejects(
    service.process(params),
    (cause) => cause instanceof OkCallbackError &&
      cause.callbackCode === CALLBACK_SIGNATURE_ERROR
  );
});

test('OK callback rejects wrong app, product and amount', async () => {
  const { service } = setup();
  for (const params of [
    callback({ application_key: 'other' }),
    callback({ product_code: 'missing' }),
    callback({ amount: '1' })
  ]) {
    await assert.rejects(
      service.process(params),
      (cause) => cause instanceof OkCallbackError &&
        cause.callbackCode === CALLBACK_INVALID_PAYMENT
    );
  }
});

test('OK callback fails closed without server credentials', async () => {
  const service = new OkPaymentsService({
    gameId: 'crystal-match',
    okAppKey: '',
    okAppSecret: ''
  }, {});
  await assert.rejects(
    service.process(callback()),
    (cause) => cause.statusCode === 503 && cause.code === 'OK_PAYMENTS_NOT_CONFIGURED'
  );
});
