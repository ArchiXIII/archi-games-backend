CREATE TABLE IF NOT EXISTS players (
  game_id Utf8 NOT NULL,
  platform Utf8 NOT NULL,
  platform_user_id Utf8 NOT NULL,
  coins Int64 NOT NULL,
  created_at Timestamp NOT NULL,
  updated_at Timestamp NOT NULL,
  PRIMARY KEY (game_id, platform, platform_user_id)
);

CREATE TABLE IF NOT EXISTS orders (
  platform Utf8 NOT NULL,
  platform_order_id Utf8 NOT NULL,
  game_id Utf8 NOT NULL,
  platform_user_id Utf8 NOT NULL,
  product_id Utf8 NOT NULL,
  coins Int64 NOT NULL,
  status Utf8 NOT NULL,
  granted Bool NOT NULL,
  created_at Timestamp NOT NULL,
  updated_at Timestamp NOT NULL,
  refunded_at Timestamp,
  PRIMARY KEY (platform, platform_order_id)
);

CREATE TABLE IF NOT EXISTS purchase_events (
  event_id Utf8 NOT NULL,
  platform Utf8 NOT NULL,
  platform_order_id Utf8 NOT NULL,
  event_type Utf8 NOT NULL,
  payload_json Json NOT NULL,
  created_at Timestamp NOT NULL,
  PRIMARY KEY (event_id)
);
