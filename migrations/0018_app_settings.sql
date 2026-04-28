-- Prices for invoices (editable by admin via API / Mini App)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('pricing_subscription_usdt', '15'),
  ('pricing_slot_pack_usdt', '10');
