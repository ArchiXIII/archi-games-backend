'use strict';

const { HttpError } = require('../response');
const { numberValue } = require('../db/values');

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

class JorPurchasesService {
  constructor(products, repository) {
    this.products = products;
    this.repository = repository;
  }

  getProduct(productId) {
    const product = this.products[productId];
    if (!product) throw new HttpError(400, 'UNKNOWN_PRODUCT', 'Unknown product');
    return product;
  }

  async grant(input) {
    if (!input || !ID_PATTERN.test(input.platform || '') ||
        !ID_PATTERN.test(input.orderId || '') || !/^\d{1,20}$/.test(input.userId || '') ||
        !ID_PATTERN.test(input.productId || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const product = this.getProduct(input.productId);
    return this.repository.grant({
      ...input,
      durationDays: product.durationDays
    });
  }

  refund(platform, orderId) {
    if (!ID_PATTERN.test(platform || '') || !ID_PATTERN.test(orderId || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    return this.repository.refund(platform, orderId);
  }

  async list(platform, userId) {
    const source = await this.repository.list(platform, userId);
    const permanent = new Map();
    const timed = new Map();
    for (const row of source) {
      const productId = String(row.product_id || '');
      const product = this.products[productId];
      if (!product) continue;
      const orderId = String(row.platform_order_id || '');
      const purchasedAt = dateMs(row.purchased_at);
      if (!product.durationDays) {
        if (!permanent.has(productId)) permanent.set(productId, { productId, orderId });
        continue;
      }
      const list = timed.get(productId) || [];
      list.push({ orderId, purchasedAt, durationDays: numberValue(row.duration_days) });
      timed.set(productId, list);
    }
    const purchases = Array.from(permanent.values());
    for (const [productId, orders] of timed) {
      orders.sort((a, b) => a.purchasedAt - b.purchasedAt || a.orderId.localeCompare(b.orderId));
      let expiresAt = 0;
      for (const order of orders) {
        expiresAt = Math.max(expiresAt, order.purchasedAt) + Math.max(0, order.durationDays) * DAY_MS;
      }
      if (expiresAt > Date.now()) purchases.push({ productId, orderId: orders.at(-1).orderId, expiresAt });
    }
    return { purchases, authoritative: true };
  }
}

function dateMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'bigint' || typeof value === 'number') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1e14 ? Math.floor(numeric / 1000) : numeric;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

module.exports = { JorPurchasesService, DAY_MS };
