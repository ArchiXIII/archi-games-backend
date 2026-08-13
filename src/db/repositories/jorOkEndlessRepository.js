'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession, executeCached, rows } = require('../ydb');

class JorOkEndlessRepository {
  constructor(config) {
    this.config = config;
  }

  async sync(userId, bestScore, playerName) {
    return withSession(this.config, async (session) => {
      const result = await executeCached(session, `
        DECLARE $user_id AS Utf8;
        DECLARE $best_score AS Int64;
        DECLARE $player_name AS Utf8;
        UPDATE jor_ok_endless_top SET
          updated_at = CASE
            WHEN $best_score > best_score THEN CurrentUtcTimestamp()
            ELSE updated_at
          END,
          best_score = MAX_OF(best_score, $best_score),
          player_name = CASE
            WHEN $player_name != "" THEN $player_name
            ELSE player_name
          END
        WHERE platform_user_id = $user_id AND (
          $best_score > best_score OR
          ($player_name != "" AND $player_name != player_name)
        );
        INSERT INTO jor_ok_endless_top
          (platform_user_id, player_name, best_score, updated_at)
        SELECT $user_id,
               CASE WHEN $player_name != "" THEN $player_name ELSE $user_id END,
               $best_score,
               CurrentUtcTimestamp()
        FROM (VALUES (1)) AS seed(dummy)
        WHERE NOT EXISTS (
          SELECT 1 FROM jor_ok_endless_top WHERE platform_user_id = $user_id
        );
        DELETE FROM jor_ok_endless_top ON
        SELECT platform_user_id
        FROM jor_ok_endless_top VIEW idx_jor_ok_endless_score
        ORDER BY best_score DESC, platform_user_id ASC
        LIMIT 1000 OFFSET 10;
        SELECT platform_user_id, player_name, best_score
        FROM jor_ok_endless_top VIEW idx_jor_ok_endless_score
        ORDER BY best_score DESC, platform_user_id ASC
        LIMIT 10;
      `, {
        $user_id: TypedValues.utf8(userId),
        $best_score: TypedValues.int64(bestScore),
        $player_name: TypedValues.utf8(playerName)
      });
      return rows(result, 0);
    });
  }

  async list() {
    return withSession(this.config, async (session) => {
      const result = await executeCached(session, `
        SELECT platform_user_id, player_name, best_score
        FROM jor_ok_endless_top VIEW idx_jor_ok_endless_score
        ORDER BY best_score DESC, platform_user_id ASC
        LIMIT 10;
      `);
      return rows(result, 0);
    });
  }
}

module.exports = { JorOkEndlessRepository };
