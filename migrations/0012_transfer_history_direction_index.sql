DROP INDEX IF EXISTS idx_transfer_history_user_wallet_tx;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_history_user_wallet_tx
  ON transfer_history(user_id, wallet_id, txid, asset, network, direction);
