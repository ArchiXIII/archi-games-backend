'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JorPurchasesService, DAY_MS } = require('../src/services/jorPurchasesService');

const products = {
  permanent: { durationDays: 0 },
  timed: { durationDays: 30 }
};

test('Jor purchase migration adds its YDB index to the existing table', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '009_jor_purchases.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE jor_purchases\s+ADD INDEX idx_jor_purchases_user GLOBAL/i);
  assert.doesNotMatch(sql, /CREATE GLOBAL INDEX/i);
});

test('Jor purchases aggregate permanent and timed orders in one read', async () => {
  const now = Date.now();
  const repository = {
    async list() {
      return [
        { platform_order_id: '1', product_id: 'permanent', duration_days: 0, purchased_at: new Date(now - DAY_MS) },
        { platform_order_id: '2', product_id: 'timed', duration_days: 30, purchased_at: new Date(now - DAY_MS) },
        { platform_order_id: '3', product_id: 'timed', duration_days: 30, purchased_at: new Date(now) }
      ];
    }
  };
  const result = await new JorPurchasesService(products, repository).list('vk', '1');
  assert.equal(result.authoritative, true);
  assert.deepEqual(result.purchases[0], { productId: 'permanent', orderId: '1' });
  assert.equal(result.purchases[1].productId, 'timed');
  assert.ok(result.purchases[1].expiresAt >= now + 59 * DAY_MS);
});

test('Jor purchase grant takes duration only from the server catalog', async () => {
  let received;
  const repository = {
    async grant(value) {
      received = value;
      return { created: true };
    }
  };
  const service = new JorPurchasesService(products, repository);
  await service.grant({ platform: 'ok', orderId: '7', userId: '9', productId: 'timed', durationDays: 999 });
  assert.equal(received.durationDays, 30);
  await assert.rejects(
    service.grant({ platform: 'ok', orderId: '8', userId: '9', productId: 'missing' }),
    (error) => error.code === 'UNKNOWN_PRODUCT'
  );
});
