'use strict';

const { json, HttpError } = require('../response');
const { parsePaymentParams } = require('./vkPaymentsCallback');
const { JorVkPaymentCallbackError } = require('../services/jorVkPaymentsService');

async function jorPurchasesRoute(context) {
  return json(200, await context.jorPurchasesService.list(context.auth.platform, context.auth.userId));
}

async function jorVkPaymentsCallbackRoute(context) {
  let params = {};
  try {
    params = parsePaymentParams(context.event, context.config.maxBodyBytes);
    const response = await context.jorVkPaymentsService.process(params);
    return json(200, { response });
  } catch (cause) {
    if (!(cause instanceof JorVkPaymentCallbackError)) throw cause;
    return json(200, {
      error: {
        error_code: cause.callbackCode,
        error_msg: cause.message,
        critical: cause.critical
      }
    });
  }
}

module.exports = { jorPurchasesRoute, jorVkPaymentsCallbackRoute };
