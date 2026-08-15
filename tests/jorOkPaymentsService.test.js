'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createOkCallbackSignature, OkCallbackError } = require('../src/services/okPaymentsService');
const { JorOkPaymentsService } = require('../src/services/jorOkPaymentsService');

const products = { item: { okAmount: 19, durationDays: 0 } };

function callback(overrides = {}) {
  const params = {
    method: 'callbacks.payment',
    application_key: 'public-key',
    uid: '123',
    transaction_id: '456',
    transaction_time: '2026-08-15 12:00:00',
    product_code: 'item',
    amount: '19',
    ...overrides
  };
  params.sig = createOkCallbackSignature(params, 'secret');
  return params;
}

test('Jor OK callback validates and grants a catalog purchase', async () => {
  const grants = [];
  const service = new JorOkPaymentsService({
    jorOkAppKey: 'public-key',
    jorVkAppSecret: 'secret'
  }, products, {
    async grant(value) {
      grants.push(value);
      return { created: true };
    }
  });
  assert.deepEqual(await service.process(callback()), { created: true });
  assert.deepEqual(grants[0], {
    platform: 'ok',
    orderId: '456',
    userId: '123',
    productId: 'item'
  });
  for (const input of [callback({ amount: '18' }), callback({ application_key: 'other' })]) {
    await assert.rejects(service.process(input), OkCallbackError);
  }
});
