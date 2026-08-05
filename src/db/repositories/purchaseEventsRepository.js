'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, executeCached, rows } = require('../ydb');
const { numberValue } = require('../values');

class PurchaseEventsRepository {
  constructor(config) {
    this.config = config;
  }

  async pending(gameId, platform, userId) {
    const result = await withSession(this.config, (session) => executeCached(session, `
      DECLARE $game_id AS Utf8;
      DECLARE $platform AS Utf8;
      DECLARE $user_id AS Utf8;
      SELECT event_id, platform_order_id, event_type, coins_delta
      FROM purchase_events VIEW idx_purchase_events_delivery
      WHERE game_id = $game_id AND platform = $platform
        AND platform_user_id = $user_id AND delivered_at IS NULL
      ORDER BY created_at ASC, event_id ASC
      LIMIT 100;
    `, {
      $game_id: TypedValues.utf8(gameId),
      $platform: TypedValues.utf8(platform),
      $user_id: TypedValues.utf8(userId)
    }));
    return rows(result).map((row) => ({
      eventId: String(row.event_id),
      orderId: String(row.platform_order_id),
      type: String(row.event_type),
      coinsDelta: numberValue(row.coins_delta)
    }));
  }

  async ack(gameId, platform, userId, eventId) {
    await withSession(this.config, (session) => executeCached(session, `
      DECLARE $game_id AS Utf8;
      DECLARE $platform AS Utf8;
      DECLARE $user_id AS Utf8;
      DECLARE $event_id AS Utf8;
      UPDATE purchase_events SET delivered_at = COALESCE(delivered_at, CurrentUtcTimestamp())
      WHERE event_id = $event_id AND game_id = $game_id AND platform = $platform
        AND platform_user_id = $user_id;
    `, {
      $game_id: TypedValues.utf8(gameId),
      $platform: TypedValues.utf8(platform),
      $user_id: TypedValues.utf8(userId),
      $event_id: TypedValues.utf8(eventId)
    }));
  }
}

module.exports = { PurchaseEventsRepository };
