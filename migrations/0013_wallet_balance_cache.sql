CREATE TABLE IF NOT EXISTS wallet_balance_cache (
  wallet_id TEXT PRIMARY KEY,
  balances_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_balance_cache_fetched_at
  ON wallet_balance_cache(fetched_at);
