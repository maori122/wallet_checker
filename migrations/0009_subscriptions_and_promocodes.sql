CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active')),
  expires_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  max_activations INTEGER,
  activations_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_code_activations (
  id TEXT PRIMARY KEY,
  promo_code_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  activated_at TEXT NOT NULL,
  UNIQUE (promo_code_id, user_id),
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_promo_code_activations_user
  ON promo_code_activations(user_id, activated_at DESC);
