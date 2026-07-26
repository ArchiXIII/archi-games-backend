'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, rows } = require('../ydb');
const { numberValue } = require('./playersRepository');

class OrdersRepository {
  constructor(config) {
    this.config = config;
  }

  async grantPurchase(order) {
    return withSession(this.config, async (session) => {
      const result = await session.executeQuery(`
        DECLARE $platform AS Utf8;
        DECLARE $order_id AS Utf8;
        DECLARE $game_id AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $product_id AS Utf8;
        DECLARE $coins AS Int64;
        $is_new = NOT EXISTS (
          SELECT 1 FROM orders
          WHERE platform = $platform AND platform_order_id = $order_id
        );
        INSERT INTO players
          (game_id, platform, platform_user_id, coins, created_at, updated_at)
        SELECT $game_id, $platform, $user_id, 0, CurrentUtcTimestamp(), CurrentUtcTimestamp()
        WHERE $is_new AND NOT EXISTS (
          SELECT 1 FROM players
          WHERE game_id = $game_id AND platform = $platform AND platform_user_id = $user_id
        );
        INSERT INTO orders
          (platform, platform_order_id, game_id, platform_user_id, product_id,
           coins, status, granted, created_at, updated_at)
        SELECT $platform, $order_id, $game_id, $user_id, $product_id,
               $coins, "completed", true, CurrentUtcTimestamp(), CurrentUtcTimestamp()
        WHERE $is_new;
        UPDATE players SET
          coins = coins + $coins,
          updated_at = CurrentUtcTimestamp()
        WHERE $is_new AND game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
        SELECT $is_new AS granted;
        SELECT coins, updated_at FROM players
        WHERE game_id = $game_id AND platform = $platform AND platform_user_id = $user_id;
      `, {
        $platform: TypedValues.utf8(order.platform),
        $order_id: TypedValues.utf8(order.orderId),
        $game_id: TypedValues.utf8(order.gameId),
        $user_id: TypedValues.utf8(order.userId),
        $product_id: TypedValues.utf8(order.productId),
        $coins: TypedValues.int64(order.coins)
      });
      const grantRow = rows(result, 0).at(0);
      const playerRow = rows(result, 1).at(0);
      return {
        granted: Boolean(grantRow.granted),
        coins: numberValue(playerRow.coins),
        updatedAt: new Date(playerRow.updated_at).toISOString()
      };
    });
  }
}

module.exports = { OrdersRepository };
