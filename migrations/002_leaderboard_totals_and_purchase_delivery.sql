CREATE TABLE IF NOT EXISTS leaderboard_totals (
  game_id Utf8 NOT NULL,
  platform Utf8 NOT NULL,
  platform_user_id Utf8 NOT NULL,
  player_name Utf8,
  avatar_url Utf8,
  total_stars Int64 NOT NULL,
  total_xp Int64 NOT NULL,
  updated_at Timestamp NOT NULL,
  INDEX idx_leaderboard_stars GLOBAL ON (game_id, platform, total_stars, platform_user_id)
    COVER (player_name, avatar_url, total_xp, updated_at),
  INDEX idx_leaderboard_xp GLOBAL ON (game_id, platform, total_xp, platform_user_id)
    COVER (player_name, avatar_url, total_stars, updated_at),
  PRIMARY KEY (game_id, platform, platform_user_id)
);

ALTER TABLE purchase_events ADD COLUMN game_id Utf8;

ALTER TABLE purchase_events ADD COLUMN platform_user_id Utf8;

ALTER TABLE purchase_events ADD COLUMN coins_delta Int64;

ALTER TABLE purchase_events ADD COLUMN delivered_at Timestamp;

ALTER TABLE purchase_events ADD INDEX idx_purchase_events_delivery GLOBAL
  ON (game_id, platform, platform_user_id, delivered_at, created_at, event_id)
  COVER (platform_order_id, event_type, coins_delta);
