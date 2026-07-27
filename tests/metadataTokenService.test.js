'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MetadataAuthService } = require('ydb-sdk');
const { MetadataTokenService, ENDPOINT } = require('../src/db/metadataTokenService');

test('metadata token service loads and caches IAM token', async () => {
  let calls = 0;
  const service = new MetadataTokenService(async (url, options) => {
    calls += 1;
    assert.equal(url, ENDPOINT);
    assert.equal(options.headers['Metadata-Flavor'], 'Google');
    return {
      ok: true,
      async json() {
        return { access_token: 'test-token', expires_in: 3600, token_type: 'Bearer' };
      }
    };
  });
  assert.equal(service.getToken(), '');
  await service.initialize();
  await service.initialize();
  assert.equal(service.getToken(), 'test-token');
  assert.equal(calls, 1);
});

test('metadata token service rejects invalid response', async () => {
  const service = new MetadataTokenService(async () => ({
    ok: true,
    async json() {
      return { expires_in: 3600 };
    }
  }));
  await assert.rejects(service.initialize(), /invalid token response/);
});

test('metadata token service integrates with YDB auth metadata', async () => {
  const service = new MetadataTokenService(async () => ({
    ok: true,
    async json() {
      return { access_token: 'test-token', expires_in: 3600 };
    }
  }));
  const auth = new MetadataAuthService(service);
  const metadata = await auth.getAuthMetadata();
  assert.deepEqual(metadata.get('x-ydb-auth-ticket'), ['test-token']);
});
