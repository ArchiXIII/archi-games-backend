'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyOkLaunchParams,
  createOkAuthSignature
} = require('../src/auth/okLaunchParams');

function signed(overrides = {}) {
  const values = {
    application_key: 'public-key',
    authorized: '1',
    logged_user_id: '123',
    session_key: 'session-key',
    ...overrides
  };
  values.auth_sig = createOkAuthSignature(
    values.logged_user_id,
    values.session_key,
    'secret'
  );
  return new URLSearchParams(values).toString();
}

test('valid OK launch params return trusted platform user', () => {
  assert.deepEqual(
    verifyOkLaunchParams(signed(), 'secret', 'public-key'),
    { userId: '123', platform: 'ok' }
  );
});

test('OK launch params reject invalid signature, app and authorization', () => {
  assert.throws(
    () => verifyOkLaunchParams(`${signed()}x`, 'secret', 'public-key'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ application_key: 'other' }), 'secret', 'public-key'),
    (cause) => cause.statusCode === 401
  );
  assert.throws(
    () => verifyOkLaunchParams(signed({ authorized: '0' }), 'secret', 'public-key'),
    (cause) => cause.statusCode === 401
  );
});

test('missing OK server credentials fail closed', () => {
  assert.throws(
    () => verifyOkLaunchParams(signed(), '', 'public-key'),
    (cause) => cause.statusCode === 503
  );
});
