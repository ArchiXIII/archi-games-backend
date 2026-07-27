'use strict';

const { json } = require('../response');

async function syncLeaderboardRoute(context) {
  const result = await context.leaderboardService.sync(
    context.config.gameId,
    context.config.platform,
    context.auth.userId,
    context.body
  );
  return json(200, { ok: true, ...result });
}

function leaderboardRoute(board) {
  return async (context) => {
    const result = await context.leaderboardService.list(
      context.config.gameId,
      context.config.platform,
      context.auth.userId,
      board,
      context.event.queryStringParameters
    );
    return json(200, result);
  };
}

module.exports = { syncLeaderboardRoute, leaderboardRoute };
