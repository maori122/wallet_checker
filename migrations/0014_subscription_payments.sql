CREATE TABLE IF NOT EXISTS subscription_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('bsc', 'trc20')),
  asset TEXT NOT NULL,
  pay_address TEXT NOT NULL,
  amount_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired')),
  duration_days INTEGER NOT NULL,
  txid TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_status
  ON subscription_payments(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_status_expires
  ON subscription_payments(status, expires_at);
