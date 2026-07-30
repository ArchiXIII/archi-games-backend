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
    vk_app_id: '99',
    vk_ok_app_id: '84',
    vk_ok_user_id: '456',
    vk_user_id: '123',
    vk_ts: '1753878896',
    ...overrides
  });
  params.set('sign', createSignature(params, 'ok-secret'));
  return params.toString();
}

test('valid signed OK launch params return vk_ok_user_id', () => {
  assert.equal(isOkLaunchParams(signed()), true);
  assert.deepEqual(
    verifyOkLaunchParams(signed(), 'ok-secret', '99', '84'),
    { userId: '456', platform: 'ok' }
  );
});

test('OK launch params reject invalid signature and app IDs', () => {
  assert.throws(
    () => verifyOkLaunchParams(`${signed()}x`, 'ok-secret', '99', '84'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_app_id: '100' }), 'ok-secret', '99', '84'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_ok_app_id: '85' }), 'ok-secret', '99', '84'),
    (cause) => cause.statusCode === 401
  );
});

test('OK launch params require ok client and vk_ok_user_id', () => {
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_client: 'vk' }), 'ok-secret', '99', '84'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ vk_ok_user_id: '' }), 'ok-secret', '99', '84'),
    (cause) => cause.statusCode === 401
  );
});

test('missing OK app ID fails closed', () => {
  assert.throws(
    () => verifyOkLaunchParams(signed(), 'ok-secret', '99', ''),
    (cause) => cause.statusCode === 503
  );
});
