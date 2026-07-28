'use strict';

const { HttpError } = require('../response');
const logger = require('../logger');

const VK_API_URL = 'https://api.vk.com/method/secure.addAppEvent';
const VK_API_TIMEOUT_MS = 3500;
const VK_ERROR_MESSAGE_LIMIT = 500;
const REQUEST_PARAMETER_PATTERN = /\b(access_token|user_id|activity_id|value|v)\s*[=:]\s*[^,\s;&]+/giu;

function safeVkError(error, serviceToken) {
  const source = error && typeof error === 'object' ? error : {};
  const parsedCode = Number(source.error_code);
  const vkErrorCode = Number.isSafeInteger(parsedCode) ? parsedCode : 'unknown';
  let vkErrorMessage = typeof source.error_msg === 'string'
    ? source.error_msg
    : 'Unknown VK API error';
  if (serviceToken) vkErrorMessage = vkErrorMessage.split(serviceToken).join('[REDACTED]');
  vkErrorMessage = vkErrorMessage
    .replace(REQUEST_PARAMETER_PATTERN, '$1=[REDACTED]')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!vkErrorMessage) vkErrorMessage = 'Unknown VK API error';
  if (vkErrorMessage.length > VK_ERROR_MESSAGE_LIMIT) {
    vkErrorMessage = vkErrorMessage.slice(0, VK_ERROR_MESSAGE_LIMIT);
  }
  return { vkErrorCode, vkErrorMessage };
}

class VkApiService {
  constructor(config, fetchImpl = globalThis.fetch, log = logger) {
    this.serviceToken = config.vkServiceToken;
    this.apiVersion = config.vkApiVersion || '5.199';
    this.fetch = fetchImpl;
    this.logger = log;
  }

  async submitEndlessScore(userId, score) {
    if (!this.serviceToken || typeof this.fetch !== 'function') {
      throw new HttpError(503, 'VK_API_NOT_CONFIGURED', 'VK API is not configured');
    }
    const body = new URLSearchParams({
      user_id: userId,
      activity_id: '2',
      value: String(score),
      access_token: this.serviceToken,
      v: this.apiVersion
    });
    let response;
    try {
      response = await this.fetch(VK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(VK_API_TIMEOUT_MS)
      });
    } catch {
      throw new HttpError(502, 'VK_API_ERROR', 'VK API request failed');
    }
    if (!response.ok) {
      throw new HttpError(502, 'VK_API_ERROR', 'VK API request failed');
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new HttpError(502, 'VK_API_ERROR', 'VK API request failed');
    }
    if (payload && payload.error) {
      const details = safeVkError(payload.error, this.serviceToken);
      this.logger.warn({
        event: 'vk_api_error',
        method: 'secure.addAppEvent',
        ...details
      });
      throw new HttpError(
        502,
        'VK_API_ERROR',
        `VK API error ${details.vkErrorCode}: ${details.vkErrorMessage}`
      );
    }
    if (!payload || payload.response !== 1) {
      throw new HttpError(502, 'VK_API_ERROR', 'VK API request failed');
    }
  }
}

module.exports = {
  VkApiService,
  VK_API_URL,
  VK_API_TIMEOUT_MS,
  safeVkError
};
