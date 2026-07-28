'use strict';

const { HttpError, json } = require('../response');

async function vkEndlessScoreRoute(context) {
  const body = context.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'score') ||
      !Number.isSafeInteger(body.score) || body.score < 0) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  await context.vkApiService.submitEndlessScore(context.auth.userId, body.score);
  return json(200, { ok: true, score: body.score });
}

module.exports = { vkEndlessScoreRoute };
