'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSignature } = require('../src/auth/vkLaunchParams');
const {
  verifyOkLaunchParams,
  isOkLaunchParams
} = require('../src/auth/okLaunchParams');

function signed(overrides = {}) {
  const params = new URLSearchParams({
    vk_client: 'ok',
    vk_app_id: '42',
    vk_ok_app_id: '84',
    vk_ok_user_id: '456',
    vk_user_id: '123',
    vk_ts: '1753878896',
    ...overrides
  });
  params.set('sign', createSignature(params, 'secret'));
  return params.toString();
}

test('valid signed OK launch params return vk_ok_user_id', () => {
  assert.equal(isOkLaunchParams(signed()), true);
  assert.deepEqual(
    verifyOkLaunchParams(signed(), 'secret', '42', '84'),
    { userId: '456', platform: 'ok' }
  );
});

test('OK launch params reject invalid signature and app IDs', () => {
  assert.throws(
    () => verifyOkLaunchParams(`${signed()}x`, 'secret', '42', '84'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_app_id: '43' }), 'secret', '42', '84'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_ok_app_id: '85' }), 'secret', '42', '84'),
    (cause) => cause.statusCode === 401
  );
});

test('OK launch params require ok client and vk_ok_user_id', () => {
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_client: 'vk' }), 'secret', '42', '84'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_ok_user_id: '' }), 'secret', '42', '84'),
    (cause) => cause.statusCode === 401
  );
});

test('missing OK app ID fails closed', () => {
  assert.throws(
    () => verifyOkLaunchParams(signed(), 'secret', '42', ''),
    (cause) => cause.statusCode === 503
  );
});
