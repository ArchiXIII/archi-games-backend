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

test('VK API errors are safely logged and returned with VK details', async () => {
  const warnings = [];
  const service = new VkApiService({
    vkServiceToken: 'secret-service-token',
    vkApiVersion: '5.199'
  }, async () => ({
    ok: true,
    async json() {
      return {
        error: {
          error_code: 5,
          error_msg: 'Authorization failed: access_token=secret-service-token user_id=123 activity_id=2 value=1'
        }
      };
    }
  }), {
    warn(entry) {
      warnings.push(entry);
    }
  });
  await assert.rejects(
    service.submitEndlessScore('123', 1),
    (cause) => cause.statusCode === 502 &&
      cause.code === 'VK_API_ERROR' &&
      cause.message ===
        'VK API error 5: Authorization failed: access_token=[REDACTED] user_id=[REDACTED] activity_id=[REDACTED] value=[REDACTED]'
  );
  assert.deepEqual(warnings, [{
    event: 'vk_api_error',
    method: 'secure.addAppEvent',
    vkErrorCode: 5,
    vkErrorMessage:
      'Authorization failed: access_token=[REDACTED] user_id=[REDACTED] activity_id=[REDACTED] value=[REDACTED]'
  }]);
  assert.equal(JSON.stringify(warnings).includes('secret-service-token'), false);
  assert.equal(JSON.stringify(warnings).includes('123'), false);
});

test('malformed VK error details use safe fallbacks', async () => {
  const warnings = [];
  const service = new VkApiService({
    vkServiceToken: 'token',
    vkApiVersion: '5.199'
  }, async () => ({
    ok: true,
    async json() {
      return { error: { error_code: {}, error_msg: null } };
    }
  }), {
    warn(entry) {
      warnings.push(entry);
    }
  });
  await assert.rejects(
    service.submitEndlessScore('123', 1),
    (cause) => cause.message === 'VK API error unknown: Unknown VK API error'
  );
  assert.deepEqual(warnings[0], {
    event: 'vk_api_error',
    method: 'secure.addAppEvent',
    vkErrorCode: 'unknown',
    vkErrorMessage: 'Unknown VK API error'
  });
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
      (cause) => cause.statusCode === 502 &&
        cause.code === 'VK_API_ERROR' &&
        cause.message === 'VK API request failed'
    );
  });
  await context.test('timeout', async () => {
    const service = new VkApiService({
      vkServiceToken: 'token',
      vkApiVersion: '5.199'
    }, async () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    await assert.rejects(
      service.submitEndlessScore('123', 1),
      (cause) => cause.statusCode === 502 &&
        cause.code === 'VK_API_ERROR' &&
        cause.message === 'VK API request failed'
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
      (cause) => cause.statusCode === 502 &&
        cause.code === 'VK_API_ERROR' &&
        cause.message === 'VK API request failed'
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
