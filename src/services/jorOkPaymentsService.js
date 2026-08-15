'use strict';

const { HttpError } = require('../response');
const {
  OkCallbackError,
  createOkCallbackSignature,
  CALLBACK_SIGNATURE_ERROR,
  CALLBACK_INVALID_PAYMENT
} = require('./okPaymentsService');
const { safeEqual } = require('../auth/vkLaunchParams');

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function callbackError(code, reason) {
  const message = code === CALLBACK_SIGNATURE_ERROR
    ? 'PARAM_SIGNATURE : Invalid signature'
    : 'CALLBACK_INVALID_PAYMENT : Payment is invalid and can not be processed';
  return new OkCallbackError(code, message, reason);
}

class JorOkPaymentsService {
  constructor(config, products, purchasesService) {
    this.config = config;
    this.products = products;
    this.purchasesService = purchasesService;
  }

  async process(params) {
    if (!this.config.jorOkAppKey || !this.config.jorOkAppSecret) {
      throw new HttpError(503, 'JOR_OK_PAYMENTS_NOT_CONFIGURED', 'Jor OK payments are not configured');
    }
    const source = params && typeof params === 'object' ? params : {};
    const received = String(source.sig || '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(received) ||
        !safeEqual(createOkCallbackSignature(source, this.config.jorOkAppSecret), received)) {
      throw callbackError(CALLBACK_SIGNATURE_ERROR, 'signature');
    }
    const amount = /^\d+$/.test(String(source.amount || '')) ? Number(source.amount) : NaN;
    const product = this.products[source.product_code];
    if (source.method !== 'callbacks.payment') throw callbackError(CALLBACK_INVALID_PAYMENT, 'method');
    if (source.application_key !== this.config.jorOkAppKey) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'application_key');
    }
    if (!ID_PATTERN.test(source.transaction_id || '')) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'transaction_id');
    }
    if (!/^\d{1,20}$/.test(source.uid || '')) throw callbackError(CALLBACK_INVALID_PAYMENT, 'uid');
    if (!ID_PATTERN.test(source.product_code || '') || !product) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'product_code');
    }
    if (!TIME_PATTERN.test(source.transaction_time || '')) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'transaction_time');
    }
    if (!Number.isSafeInteger(amount) || amount !== product.okAmount) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'amount');
    }
    if (source.currency && source.currency !== 'ok') {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'currency');
    }
    return this.purchasesService.grant({
      platform: 'ok',
      orderId: source.transaction_id,
      userId: source.uid,
      productId: source.product_code
    });
  }
}

module.exports = { JorOkPaymentsService };
