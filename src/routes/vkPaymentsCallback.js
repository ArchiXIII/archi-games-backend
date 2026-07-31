'use strict';

const { json, HttpError } = require('../response');
const { VkPaymentCallbackError } = require('../services/vkPaymentsService');

function parsePaymentParams(event, maxBytes) {
  let raw = event && event.body != null ? String(event.body) : '';
  if (event && event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (Buffer.byteLength(raw) > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
  }
  const params = {};
  new URLSearchParams(raw).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

async function vkPaymentsCallbackRoute(context) {
  let params = {};
  try {
    params = parsePaymentParams(context.event, context.config.maxBodyBytes);
    const response = await context.vkPaymentsService.process(params);
    console.info(JSON.stringify({
      level: 'info',
      event: 'vk_payment_callback',
      notificationType: String(params.notification_type || ''),
      appId: String(params.app_id || ''),
      item: String(params.item || params.item_id || ''),
      result: 'success'
    }));
    return json(200, { response });
  } catch (cause) {
    if (!(cause instanceof VkPaymentCallbackError)) throw cause;
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'vk_payment_callback',
      notificationType: String(params.notification_type || ''),
      appId: String(params.app_id || ''),
      item: String(params.item || params.item_id || ''),
      result: 'error',
      errorCode: cause.callbackCode
    }));
    return json(200, {
      error: {
        error_code: cause.callbackCode,
        error_msg: cause.message,
        critical: cause.critical
      }
    });
  }
}

module.exports = { vkPaymentsCallbackRoute, parsePaymentParams };
