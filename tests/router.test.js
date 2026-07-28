'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../src/router');
const { loadConfig } = require('../src/config');
const { createSignature } = require('../src/auth/vkLaunchParams');

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

function router(overrides = {}) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'https://game.example' }),
    vkAppId: '42',
    vkAppSecret: 'secret',
    ...overrides
  };
  return createRouter({
    config,
    leaderboardService: {
      async sync() {
        return { totalStars: 100, totalXp: 5000 };
      },
      async list(gameId, platform, userId, board) {
        return { entries: [], currentUser: null, limit: 20, offset: 0, board };
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

test('leaderboard and purchase event routes use VK identity', async () => {
  const route = router();
  const leaderboard = await route({
    httpMethod: 'GET',
    path: '/v1/leaderboards/xp',
    headers: authHeaders()
  });
  const pending = await route({
    httpMethod: 'GET',
    path: '/v1/purchase-events/pending',
    headers: authHeaders()
  });
  assert.equal(leaderboard.statusCode, 200);
  assert.equal(JSON.parse(leaderboard.body).board, 'xp');
  assert.deepEqual(JSON.parse(pending.body), { events: [] });
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
  assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined);
});
