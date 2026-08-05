DELETE FROM leaderboard_totals ON
SELECT game_id, platform, platform_user_id
FROM (
  SELECT
    game_id,
    platform,
    platform_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY game_id, platform
      ORDER BY total_stars DESC, platform_user_id ASC
    ) AS position
  FROM leaderboard_totals
)
WHERE position > 10;

ALTER TABLE leaderboard_totals DROP INDEX idx_leaderboard_stars;
