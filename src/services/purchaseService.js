'use strict';

const { HttpError } = require('../response');

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

class PurchaseService {
  constructor(productsService, ordersRepository) {
    this.productsService = productsService;
    this.ordersRepository = ordersRepository;
  }

  async grant(input) {
    if (!input || !ID_PATTERN.test(input.orderId || '') ||
        !/^\d{1,20}$/.test(input.userId || '') ||
        !ID_PATTERN.test(input.productId || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const product = this.productsService.get(input.gameId, input.productId);
    return this.ordersRepository.grantPurchase({
      platform: input.platform,
      orderId: input.orderId,
      gameId: input.gameId,
      userId: input.userId,
      productId: input.productId,
      coins: product.coins
    });
  }
}

module.exports = { PurchaseService };
