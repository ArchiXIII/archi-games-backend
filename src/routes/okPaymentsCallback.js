'use strict';

const { json } = require('../response');
const { OkCallbackError } = require('../services/okPaymentsService');

async function okPaymentsCallbackRoute(context) {
  const params = context.event.queryStringParameters || {};
  try {
    await context.okPaymentsService.process(params);
    console.info(JSON.stringify({
      level: 'info',
      event: 'ok_payment_callback',
      product: String(params.product_code || ''),
      amount: String(params.amount || ''),
      result: 'success'
    }));
    return json(200, true);
  } catch (cause) {
    if (!(cause instanceof OkCallbackError)) throw cause;
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'ok_payment_callback',
      product: String(params.product_code || ''),
      amount: String(params.amount || ''),
      result: 'error',
      errorCode: cause.callbackCode,
      reason: cause.reason || 'unknown'
    }));
    return json(200, {
      error_code: cause.callbackCode,
      error_msg: cause.message,
      error_data: null
    }, {
      'Invocation-error': String(cause.callbackCode)
    });
  }
}

module.exports = { okPaymentsCallbackRoute };
