CREATE TABLE IF NOT EXISTS jor_ok_endless_top (
  platform_user_id Utf8 NOT NULL,
  player_name Utf8 NOT NULL,
  best_score Int64 NOT NULL,
  updated_at Timestamp NOT NULL,
  INDEX idx_jor_ok_endless_score GLOBAL ON (best_score, platform_user_id)
    COVER (player_name, updated_at),
  PRIMARY KEY (platform_user_id)
);
