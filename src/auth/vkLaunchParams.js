'use strict';

const crypto = require('node:crypto');
const { HttpError } = require('../response');

function parseLaunchParams(raw) {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 8192) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  const sign = params.get('sign');
  const userId = params.get('vk_user_id');
  if (!sign || !userId || !/^\d{1,20}$/.test(userId)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  return { params, sign, userId };
}

function createSignature(params, secret) {
  const signed = [];
  for (const [key, value] of params) {
    if (key.startsWith('vk_')) signed.push([key, value]);
  }
  signed.sort((a, b) => a[0].localeCompare(b[0]));
  const query = new URLSearchParams(signed).toString();
  return crypto.createHmac('sha256', secret).update(query).digest('base64url');
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyVkLaunchParams(raw, secret, expectedAppId) {
  if (!secret) throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');
  const parsed = parseLaunchParams(raw);
  if (expectedAppId && parsed.params.get('vk_app_id') !== String(expectedAppId)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  if (!safeEqual(createSignature(parsed.params, secret), parsed.sign)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  return { userId: parsed.userId };
}

module.exports = { verifyVkLaunchParams, createSignature, safeEqual };
