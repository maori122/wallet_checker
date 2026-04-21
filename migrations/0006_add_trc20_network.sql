PRAGMA foreign_keys=OFF;

CREATE TABLE wallets_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth', 'bsc', 'trc20')),
  address_ciphertext TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  monitor_eth_native INTEGER NOT NULL DEFAULT 1,
  monitor_usdt_erc20 INTEGER NOT NULL DEFAULT 1,
  monitor_usdt_bep20 INTEGER NOT NULL DEFAULT 1,
  monitor_usdt_trc20 INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO wallets_new (
  id,
  user_id,
  network,
  address_ciphertext,
  address_hash,
  monitor_eth_native,
  monitor_usdt_erc20,
  monitor_usdt_bep20,
  monitor_usdt_trc20,
  created_at
)
SELECT
  id,
  user_id,
  network,
  address_ciphertext,
  address_hash,
  monitor_eth_native,
  monitor_usdt_erc20,
  monitor_usdt_bep20,
  CASE WHEN network = 'trc20' THEN 1 ELSE 0 END,
  created_at
FROM wallets;

DROP TABLE wallets;
ALTER TABLE wallets_new RENAME TO wallets;

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_unique_address_per_user ON wallets(user_id, network, address_hash);

CREATE TABLE contacts_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth', 'bsc', 'trc20')),
  address_ciphertext TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  label_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO contacts_new (
  id,
  user_id,
  network,
  address_ciphertext,
  address_hash,
  label_ciphertext,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  network,
  address_ciphertext,
  address_hash,
  label_ciphertext,
  created_at,
  updated_at
FROM contacts;

DROP TABLE contacts;
ALTER TABLE contacts_new RENAME TO contacts;

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unique_address_per_user ON contacts(user_id, network, address_hash);

PRAGMA foreign_keys=ON;
