'use strict';

const { HttpError, json } = require('../response');

const SETTINGS = new Set(['soundEnabled', 'musicEnabled', 'language', 'vibrationEnabled']);
const PROGRESS = new Set(['tutorialCompleted', 'selectedLevel']);

function pick(source, allowed) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const result = {};
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    const value = source[key];
    if (typeof value !== 'string' && typeof value !== 'boolean' && !Number.isSafeInteger(value)) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    result[key] = value;
  }
  return result;
}

async function syncRoute(context) {
  const body = context.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  for (const key of Object.keys(body)) {
    if (key !== 'settings' && key !== 'progress') {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
  }
  const player = await context.balanceService.get(
    context.config.gameId,
    context.config.platform,
    context.auth.userId
  );
  return json(200, {
    ok: true,
    gameId: player.gameId,
    userId: player.userId,
    coins: player.coins,
    settings: pick(body.settings, SETTINGS),
    progress: pick(body.progress, PROGRESS),
    updatedAt: player.updatedAt
  });
}

module.exports = { syncRoute, pick };
