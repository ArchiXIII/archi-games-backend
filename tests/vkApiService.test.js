'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { VkApiService, VK_API_URL } = require('../src/services/vkApiService');

test('VK API receives the trusted user, points activity and configured version', async () => {
  let request;
  const service = new VkApiService({
    vkServiceToken: 'service-token',
    vkApiVersion: '5.199'
  }, async (url, options) => {
    request = { url, options };
    return { ok: true, async json() { return { response: 1 }; } };
  });
  await service.submitEndlessScore('123', 24685);
  assert.equal(request.url, VK_API_URL);
  assert.equal(request.url.includes('service-token'), false);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(Object.fromEntries(request.options.body), {
    user_id: '123',
    activity_id: '2',
    value: '24685',
    access_token: 'service-token',
    v: '5.199'
  });
});

test('VK API errors are converted to a safe gateway error', async () => {
  const service = new VkApiService({
    vkServiceToken: 'secret-service-token',
    vkApiVersion: '5.199'
  }, async () => ({
    ok: true,
    async json() {
      return { error: { error_code: 5, error_msg: 'token secret-service-token' } };
    }
  }));
  await assert.rejects(
    service.submitEndlessScore('123', 1),
    (cause) => cause.statusCode === 502 &&
      cause.code === 'VK_API_ERROR' &&
      !cause.message.includes('secret-service-token')
  );
});

test('VK API network and malformed responses are handled', async (context) => {
  await context.test('network error', async () => {
    const service = new VkApiService({
      vkServiceToken: 'token',
      vkApiVersion: '5.199'
    }, async () => {
      throw new Error('network error');
    });
    await assert.rejects(
      service.submitEndlessScore('123', 1),
      (cause) => cause.statusCode === 502 && cause.code === 'VK_API_ERROR'
    );
  });
  await context.test('malformed response', async () => {
    const service = new VkApiService({
      vkServiceToken: 'token',
      vkApiVersion: '5.199'
    }, async () => ({
      ok: true,
      async json() {
        throw new Error('invalid JSON');
      }
    }));
    await assert.rejects(
      service.submitEndlessScore('123', 1),
      (cause) => cause.statusCode === 502 && cause.code === 'VK_API_ERROR'
    );
  });
});

test('missing VK service token returns service unavailable', async () => {
  const service = new VkApiService({ vkServiceToken: '', vkApiVersion: '5.199' });
  await assert.rejects(
    service.submitEndlessScore('123', 1),
    (cause) => cause.statusCode === 503 && cause.code === 'VK_API_NOT_CONFIGURED'
  );
});
