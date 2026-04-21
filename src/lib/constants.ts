export const MAX_WALLETS = 10;
export const MAX_CONTACTS = 50;
export const MAX_TITLE_LENGTH = 120;
export const MAX_LABEL_LENGTH = 40;

export const DEFAULT_SETTINGS = {
  language: "ru" as const,
  btcThreshold: "0.001",
  ethThreshold: "0.01",
  usdtThreshold: "50",
  showUsdEstimate: true,
  blockchainNotificationsEnabled: true,
  serviceNotificationsEnabled: true
};
