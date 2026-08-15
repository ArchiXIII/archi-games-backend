CREATE TABLE IF NOT EXISTS jor_purchases (
  platform Utf8 NOT NULL,
  platform_order_id Utf8 NOT NULL,
  platform_user_id Utf8 NOT NULL,
  product_id Utf8 NOT NULL,
  status Utf8 NOT NULL,
  duration_days Uint32 NOT NULL,
  purchased_at Timestamp NOT NULL,
  updated_at Timestamp NOT NULL,
  refunded_at Timestamp,
  PRIMARY KEY (platform, platform_order_id)
);

ALTER TABLE jor_purchases
ADD INDEX idx_jor_purchases_user GLOBAL
ON (platform, platform_user_id)
COVER (product_id, status, duration_days, purchased_at);
