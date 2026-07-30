'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../src/router');
const { loadConfig } = require('../src/config');
const { createSignature } = require('../src/auth/vkLaunchParams');
const { OkCallbackError } = require('../src/services/okPaymentsService');

function authHeaders(contentType) {
  const params = new URLSearchParams({
    vk_app_id: '42',
    vk_user_id: '123',
    vk_language: 'ru'
  });
  params.set('sign', createSignature(params, 'secret'));
  return {
    ...(contentType ? { 'content-type': contentType } : {}),
    'x-vk-launch-params': params.toString()
  };
}

function okAuthHeaders(contentType) {
  const params = new URLSearchParams({
    vk_client: 'ok',
    vk_app_id: '42',
    vk_ok_app_id: '84',
    vk_ok_user_id: '456',
    vk_user_id: '123',
    vk_ts: '1753878896'
  });
  params.set('sign', createSignature(params, 'secret'));
  return {
    ...(contentType ? { 'content-type': contentType } : {}),
    'x-vk-launch-params': params.toString()
  };
}

function router(overrides = {}) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'https://game.example' }),
    vkAppId: '42',
    vkAppSecret: 'secret',
    okAppId: '84',
    okAppKey: 'ok-public',
    okAppSecret: 'ok-secret',
    ...overrides
  };
  return createRouter({
    config,
    leaderboardService: {
      async sync() {
        return { totalStars: 100 };
      },
      async list() {
        return { entries: [], currentUser: null, limit: 20, offset: 0 };
      }
    },
    purchaseEventsService: {
      async pending() {
        return [];
      },
      async ack(gameId, platform, userId, body) {
        return body.eventId;
      }
    },
    vkApiService: {
      async submitEndlessScore(userId, score) {
        return { userId, score };
      }
    },
    okPaymentsService: {
      async process() {
        return { created: true };
      }
    }
  });
}

test('GET /health', async () => {
  const response = await router()({ httpMethod: 'GET', path: '/health' });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'archi-games-api');
  assert.ok(response.headers['X-Request-Id']);
});

test('404', async () => {
  const response = await router()({ httpMethod: 'GET', path: '/missing' });
  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body).error.code, 'NOT_FOUND');
});

test('invalid JSON', async () => {
  const response = await router()({
    httpMethod: 'POST',
    path: '/v1/leaderboards/sync',
    headers: authHeaders('application/json'),
    body: '{'
  });
  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error.code, 'INVALID_JSON');
});

