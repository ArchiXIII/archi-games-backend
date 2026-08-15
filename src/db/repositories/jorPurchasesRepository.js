'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, executeCached, rows } = require('../ydb');

class JorPurchasesRepository {
  constructor(config) {
    this.config = config;
  }

  async grant(order) {
    return withSession(this.config, async (session) => {
      const result = await executeCached(session, `
        DECLARE $platform AS Utf8;
        DECLARE $order_id AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $product_id AS Utf8;
        DECLARE $duration_days AS Uint32;
        DECLARE $completed AS Utf8;
        $is_new = NOT EXISTS (
          SELECT 1 FROM jor_purchases
          WHERE platform = $platform AND platform_order_id = $order_id
        );
        INSERT INTO jor_purchases
          (platform, platform_order_id, platform_user_id, product_id, status,
           duration_days, purchased_at, updated_at)
        SELECT $platform, $order_id, $user_id, $product_id, $completed,
               $duration_days, CurrentUtcTimestamp(), CurrentUtcTimestamp()
        FROM (VALUES (1)) AS seed(dummy)
        WHERE $is_new;
        SELECT $is_new AS created;
      `, {
        $platform: TypedValues.utf8(order.platform),
        $order_id: TypedValues.utf8(order.orderId),
        $user_id: TypedValues.utf8(order.userId),
        $product_id: TypedValues.utf8(order.productId),
        $duration_days: TypedValues.uint32(order.durationDays),
        $completed: TypedValues.utf8('completed')
      });
      return { created: Boolean(rows(result).at(0).created) };
    });
  }

  async refund(platform, orderId) {
    return withSession(this.config, async (session) => {
      const result = await executeCached(session, `
        DECLARE $platform AS Utf8;
        DECLARE $order_id AS Utf8;
        DECLARE $refunded AS Utf8;
        $can_refund = EXISTS (
          SELECT 1 FROM jor_purchases
          WHERE platform = $platform AND platform_order_id = $order_id
            AND status != $refunded
        );
        UPDATE jor_purchases SET
          status = $refunded,
          refunded_at = CurrentUtcTimestamp(),
          updated_at = CurrentUtcTimestamp()
        WHERE $can_refund AND platform = $platform AND platform_order_id = $order_id;
        SELECT $can_refund AS refunded;
      `, {
        $platform: TypedValues.utf8(platform),
        $order_id: TypedValues.utf8(orderId),
        $refunded: TypedValues.utf8('refunded')
      });
      return { refunded: Boolean(rows(result).at(0).refunded) };
    });
  }

  async list(platform, userId) {
    const result = await withSession(this.config, (session) => executeCached(session, `
      DECLARE $platform AS Utf8;
      DECLARE $user_id AS Utf8;
      SELECT platform_order_id, product_id, duration_days, purchased_at
      FROM jor_purchases VIEW idx_jor_purchases_user
      WHERE platform = $platform AND platform_user_id = $user_id
        AND status = "completed";
    `, {
      $platform: TypedValues.utf8(platform),
      $user_id: TypedValues.utf8(userId)
    }));
    return rows(result);
  }
}

module.exports = { JorPurchasesRepository };
