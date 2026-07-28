'use strict';

const { HttpError } = require('../response');

const VK_API_URL = 'https://api.vk.com/method/secure.addAppEvent';
const VK_API_TIMEOUT_MS = 3500;

class VkApiService {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.serviceToken = config.vkServiceToken;
    this.apiVersion = config.vkApiVersion || '5.199';
    this.fetch = fetchImpl;
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
    if (!payload || payload.error || payload.response !== 1) {
      throw new HttpError(502, 'VK_API_ERROR', 'VK API request failed');
    }
  }
}

module.exports = { VkApiService, VK_API_URL, VK_API_TIMEOUT_MS };
