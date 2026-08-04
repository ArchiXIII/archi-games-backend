'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, rows } = require('../ydb');
const { numberValue } = require('../values');

const COLUMNS = `
  platform_user_id, player_name, best_score, updated_at
`;

class EndlessLeaderboardRepository {
  constructor(config) {
    this.config = config;
  }

  async sync(gameId, platform, userId, bestScore, playerName) {
    return withSession(this.config, async (session) => {
      const result = await session.executeQuery(`
        DECLARE $game_id AS Utf8;
        DECLARE $platform AS Utf8;
        DECLARE $user_id AS Utf8;
        DECLARE $best_score AS Int64;
        DECLARE $player_name AS Utf8;
        UPDATE endless_leaderboard SET
          updated_at = CASE
            WHEN $best_score > best_score THEN CurrentUtcTimestamp()
            ELSE updated_at
          END,
          best_score = MAX_OF(best_score, $best_score),
          player_name = CASE
            WHEN $player_name != "" THEN $player_name
            ELSE player_name
          END
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id
          AND (
            $best_score > best_score OR
            ($player_name != "" AND $player_name != COALESCE(player_name, ""))
          );
        INSERT INTO endless_leaderboard
          (game_id, platform, platform_user_id, player_name, best_score, updated_at)
        SELECT $game_id, $platform, $user_id,
               CASE WHEN $player_name != "" THEN $player_name ELSE $user_id END,
               $best_score, CurrentUtcTimestamp()
        FROM (VALUES (1)) AS seed(dummy)
        WHERE NOT EXISTS (
          SELECT 1 FROM endless_leaderboard
          WHERE game_id = $game_id AND platform = $platform
            AND platform_user_id = $user_id
        );
        SELECT ${COLUMNS} FROM endless_leaderboard
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
      `, {
        $game_id: TypedValues.utf8(gameId),
        $platform: TypedValues.utf8(platform),
        $user_id: TypedValues.utf8(userId),
        $best_score: TypedValues.int64(bestScore),
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
        FROM endless_leaderboard VIEW idx_endless_score
        WHERE game_id = $game_id AND platform = $platform
        ORDER BY best_score DESC, platform_user_id ASC
        LIMIT $limit OFFSET $offset;
        SELECT ${COLUMNS}
        FROM endless_leaderboard
        WHERE game_id = $game_id AND platform = $platform
          AND platform_user_id = $user_id;
      `, params);
      const entries = rows(result, 0);
      const current = rows(result, 1).at(0);
      let rank = null;
      if (current) {
        const visibleIndex = entries.findIndex((row) => String(row.platform_user_id) === userId);
        if (visibleIndex >= 0) {
          rank = offset + visibleIndex + 1;
        } else {
          const rankResult = await session.executeQuery(`
            DECLARE $game_id AS Utf8;
            DECLARE $platform AS Utf8;
            DECLARE $user_id AS Utf8;
            DECLARE $score AS Int64;
            SELECT COUNT(*) AS preceding
            FROM endless_leaderboard VIEW idx_endless_score
            WHERE game_id = $game_id AND platform = $platform
              AND (best_score > $score OR
                (best_score = $score AND platform_user_id < $user_id));
          `, {
            $game_id: params.$game_id,
            $platform: params.$platform,
            $user_id: params.$user_id,
            $score: TypedValues.int64(numberValue(current.best_score))
          });
          rank = numberValue(rows(rankResult).at(0).preceding) + 1;
        }
      }
      return { entries, current, rank };
    });
  }
}

module.exports = { EndlessLeaderboardRepository };
