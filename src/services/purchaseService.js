'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../response');

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

class PurchaseService {
  constructor(productsService, ordersRepository) {
    this.productsService = productsService;
    this.ordersRepository = ordersRepository;
  }

  async grant(input) {
    if (!input || !ID_PATTERN.test(input.platform || '') ||
        !ID_PATTERN.test(input.orderId || '') ||
        !/^\d{1,20}$/.test(input.userId || '') ||
        !ID_PATTERN.test(input.productId || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const product = this.productsService.get(input.gameId, input.productId);
    if (input.platform === 'ok' &&
        (!Number.isSafeInteger(input.amount) || input.amount !== product.okAmount)) {
      throw new HttpError(400, 'INVALID_PAYMENT', 'Invalid payment');
    }
    return this.ordersRepository.createGrant({
      platform: input.platform,
      orderId: input.orderId,
      eventId: eventId(input.platform, input.orderId, 'grant'),
      gameId: input.gameId,
      userId: input.userId,
      productId: input.productId,
      coins: product.coins
    });
  }

  async refund(input) {
    if (!input || !ID_PATTERN.test(input.orderId || '') || !ID_PATTERN.test(input.platform || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const order = await this.ordersRepository.get(input.platform, input.orderId);
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const product = this.productsService.get(order.gameId, order.productId);
    return this.ordersRepository.createRefund({
      platform: input.platform,
      orderId: input.orderId,
      eventId: eventId(input.platform, input.orderId, 'refund'),
      gameId: order.gameId,
      userId: order.userId,
      productId: order.productId,
      coins: product.coins
    });
  }
}

function eventId(platform, orderId, type) {
  return `${type}_${crypto.createHash('sha256')
    .update(platform)
    .update('\0')
    .update(orderId)
    .digest('hex')}`;
}

module.exports = { PurchaseService, eventId };
