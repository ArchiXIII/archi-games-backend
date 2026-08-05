'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, executeCached, rows } = require('../ydb');

const COLUMNS = `
  platform_user_id, player_name, total_stars
`;

class LeaderboardRepository {
  constructor(config) {
    this.config = config;
  }

  async sync(gameId, platform, userId, totalStars, playerName) {
    return withSession(this.config, async (session) => {
      await executeCached(session, `
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
          AND platform_user_id = $user_id
          AND (
            $total_stars > total_stars OR
            ($player_name != "" AND $player_name != COALESCE(player_name, ""))
          );
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
      `, {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $user_id: TypedValues.utf8(userId),
        $total_stars: TypedValues.int64(totalStars),
        $player_name: TypedValues.utf8(playerName)
      });
      return { total_stars: totalStars };
    });
  }

  async list(gameId, platform, limit, offset) {
    return withSession(this.config, async (session) => {
      const params = {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $limit: TypedValues.uint64(limit),
        $offset: TypedValues.uint64(offset)
      };
      const result = await executeCached(session, `
        DECLARE $game_id AS Utf8;
        DECLARE $platform AS Utf8;
        DECLARE $limit AS Uint64;
        DECLARE $offset AS Uint64;
        SELECT ${COLUMNS}
        FROM leaderboard_totals
        WHERE game_id = $game_id AND platform = $platform
        ORDER BY total_stars DESC, platform_user_id ASC
        LIMIT $limit OFFSET $offset;
      `, params);
      return { entries: rows(result, 0) };
    });
  }

  async remove(gameId, platform, userId) {
    return withSession(this.config, async (session) => {
      await executeCached(session, `
        DECLARE $game_id AS Utf8;
        DECLARE $platform AS Utf8;
        DECLARE $user_id AS Utf8;
        DELETE FROM leaderboard_totals
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
      `, {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $user_id: TypedValues.utf8(userId)
      });
      return true;
    });
  }
}

module.exports = { LeaderboardRepository };
