'use strict';

const { HttpError, json } = require('../response');

async function jorVkEndlessScoreRoute(context) {
  const body = context.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'score') ||
      !Number.isSafeInteger(body.score) || body.score < 0) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  await context.jorVkApiService.submitEndlessScore(context.auth.userId, body.score);
  return json(200, { ok: true, score: body.score });
}

async function jorOkEndlessScoreRoute(context) {
  const result = await context.jorOkEndlessService.sync(context.auth.userId, context.body);
  return json(200, { ok: true, ...result });
}

async function jorOkEndlessLeaderboardRoute(context) {
  return json(200, await context.jorOkEndlessService.list(context.auth.userId));
}

module.exports = {
  jorVkEndlessScoreRoute,
  jorOkEndlessScoreRoute,
  jorOkEndlessLeaderboardRoute
};
