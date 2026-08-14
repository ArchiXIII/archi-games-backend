DELETE FROM endless_leaderboard ON
SELECT game_id, platform, platform_user_id
FROM (
  SELECT
    game_id,
    platform,
    platform_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY game_id, platform
      ORDER BY best_score DESC, platform_user_id ASC
    ) AS position
  FROM endless_leaderboard
)
WHERE position > 10;

ALTER TABLE endless_leaderboard DROP INDEX idx_endless_score;
