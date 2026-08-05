'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, executeCached, rows } = require('../ydb');
const { numberValue } = require('../values');

class OrdersRepository {
  constructor(config) {
    this.config = config;
  }

  async createGrant(order) {
    return withSession(this.config, async (session) => {
      const result = await executeCached(session, `
        DECLARE $platform AS Utf8;
        DECLARE $order_id AS Utf8;
        DECLARE $event_id AS Utf8;
        DECLARE $game_id AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $product_id AS Utf8;
        DECLARE $coins AS Int64;
        DECLARE $payload AS Json;
        DECLARE $completed_status AS Utf8;
        DECLARE $grant_type AS Utf8;
        $is_new = NOT EXISTS (
          SELECT 1 FROM orders
          WHERE platform = $platform AND platform_order_id = $order_id
        );
        INSERT INTO orders
          (platform, platform_order_id, game_id, platform_user_id, product_id,
           coins, status, granted, created_at, updated_at)
        SELECT $platform, $order_id, $game_id, $user_id, $product_id,
               $coins, $completed_status, true,
               CurrentUtcTimestamp(), CurrentUtcTimestamp()
        FROM (VALUES (1)) AS seed(dummy)
        WHERE $is_new;
        INSERT INTO purchase_events
          (event_id, platform, platform_order_id, event_type, payload_json,
           created_at, game_id, platform_user_id, coins_delta, delivered_at)
        SELECT $event_id, $platform, $order_id, $grant_type, $payload,
               CurrentUtcTimestamp(), $game_id, $user_id, $coins, NULL
        FROM (VALUES (1)) AS seed(dummy)
        WHERE $is_new;
        SELECT $is_new AS created;
      `, {
        $platform: TypedValues.utf8(order.platform),
        $order_id: TypedValues.utf8(order.orderId),
        $event_id: TypedValues.utf8(order.eventId),
        $game_id: TypedValues.utf8(order.gameId),
        $user_id: TypedValues.utf8(order.userId),
        $product_id: TypedValues.utf8(order.productId),
        $coins: TypedValues.int64(order.coins),
        $completed_status: TypedValues.utf8('completed'),
        $grant_type: TypedValues.utf8('grant'),
        $payload: TypedValues.json(JSON.stringify({
          productId: order.productId,
          coinsDelta: order.coins
        }))
      });
      return {
        created: Boolean(rows(result).at(0).created),
        eventId: order.eventId
      };
    });
  }

  async get(platform, orderId) {
    const result = await withSession(this.config, (session) => executeCached(session, `
      DECLARE $platform AS Utf8;
      DECLARE $order_id AS Utf8;
      SELECT game_id, platform_user_id, product_id, coins, status
      FROM orders
      WHERE platform = $platform AND platform_order_id = $order_id;
    `, {
      $platform: TypedValues.utf8(platform),
      $order_id: TypedValues.utf8(orderId)
    }));
    const row = rows(result).at(0);
    if (!row) return null;
    return {
      gameId: String(row.game_id),
      userId: String(row.platform_user_id),
      productId: String(row.product_id),
      coins: numberValue(row.coins),
      status: String(row.status)
    };
  }

  async createRefund(refund) {
    return withSession(this.config, async (session) => {
      const result = await executeCached(session, `
        DECLARE $platform AS Utf8;
        DECLARE $order_id AS Utf8;
        DECLARE $event_id AS Utf8;
        DECLARE $game_id AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $coins_delta AS Int64;
        DECLARE $payload AS Json;
        DECLARE $refunded_status AS Utf8;
        DECLARE $refund_type AS Utf8;
        $is_new = EXISTS (
          SELECT 1 FROM orders
          WHERE platform = $platform AND platform_order_id = $order_id
            AND status != $refunded_status
        );
        UPDATE orders SET
          status = $refunded_status,
          refunded_at = CurrentUtcTimestamp(),
          updated_at = CurrentUtcTimestamp()
        WHERE $is_new AND platform = $platform AND platform_order_id = $order_id;
        INSERT INTO purchase_events
          (event_id, platform, platform_order_id, event_type, payload_json,
           created_at, game_id, platform_user_id, coins_delta, delivered_at)
        SELECT $event_id, $platform, $order_id, $refund_type, $payload,
               CurrentUtcTimestamp(), $game_id, $user_id, $coins_delta, NULL
        FROM (VALUES (1)) AS seed(dummy)
        WHERE $is_new;
        SELECT $is_new AS created;
      `, {
        $platform: TypedValues.utf8(refund.platform),
        $order_id: TypedValues.utf8(refund.orderId),
        $event_id: TypedValues.utf8(refund.eventId),
        $game_id: TypedValues.utf8(refund.gameId),
        $user_id: TypedValues.utf8(refund.userId),
        $coins_delta: TypedValues.int64(-refund.coins),
        $refunded_status: TypedValues.utf8('refunded'),
        $refund_type: TypedValues.utf8('refund'),
        $payload: TypedValues.json(JSON.stringify({
          productId: refund.productId,
          coinsDelta: -refund.coins
        }))
      });
      return {
        created: Boolean(rows(result).at(0).created),
        eventId: refund.eventId
      };
    });
  }
}

module.exports = { OrdersRepository };
