CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth')),
  address_ciphertext TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_unique_address_per_user ON wallets(user_id, network, address_hash);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth')),
  address_ciphertext TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  label_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unique_address_per_user ON contacts(user_id, network, address_hash);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en')),
  btc_threshold TEXT NOT NULL,
  eth_threshold TEXT NOT NULL,
  usdt_threshold TEXT NOT NULL,
  show_usd_estimate INTEGER NOT NULL DEFAULT 1,
  blockchain_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  service_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_dedup (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dedup_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, dedup_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
