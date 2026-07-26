'use strict';

const { HttpError } = require('../response');

class ProductsService {
  constructor(products) {
    this.products = products;
  }

  get(gameId, productId) {
    const product = this.products[gameId] && this.products[gameId][productId];
    if (!product) throw new HttpError(400, 'UNKNOWN_PRODUCT', 'Unknown product');
    return product;
  }
}

module.exports = { ProductsService };
