'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyVkLaunchParams,
  createSignature,
  safeEqual
} = require('../src/auth/vkLaunchParams');

function signed(secret = 'secret') {
  const params = new URLSearchParams({
    vk_app_id: '42',
    vk_user_id: '123',
    vk_language: 'ru',
    vk_ts: '1710000000'
  });
  params.set('sign', createSignature(params, secret));
  return params.toString();
}

test('valid VK signature returns trusted user', () => {
  assert.deepEqual(verifyVkLaunchParams(signed(), 'secret', '42'), { userId: '123' });
});

test('invalid VK signature is rejected', () => {
  assert.throws(
    () => verifyVkLaunchParams(`${signed()}x`, 'secret', '42'),
    (cause) => cause.code === 'UNAUTHORIZED'
  );
});

test('signature comparison handles differing lengths safely', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('abc', 'abd'), false);
});
