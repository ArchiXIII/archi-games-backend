ALTER TABLE leaderboard_totals DROP INDEX idx_leaderboard_stars;

ALTER TABLE leaderboard_totals ADD INDEX idx_leaderboard_stars GLOBAL
  ON (game_id, platform, total_stars, platform_user_id)
  COVER (player_name);

ALTER TABLE endless_leaderboard DROP INDEX idx_endless_score;

ALTER TABLE endless_leaderboard ADD INDEX idx_endless_score GLOBAL
  ON (game_id, platform, best_score, platform_user_id)
  COVER (player_name);
