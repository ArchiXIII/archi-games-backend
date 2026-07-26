'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../src/router');
const { loadConfig } = require('../src/config');

function router(overrides = {}) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'https://game.example' }),
    vkAppId: '42',
    vkAppSecret: 'secret',
    ...overrides
  };
  return createRouter({
    config,
    balanceService: {
      async get(gameId, platform, userId) {
        return { gameId, platform, userId, coins: 0, updatedAt: new Date(0).toISOString() };
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
    path: '/v1/player/sync',
    headers: { 'content-type': 'application/json' },
    body: '{'
  });
  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error.code, 'INVALID_JSON');
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
