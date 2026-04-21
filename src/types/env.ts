export type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ENCRYPTION_MASTER_KEY: string;
  ETHERSCAN_API_KEY?: string;
  BSCSCAN_API_KEY?: string;
  DEV_AUTH_BYPASS?: string;
};

export type Language = "ru" | "en";
