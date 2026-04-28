export type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ENCRYPTION_MASTER_KEY: string;
  ETHERSCAN_API_KEY?: string;
  BSCSCAN_API_KEY?: string;
  TRONGRID_API_KEY?: string;
  ADMIN_USER_IDS?: string;
  DEV_AUTH_BYPASS?: string;
  SUBSCRIPTION_EVM_PAY_ADDRESS?: string;
  SUBSCRIPTION_TRC20_PAY_ADDRESS?: string;
  /** CoinGecko demo API key — higher rate limits; header x-cg-demo-api-key */
  COINGECKO_API_KEY?: string;
};

export type Language = "ru" | "en";
