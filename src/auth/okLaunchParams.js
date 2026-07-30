'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../response');
const { safeEqual } = require('./vkLaunchParams');

function createOkAuthSignature(userId, sessionKey, secret) {
  return crypto.createHash('md5')
    .update(String(userId))
    .update(String(sessionKey))
    .update(String(secret))
    .digest('hex');
}

function verifyOkLaunchParams(raw, secret, expectedAppKey) {
  if (!secret || !expectedAppKey) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');
  }
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 8192) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  const userId = params.get('logged_user_id');
  const sessionKey = params.get('session_key');
  const authSignature = params.get('auth_sig');
  if (!userId || !/^\d{1,20}$/.test(userId) ||
      !sessionKey || sessionKey.length > 512 ||
      !/^[a-f0-9]{32}$/i.test(authSignature || '') ||
      params.get('authorized') !== '1' ||
      params.get('application_key') !== String(expectedAppKey) ||
      !safeEqual(
        createOkAuthSignature(userId, sessionKey, secret).toLowerCase(),
        authSignature.toLowerCase()
      )) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  return { userId, platform: 'ok' };
}

module.exports = { verifyOkLaunchParams, createOkAuthSignature };
