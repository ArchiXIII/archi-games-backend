'use strict';

const { error } = require('../response');

const TODO = Object.freeze({
  status: 'blocked_pending_official_vk_contract',
  required: Object.freeze([
    'callback_event_types',
    'request_authentication_fields_and_algorithm',
    'order_id_field',
    'user_id_field',
    'product_id_field',
    'status_and_refund_fields',
    'success_and_error_response_schema',
    'retry_and_timeout_rules'
  ])
});

function vkPaymentsCallbackRoute() {
  return error(
    501,
    'VK_CALLBACK_NOT_CONFIGURED',
    'VK payment callback is not configured'
  );
}

module.exports = { vkPaymentsCallbackRoute, TODO };
