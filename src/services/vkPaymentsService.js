'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../response');
const { safeEqual } = require('../auth/vkLaunchParams');

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const GET_ITEM_TYPES = new Set(['get_item', 'get_item_test']);
const ORDER_TYPES = new Set(['order_status_change', 'order_status_change_test']);

class VkPaymentCallbackError extends Error {
  constructor(code, message, critical = true) {
    super(message);
    this.callbackCode = code;
    this.critical = critical;
  }
}

function callbackSignature(params, secret) {
  const keys = Object.keys(params || {}).filter((key) => key !== 'sig').sort();
  const hash = crypto.createHash('md5');
  for (const key of keys) hash.update(key).update('=').update(String(params[key]));
  return hash.update(secret).digest('hex');
}

function callbackError(code, message) {
  return new VkPaymentCallbackError(code, message);
}

class VkPaymentsService {
  constructor(config, productsService, purchaseService) {
    this.config = config;
    this.productsService = productsService;
    this.purchaseService = purchaseService;
  }

  resolvePlatform(appId) {
    if (appId && appId === this.config.okAppId) {
      return {
        name: 'ok',
        secret: this.config.okAppSecret || this.config.okVkAppSecret
      };
    }
    if (appId && appId === this.config.okVkAppId) {
      return {
        name: 'ok',
        secret: this.config.okVkAppSecret || this.config.okAppSecret
      };
    }
    if (appId && appId === this.config.vkAppId) {
      return { name: 'vk', secret: this.config.vkAppSecret };
    }
    throw callbackError(100, 'Invalid application');
  }

  verify(params) {
    const source = params && typeof params === 'object' ? params : {};
    const appId = String(source.app_id || '');
    const platform = this.resolvePlatform(appId);
    if (!platform.secret) {
      throw new HttpError(503, 'VK_PAYMENTS_NOT_CONFIGURED', 'VK payments are not configured');
    }
    const signature = String(source.sig || '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(signature) ||
        !safeEqual(callbackSignature(source, platform.secret), signature)) {
      throw callbackError(10, 'Invalid signature');
    }
    if (!/^\d{1,20}$/.test(source.user_id || '')) {
      throw callbackError(100, 'Invalid user');
    }
    return platform;
  }

  getProduct(productId) {
    if (!ID_PATTERN.test(productId || '')) throw callbackError(20, 'Product does not exist');
    try {
      return this.productsService.get(this.config.gameId, productId);
    } catch (cause) {
      throw callbackError(20, 'Product does not exist');
    }
  }

  priceFor(platform, product) {
    const price = platform === 'ok' ? product.okAmount : product.vkVotes;
    if (!Number.isSafeInteger(price) || price < 1) {
      throw callbackError(20, 'Product does not exist');
    }
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
    const expectedPrice = this.priceFor(platform.name, product);
    const itemPrice = Number(source.item_price);
    if (!Number.isSafeInteger(itemPrice) || itemPrice !== expectedPrice) {
      throw callbackError(100, 'Invalid price');
    }
    if (source.status === 'chargeable') {
      await this.purchaseService.grant({
        gameId: this.config.gameId,
        platform: platform.name,
        orderId,
        userId: String(source.user_id),
        productId,
        amount: itemPrice
      });
    } else if (source.status === 'refunded') {
      await this.purchaseService.refund({
        platform: platform.name,
        orderId
      });
    } else {
      throw callbackError(100, 'Unsupported order status');
    }
    return { order_id: numericOrderId };
  }
}

module.exports = {
  VkPaymentsService,
  VkPaymentCallbackError,
  callbackSignature
};
