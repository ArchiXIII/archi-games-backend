'use strict';

const { json } = require('../response');
const { OkCallbackError } = require('../services/okPaymentsService');

async function okPaymentsCallbackRoute(context) {
  try {
    await context.okPaymentsService.process(context.event.queryStringParameters);
    return json(200, true);
  } catch (cause) {
    if (!(cause instanceof OkCallbackError)) throw cause;
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
