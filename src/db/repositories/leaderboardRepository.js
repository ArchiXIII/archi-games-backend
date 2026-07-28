'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, rows } = require('../ydb');
const { numberValue } = require('../values');

const COLUMNS = `
  platform_user_id, player_name, avatar_url, total_stars, updated_at
`;

class LeaderboardRepository {
  constructor(config) {
    this.config = config;
  }

  async sync(gameId, platform, userId, totalStars, playerName) {
    return withSession(this.config, async (session) => {
      const result = await session.executeQuery(`
        DECLARE $game_id AS Utf8;
        DECLARE $platform AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $total_stars AS Int64;
        DECLARE $player_name AS Utf8;
        UPDATE leaderboard_totals SET
          total_stars = MAX_OF(total_stars, $total_stars),
          player_name = CASE
            WHEN $player_name != "" THEN $player_name
            ELSE player_name
          END,
          updated_at = CurrentUtcTimestamp()
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
        INSERT INTO leaderboard_totals
          (game_id, platform, platform_user_id, player_name, avatar_url,
           total_stars, total_xp, updated_at)
        SELECT $game_id, $platform, $user_id,
               CASE WHEN $player_name != "" THEN $player_name ELSE $user_id END,
               NULL,
               $total_stars, 0, CurrentUtcTimestamp()
        FROM (VALUES (1)) AS seed(dummy)
        WHERE NOT EXISTS (
          SELECT 1 FROM leaderboard_totals
          WHERE game_id = $game_id AND platform = $platform
            AND platform_user_id = $user_id
        );
        SELECT ${COLUMNS} FROM leaderboard_totals
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
      `, {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $user_id: TypedValues.utf8(userId),
        $total_stars: TypedValues.int64(totalStars),
        $player_name: TypedValues.utf8(playerName)
      });
      return rows(result).at(0);
    });
  }

  async list(gameId, platform, userId, limit, offset) {
    return withSession(this.config, async (session) => {
      const params = {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $user_id: TypedValues.utf8(userId),
        $limit: TypedValues.uint64(limit),
        $offset: TypedValues.uint64(offset)
      };
      const result = await session.executeQuery(`
        DECLARE $game_id AS Utf8;
        DECLARE $platform AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $limit AS Uint64;
        DECLARE $offset AS Uint64;
        SELECT ${COLUMNS}
        FROM leaderboard_totals VIEW idx_leaderboard_stars
        WHERE game_id = $game_id AND platform = $platform
        ORDER BY total_stars DESC, platform_user_id ASC
        LIMIT $limit OFFSET $offset;
        SELECT ${COLUMNS}
        FROM leaderboard_totals
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
      `, params);
      const entries = rows(result, 0);
      const current = rows(result, 1).at(0);
      let rank = null;
      if (current) {
        const rankResult = await session.executeQuery(`
          DECLARE $game_id AS Utf8;
          DECLARE $platform AS Utf8;
          DECLARE $user_id AS Utf8;
          DECLARE $score AS Int64;
          SELECT COUNT(*) AS preceding
          FROM leaderboard_totals VIEW idx_leaderboard_stars
          WHERE game_id = $game_id AND platform = $platform
            AND (total_stars > $score OR
              (total_stars = $score AND platform_user_id < $user_id));
        `, {
          $game_id: params.$game_id,
          $platform: params.$platform,
          $user_id: params.$user_id,
          $score: TypedValues.int64(numberValue(current.total_stars))
        });
        rank = numberValue(rows(rankResult).at(0).preceding) + 1;
      }
      return { entries, current, rank };
    });
  }
}

module.exports = { LeaderboardRepository };
