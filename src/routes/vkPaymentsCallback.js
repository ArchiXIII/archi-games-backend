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
  try {
    const params = parsePaymentParams(context.event, context.config.maxBodyBytes);
    const response = await context.vkPaymentsService.process(params);
    return json(200, { response });
  } catch (cause) {
    if (!(cause instanceof VkPaymentCallbackError)) throw cause;
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
