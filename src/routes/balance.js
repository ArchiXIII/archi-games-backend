'use strict';

const { json } = require('../response');

async function balanceRoute(context) {
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
    updatedAt: player.updatedAt
  });
}

module.exports = { balanceRoute };
