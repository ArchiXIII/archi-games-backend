'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../response');
const { safeEqual } = require('../auth/vkLaunchParams');

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const GET_ITEM_TYPES = new Set(['get_item', 'get_item_test']);
const ORDER_TYPES = new Set(['order_status_change', 'order_status_change_test']);

class JorVkPaymentCallbackError extends Error {
  constructor(code, message) {
    super(message);
    this.callbackCode = code;
    this.critical = true;
  }
}

function signature(params, secret) {
  const keys = Object.keys(params || {}).filter((key) => key !== 'sig').sort();
  const hash = crypto.createHash('md5');
  for (const key of keys) hash.update(key).update('=').update(String(params[key]));
  return hash.update(secret).digest('hex');
}

function callbackError(code, message) {
  return new JorVkPaymentCallbackError(code, message);
}

class JorVkPaymentsService {
  constructor(config, products, purchasesService) {
    this.config = config;
    this.products = products;
    this.purchasesService = purchasesService;
  }

  resolvePlatform(appId) {
    if (appId && appId === this.config.jorVkAppId) {
      return { name: 'vk', secret: this.config.jorVkAppSecret };
    }
    throw callbackError(100, 'Invalid application');
  }

  verify(params) {
    const source = params && typeof params === 'object' ? params : {};
    const platform = this.resolvePlatform(String(source.app_id || ''));
    if (!platform.secret) {
      throw new HttpError(503, 'JOR_PAYMENTS_NOT_CONFIGURED', 'Jor payments are not configured');
    }
    const received = String(source.sig || '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(received) || !safeEqual(signature(source, platform.secret), received)) {
      throw callbackError(10, 'Invalid signature');
    }
    if (!/^\d{1,20}$/.test(source.user_id || '')) throw callbackError(100, 'Invalid user');
    return platform;
  }

  getProduct(productId) {
    if (!ID_PATTERN.test(productId || '') || !this.products[productId]) {
      throw callbackError(20, 'Product does not exist');
    }
    return this.products[productId];
  }

  priceFor(platform, product) {
    const price = product.vkVotes;
    if (!Number.isSafeInteger(price) || price < 1) throw callbackError(20, 'Product does not exist');
    return price;
  }

  async process(params) {
    const source = params && typeof params === 'object' ? params : {};
    const platform = this.verify(source);
    const type = String(source.notification_type || '');
    if (GET_ITEM_TYPES.has(type)) {
      const productId = String(source.item || '');
      const product = this.getProduct(productId);
      return {
        item_id: productId,
        title: String(product.title || productId).slice(0, 48),
        price: this.priceFor(platform.name, product),
        expiration: 600
      };
    }
    if (!ORDER_TYPES.has(type)) throw callbackError(100, 'Unsupported notification');
    const orderId = String(source.order_id || '');
    const numericOrderId = Number(orderId);
    if (!/^\d{1,20}$/.test(orderId) || !Number.isSafeInteger(numericOrderId)) {
      throw callbackError(100, 'Invalid order');
    }
    const productId = String(source.item || source.item_id || '');
    const product = this.getProduct(productId);
    const price = Number(source.item_price);
    if (!Number.isSafeInteger(price) || price !== this.priceFor(platform.name, product)) {
      throw callbackError(100, 'Invalid price');
    }
    if (source.status === 'chargeable') {
      await this.purchasesService.grant({
        platform: platform.name,
        orderId,
        userId: String(source.user_id),
        productId
      });
    } else if (source.status === 'refunded') {
      await this.purchasesService.refund(platform.name, orderId);
    } else {
      throw callbackError(100, 'Unsupported order status');
    }
    return { order_id: numericOrderId };
  }
}

module.exports = { JorVkPaymentsService, JorVkPaymentCallbackError, jorCallbackSignature: signature };
