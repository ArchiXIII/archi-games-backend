'use strict';

const { json } = require('../response');

async function okEndlessScoreRoute(context) {
  const result = await context.endlessLeaderboardService.sync(
    context.config.gameId,
    context.auth.platform,
    context.auth.userId,
    context.body
  );
  return json(200, { ok: true, ...result });
}

async function okEndlessLeaderboardRoute(context) {
  const result = await context.endlessLeaderboardService.list(
    context.config.gameId,
    context.auth.platform,
    context.auth.userId,
    context.event.queryStringParameters
  );
  return json(200, result);
}

module.exports = { okEndlessScoreRoute, okEndlessLeaderboardRoute };
