CREATE TABLE IF NOT EXISTS endless_leaderboard (
  game_id Utf8 NOT NULL,
  platform Utf8 NOT NULL,
  platform_user_id Utf8 NOT NULL,
  player_name Utf8,
  best_score Int64 NOT NULL,
  updated_at Timestamp NOT NULL,
  INDEX idx_endless_score GLOBAL ON (game_id, platform, best_score, platform_user_id)
    COVER (player_name, updated_at),
  PRIMARY KEY (game_id, platform, platform_user_id)
);
