'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../response');
const { safeEqual } = require('../auth/vkLaunchParams');

const CALLBACK_METHOD = 'callbacks.payment';
const CALLBACK_SIGNATURE_ERROR = 104;
const CALLBACK_INVALID_PAYMENT = 1001;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const TRANSACTION_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

class OkCallbackError extends Error {
  constructor(code, message, reason = '') {
    super(message);
    this.callbackCode = code;
    this.reason = reason;
  }
}

function createOkCallbackSignature(params, secret) {
  const keys = Object.keys(params || {}).filter((key) => key !== 'sig').sort();
  const hash = crypto.createHash('md5');
  for (const key of keys) hash.update(key).update('=').update(String(params[key]));
  return hash.update(secret).digest('hex');
}

function callbackError(code, reason) {
  if (code === CALLBACK_SIGNATURE_ERROR) {
    return new OkCallbackError(code, 'PARAM_SIGNATURE : Invalid signature', reason);
  }
  return new OkCallbackError(
    CALLBACK_INVALID_PAYMENT,
    'CALLBACK_INVALID_PAYMENT : Payment is invalid and can not be processed',
    reason
  );
}

class OkPaymentsService {
  constructor(config, purchaseService) {
    this.config = config;
    this.purchaseService = purchaseService;
  }

  async process(params) {
    if (!this.config.okAppKey || !this.config.okAppSecret) {
      throw new HttpError(503, 'OK_PAYMENTS_NOT_CONFIGURED', 'OK payments are not configured');
    }
    const source = params && typeof params === 'object' ? params : {};
    const signature = typeof source.sig === 'string' ? source.sig.toLowerCase() : '';
    if (!/^[a-f0-9]{32}$/.test(signature) ||
        !safeEqual(createOkCallbackSignature(source, this.config.okAppSecret), signature)) {
      throw callbackError(CALLBACK_SIGNATURE_ERROR, 'signature');
    }
    const amountText = String(source.amount || '');
    const amount = /^\d+$/.test(amountText) ? Number(amountText) : NaN;
    if (source.method !== CALLBACK_METHOD) throw callbackError(CALLBACK_INVALID_PAYMENT, 'method');
    if (source.application_key !== this.config.okAppKey) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'application_key');
    }
    if (!ID_PATTERN.test(source.transaction_id || '')) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'transaction_id');
    }
    if (!/^\d{1,20}$/.test(source.uid || '')) throw callbackError(CALLBACK_INVALID_PAYMENT, 'uid');
    if (!ID_PATTERN.test(source.product_code || '')) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'product_code');
    }
    if (!TRANSACTION_TIME_PATTERN.test(source.transaction_time || '')) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'transaction_time');
    }
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'amount');
    }
    if (source.currency && source.currency !== 'ok') {
      throw callbackError(CALLBACK_INVALID_PAYMENT, 'currency');
    }
    try {
      return await this.purchaseService.grant({
        gameId: this.config.gameId,
        platform: 'ok',
        orderId: source.transaction_id,
        userId: source.uid,
        productId: source.product_code,
        amount
      });
    } catch (cause) {
      if (cause instanceof HttpError &&
          ['INVALID_REQUEST', 'INVALID_PAYMENT', 'UNKNOWN_PRODUCT'].includes(cause.code)) {
        throw callbackError(CALLBACK_INVALID_PAYMENT, `purchase_${cause.code.toLowerCase()}`);
      }
      throw cause;
    }
  }
}

module.exports = {
  OkPaymentsService,
  OkCallbackError,
  createOkCallbackSignature,
  CALLBACK_SIGNATURE_ERROR,
  CALLBACK_INVALID_PAYMENT
};
