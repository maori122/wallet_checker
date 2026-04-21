ALTER TABLE wallets ADD COLUMN IF NOT EXISTS monitor_eth_native INTEGER NOT NULL DEFAULT 1;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS monitor_usdt_erc20 INTEGER NOT NULL DEFAULT 1;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS monitor_usdt_bep20 INTEGER NOT NULL DEFAULT 1;

UPDATE wallets
SET
  monitor_eth_native = CASE WHEN network = 'eth' THEN 1 ELSE 0 END,
  monitor_usdt_erc20 = CASE WHEN network = 'eth' THEN 1 ELSE 0 END,
  monitor_usdt_bep20 = CASE WHEN network = 'bsc' THEN 1 ELSE 0 END
WHERE monitor_eth_native IS NULL
   OR monitor_usdt_erc20 IS NULL
   OR monitor_usdt_bep20 IS NULL;
