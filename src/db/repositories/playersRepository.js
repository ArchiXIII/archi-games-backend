'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, rows } = require('../ydb');

function numberValue(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

class PlayersRepository {
  constructor(config) {
    this.config = config;
  }

  async getOrCreate(gameId, platform, userId) {
    return withSession(this.config, async (session) => {
      const result = await session.executeQuery(`
        DECLARE $game_id AS Utf8;
        DECLARE $platform AS Utf8;
        DECLARE $user_id AS Utf8;
        INSERT INTO players
          (game_id, platform, platform_user_id, coins, created_at, updated_at)
        SELECT $game_id, $platform, $user_id, 0, CurrentUtcTimestamp(), CurrentUtcTimestamp()
        WHERE NOT EXISTS (
          SELECT 1 FROM players
          WHERE game_id = $game_id AND platform = $platform AND platform_user_id = $user_id
        );
        SELECT coins, updated_at FROM players
        WHERE game_id = $game_id AND platform = $platform AND platform_user_id = $user_id;
      `, {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $user_id: TypedValues.utf8(userId)
      });
      const row = rows(result).at(0);
      return {
        gameId,
        platform,
        userId,
        coins: numberValue(row.coins),
        updatedAt: new Date(row.updated_at).toISOString()
      };
    });
  }
}

module.exports = { PlayersRepository, numberValue };
