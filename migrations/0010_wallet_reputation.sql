CREATE TABLE IF NOT EXISTS wallet_reputation (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL CHECK (network IN ('btc', 'eth', 'bsc', 'trc20')),
  address_plaintext TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  dislikes_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (network, address_hash)
);

CREATE INDEX IF NOT EXISTS idx_wallet_reputation_score
  ON wallet_reputation(score DESC, likes_count DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS transfer_rating_votes (
  id TEXT PRIMARY KEY,
  transfer_history_id TEXT NOT NULL,
  voter_user_id TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (transfer_history_id, voter_user_id),
  FOREIGN KEY (transfer_history_id) REFERENCES transfer_history(id) ON DELETE CASCADE,
  FOREIGN KEY (voter_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transfer_rating_votes_transfer
  ON transfer_rating_votes(transfer_history_id);
