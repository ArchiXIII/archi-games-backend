'use strict';

const { HttpError } = require('../response');
const { verifyVkLaunchParams } = require('./vkLaunchParams');

function launchParams(raw) {
  return new URLSearchParams(
    typeof raw === 'string' && raw.startsWith('?') ? raw.slice(1) : raw
  );
}

function isOkLaunchParams(raw) {
  return launchParams(raw).get('vk_client') === 'ok';
}

function verifyOkLaunchParams(raw, secret, expectedOkVkAppId, expectedOkAppId) {
  if (!expectedOkAppId) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');
  }
  verifyVkLaunchParams(raw, secret, expectedOkVkAppId);
  const params = launchParams(raw);
  const userId = params.get('vk_ok_user_id');
  if (params.get('vk_client') !== 'ok' ||
      params.get('vk_ok_app_id') !== String(expectedOkAppId) ||
      !userId || !/^\d{1,20}$/.test(userId)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  return { userId, platform: 'ok' };
}

module.exports = { verifyOkLaunchParams, isOkLaunchParams };