test('client routes require signed VK launch params', async () => {
  const route = router();
  const response = await route({
    httpMethod: 'GET',
    path: '/v1/leaderboards/stars'
  });
  const queryFallback = await route({
    httpMethod: 'GET',
    path: '/v1/leaderboards/stars',
    queryStringParameters: { vk_user_id: '123', sign: 'invalid' }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(queryFallback.statusCode, 401);
  assert.equal(JSON.parse(response.body).error.code, 'UNAUTHORIZED');
});

test('stars and purchase event routes use VK identity', async () => {
  const route = router();
  const leaderboard = await route({
    httpMethod: 'GET',
    path: '/v1/leaderboards/stars',
    headers: authHeaders()
  });
  const pending = await route({
    httpMethod: 'GET',
    path: '/v1/purchase-events/pending',
    headers: authHeaders()
  });
  assert.equal(leaderboard.statusCode, 200);
  assert.deepEqual(JSON.parse(leaderboard.body).entries, []);
  assert.deepEqual(JSON.parse(pending.body), { events: [] });
});

test('leaderboard routes accept OK identity and keep platform separated', async () => {
  let syncCall;
  const route = createRouter({
    config: {
      ...loadConfig({ NODE_ENV: 'test' }),
      vkAppId: '42',
      vkAppSecret: 'secret',
      okAppId: '84',
      okAppKey: 'ok-public',
      okAppSecret: 'ok-secret'
    },
    leaderboardService: {
      async sync(...args) {
        syncCall = args;
        return { totalStars: 10 };
      }
    }
  });
  const response = await route({
    httpMethod: 'POST',
    path: '/v1/leaderboards/sync',
    headers: okAuthHeaders('application/json'),
    body: JSON.stringify({ totalStars: 10, playerName: 'Alex' })
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(syncCall, [
    'crystal-match',
    'ok',
    '456',
    { totalStars: 10, playerName: 'Alex' }
  ]);
});

test('OK launch params reject a mismatched OK app ID', async () => {
  const params = new URLSearchParams({
    vk_client: 'ok',
    vk_app_id: '42',
    vk_ok_app_id: '85',
    vk_ok_user_id: '456',
    vk_user_id: '123',
    vk_ts: '1753878896'
  });
  params.set('sign', createSignature(params, 'secret'));
  const response = await router()({
    httpMethod: 'GET',
    path: '/v1/leaderboards/stars',
    headers: { 'x-vk-launch-params': params.toString() }
  });
  assert.equal(response.statusCode, 401);
});

test('XP leaderboard route is disabled', async () => {
  const response = await router()({
    httpMethod: 'GET',
    path: '/v1/leaderboards/xp',
    headers: authHeaders()
  });
  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body).error.code, 'NOT_FOUND');
});

test('endless score route uses VK identity and returns the submitted score', async () => {
  let submitted;
  const route = createRouter({
    config: {
      ...loadConfig({ NODE_ENV: 'test' }),
      vkAppId: '42',
      vkAppSecret: 'secret'
    },
    vkApiService: {
      async submitEndlessScore(userId, score) {
        submitted = { userId, score };
      }
    }
  });
  const response = await route({
    httpMethod: 'POST',
    path: '/v1/vk/endless-score',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ score: 24685 })
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, score: 24685 });
  assert.deepEqual(submitted, { userId: '123', score: 24685 });
});

test('endless score route rejects invalid scores', async () => {
  const route = router();
  for (const score of [-1, 1.5, '10', null]) {
    const response = await route({
      httpMethod: 'POST',
      path: '/v1/vk/endless-score',
      headers: authHeaders('application/json'),
      body: JSON.stringify({ score })
    });
    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).error.code, 'INVALID_REQUEST');
  }
});

test('VK-only endless score route rejects OK credentials', async () => {
  const response = await router()({
    httpMethod: 'POST',
    path: '/v1/vk/endless-score',
    headers: okAuthHeaders('application/json'),
    body: JSON.stringify({ score: 10 })
  });
  assert.equal(response.statusCode, 401);
});

test('OK payment callback returns the official JSON success response', async () => {
  let received;
  const route = createRouter({
    config: loadConfig({ NODE_ENV: 'test' }),
    okPaymentsService: {
      async process(params) {
        received = params;
      }
    }
  });
  const response = await route({
    httpMethod: 'GET',
    path: '/v1/ok/payments/callback',
    queryStringParameters: { transaction_id: '1' }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(response.body, 'true');
  assert.deepEqual(received, { transaction_id: '1' });
});

test('OK payment callback returns the official JSON error response', async () => {
  const route = createRouter({
    config: loadConfig({ NODE_ENV: 'test' }),
    okPaymentsService: {
      async process() {
        throw new OkCallbackError(104, 'PARAM_SIGNATURE : Invalid signature');
      }
    }
  });
  const response = await route({
    httpMethod: 'GET',
    path: '/v1/ok/payments/callback',
    queryStringParameters: {}
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Invocation-error'], '104');
  assert.deepEqual(JSON.parse(response.body), {
    error_code: 104,
    error_msg: 'PARAM_SIGNATURE : Invalid signature',
    error_data: null
  });
});

test('CORS is returned only for allowlisted origins', async () => {
  const allowed = await router()({
    httpMethod: 'GET',
    path: '/health',
    headers: { origin: 'https://game.example' }
  });
  const denied = await router()({
    httpMethod: 'GET',
    path: '/health',
    headers: { origin: 'https://evil.example' }
  });
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://game.example');
  assert.doesNotMatch(allowed.headers['Access-Control-Allow-Headers'], /X-OK-Launch-Params/);
  assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined);
});
