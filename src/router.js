'use strict';

const crypto = require('node:crypto');
const logger = require('./logger');
const { HttpError, error } = require('./response');
const { verifyVkLaunchParams } = require('./auth/vkLaunchParams');
const { verifyOkLaunchParams, isOkLaunchParams } = require('./auth/okLaunchParams');
const { healthRoute } = require('./routes/health');
const { syncLeaderboardRoute, starsLeaderboardRoute } = require('./routes/leaderboards');
const { pendingPurchaseEventsRoute, ackPurchaseEventRoute } = require('./routes/purchaseEvents');
const { vkEndlessScoreRoute } = require('./routes/vkEndlessScore');
const { vkPaymentsCallbackRoute } = require('./routes/vkPaymentsCallback');
const { okPaymentsCallbackRoute } = require('./routes/okPaymentsCallback');
const {
  okEndlessScoreRoute,
  okEndlessLeaderboardRoute
} = require('./routes/okEndlessLeaderboard');

const ROUTES = new Map([
  ['GET /health', { handler: healthRoute }],
  ['POST /v1/leaderboards/sync', { handler: syncLeaderboardRoute, auth: 'client', json: true }],
  ['GET /v1/leaderboards/stars', { handler: starsLeaderboardRoute, auth: 'client' }],
  ['GET /v1/purchase-events/pending', { handler: pendingPurchaseEventsRoute, auth: 'client' }],
  ['POST /v1/purchase-events/ack', { handler: ackPurchaseEventRoute, auth: 'client', json: true }],
  ['POST /v1/vk/endless-score', { handler: vkEndlessScoreRoute, auth: 'vk', json: true }],
  ['POST /v1/vk/payments/callback', { handler: vkPaymentsCallbackRoute, json: true }],
  ['POST /v1/ok/endless-score', { handler: okEndlessScoreRoute, auth: 'ok', json: true }],
  ['GET /v1/ok/leaderboards/endless', { handler: okEndlessLeaderboardRoute, auth: 'ok' }],
  ['GET /v1/ok/payments/callback', { handler: okPaymentsCallbackRoute }]
]);

function normalizeHeaders(headers) {
  const result = {};
  if (!headers) return result;
  for (const key of Object.keys(headers)) result[key.toLowerCase()] = String(headers[key]);
  return result;
}

function requestId(event) {
  return String(
    (event.requestContext && (event.requestContext.requestId || event.requestContext.request_id)) ||
    event.requestId ||
    crypto.randomUUID()
  ).slice(0, 128);
}

function parseBody(event, headers, maxBytes) {
  const contentType = (headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  let raw = event.body == null ? '' : String(event.body);
  if (event.isBase64Encoded) {
    try {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
  }
  if (Buffer.byteLength(raw) > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Invalid JSON');
  }
}

function authenticate(headers, config, platform) {
  const raw = headers['x-vk-launch-params'] || '';
  const okClient = isOkLaunchParams(raw);
  if (platform === 'vk') {
    if (okClient) throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
    const auth = verifyVkLaunchParams(raw, config.vkAppSecret, config.vkAppId);
    return { ...auth, platform: 'vk' };
  }
  if (platform === 'ok') {
    if (!okClient) throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
    return verifyOkLaunchParams(
      raw,
      config.okAppSecret,
      config.okVkAppId,
      config.okAppId
    );
  }
  if (!okClient) {
    const auth = verifyVkLaunchParams(raw, config.vkAppSecret, config.vkAppId);
    return { ...auth, platform: 'vk' };
  }
  return verifyOkLaunchParams(
    raw,
    config.okAppSecret,
    config.okVkAppId,
    config.okAppId
  );
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-VK-Launch-Params,X-Request-Id',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

function createRouter(dependencies) {
  return async function route(event = {}) {
    const id = requestId(event);
    const headers = normalizeHeaders(event.headers);
    const origin = headers.origin;
    const cors = corsHeaders(origin, dependencies.config.allowedOrigins);
    const responseHeaders = { ...cors, 'X-Request-Id': id };
    const method = String(event.httpMethod || event.requestContext?.http?.method || 'GET').toUpperCase();
    const path = String(event.path || event.rawPath || '/').split('?', 1)[0].replace(/\/+$/, '') || '/';

    if (method === 'OPTIONS') {
      if (origin && Object.keys(cors).length) {
        return { statusCode: 204, headers: responseHeaders, body: '' };
      }
      return error(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed', responseHeaders);
    }

    const routeConfig = ROUTES.get(`${method} ${path}`);
    if (!routeConfig) return error(404, 'NOT_FOUND', 'Not found', responseHeaders);

    try {
      const context = { ...dependencies, requestId: id, event, headers };
      if (routeConfig.json) context.body = parseBody(event, headers, dependencies.config.maxBodyBytes);
      if (routeConfig.auth) context.auth = authenticate(headers, dependencies.config, routeConfig.auth);
      const response = await routeConfig.handler(context);
      response.headers = { ...response.headers, ...responseHeaders };
      logger.info({ requestId: id, method, path, statusCode: response.statusCode });
      return response;
    } catch (cause) {
      if (!(cause instanceof HttpError)) {
        logger.error({
          requestId: id,
          method,
          path,
          error: cause && cause.message,
          stack: dependencies.config.nodeEnv === 'production' ? undefined : cause && cause.stack
        });
      }
      const statusCode = cause instanceof HttpError ? cause.statusCode : 500;
      const code = cause instanceof HttpError ? cause.code : 'INTERNAL_ERROR';
      const message = cause instanceof HttpError ? cause.message : 'Internal server error';
      return error(statusCode, code, message, responseHeaders);
    }
  };
}

module.exports = { createRouter, parseBody, normalizeHeaders, corsHeaders, authenticate };
