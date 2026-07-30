'use strict';

const { json } = require('../response');

async function pendingPurchaseEventsRoute(context) {
  const events = await context.purchaseEventsService.pending(
    context.config.gameId,
    context.auth.platform,
    context.auth.userId
  );
  return json(200, { events });
}

async function ackPurchaseEventRoute(context) {
  const eventId = await context.purchaseEventsService.ack(
    context.config.gameId,
    context.auth.platform,
    context.auth.userId,
    context.body
  );
  return json(200, { ok: true, eventId });
}

module.exports = { pendingPurchaseEventsRoute, ackPurchaseEventRoute };
