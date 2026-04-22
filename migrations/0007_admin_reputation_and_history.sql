CREATE TABLE IF NOT EXISTS user_reputation (
  user_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stopped_wallets (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth', 'bsc', 'trc20')),
  address_plaintext TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  added_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (network, address_hash),
  FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stopped_wallets_network_hash
  ON stopped_wallets(network, address_hash);

CREATE TABLE IF NOT EXISTS link_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('wallet', 'contact')),
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth', 'bsc', 'trc20')),
  address_plaintext TEXT NOT NULL,
  label_plaintext TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_link_audit_created_at
  ON link_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_audit_actor
  ON link_audit_log(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transfer_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth', 'bsc', 'trc20')),
  asset TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
  txid TEXT NOT NULL,
  from_address TEXT,
  amount_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_history_user_wallet_tx
  ON transfer_history(user_id, wallet_id, txid, asset, network);
CREATE INDEX IF NOT EXISTS idx_transfer_history_user_created
  ON transfer_history(user_id, created_at DESC);
