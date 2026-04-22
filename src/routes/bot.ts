import { Hono } from "hono";
import type { Env } from "../types/env";
import {
  activatePromoCode,
  addStoppedWallet,
  clearBotSession,
  createContact,
  createWallet,
  deleteContact,
  deleteWallet,
  getBotSession,
  getActiveSubscriptionPaymentRequest,
  getSubscriptionInfo,
  getUserReputation,
  getWalletReputationByAddress,
  getSettings,
  listLinkAuditEntries,
  listStoppedWallets,
  listTopWalletReputations,
  listTransferHistory,
  listContacts,
  listWallets,
  rateTransferCounterparty,
  resetUserReputation,
  removeStoppedWallet,
  setBotSession,
  upsertUserProfile,
  updateSettings
} from "../lib/db";
import { getWalletBalances } from "../lib/wallet-insights";
import {
  createSubscriptionPaymentInvoice,
  processSubscriptionPayments
} from "../lib/subscription-payments";
import { detectAddressNetworks } from "../lib/validation";

type Variables = {
  userId: string;
};

type Language = "ru" | "en";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
};

type ReplyMarkup = {
  keyboard: string[][];
  resize_keyboard: boolean;
};

type BotSession = {
  flow: string;
  payload?: Record<string, unknown>;
};

type WalletNetwork = "btc" | "eth" | "bsc" | "trc20";

const I18N = {
  ru: {
    greet: "VOROBEY: Check готов. Управляйте кошельками, знакомыми адресами и настройками через кнопки ниже.",
    unknown: "Не понял сообщение. Выберите действие кнопкой меню.",
    mainMenu: "Главное меню",
    walletsTitle: "👁️ Отслеживаемые",
    contactsTitle: "Знакомые кошельки",
    settingsTitle: "Настройки",
    askWalletNetwork: "Выберите сеть для кошелька.",
    askWalletAddress: "Отправьте адрес кошелька. Сеть определю автоматически.",
    askDetectedNetwork: "Адрес подходит под несколько сетей. Выберите нужную.",
    walletAdded: "Кошелек добавлен.",
    walletDeleted: "Кошелек удален.",
    walletDeletePick: "Отправьте номер кошелька для удаления.",
    walletListEmpty: "Список кошельков пуст.",
    walletDeleteEmpty: "Удалять нечего: список пуст.",
    askContactNetwork: "Выберите сеть знакомого адреса.",
    askContactAddress: "Отправьте адрес знакомого кошелька. Сеть определю автоматически.",
    askContactLabel: "Отправьте подпись (например, Паша).",
    contactAdded: "Знакомый кошелек добавлен.",
    contactDeleted: "Запись удалена.",
    contactDeletePick: "Отправьте номер записи для удаления.",
    contactsListEmpty: "Список знакомых пуст.",
    contactsDeleteEmpty: "Удалять нечего: список пуст.",
    invalidNumber: "Нужен корректный номер из списка.",
    invalidAddress: "Некорректный адрес. Проверьте формат и попробуйте снова.",
    walletAlreadyExists: "Этот кошелек уже добавлен в этой сети.",
    contactAlreadyExists: "Этот знакомый кошелек уже добавлен в этой сети.",
    walletLimitReached: "Достигнут лимит кошельков (10).",
    contactLimitReached: "Достигнут лимит знакомых кошельков (50).",
    enterNumeric: "Введите число, например 0.01",
    settingsSaved: "Настройки сохранены.",
    testNotification: "Тестовое уведомление: бот подключен.",
    walletBalancesPick: "Выберите номер кошелька для просмотра баланса.",
    walletBalanceError: "Не удалось получить баланс. Попробуйте позже.",
    walletBalanceCachedAt: "⚠️ Временно показываю последний доступный баланс на {date}.",
    transferHistoryEmpty: "История переводов пока пуста.",
    transferHistoryTitle: "История переводов",
    transferRatePick: "Выберите номер перевода для оценки кошелька контрагента.",
    transferRateNoSender: "Для этого перевода нет кошелька контрагента, оценка недоступна.",
    transferRateAskVote: "Поставьте оценку кошельку контрагента.",
    transferRateDone: "Оценка сохранена.",
    cabinetTitle: "Личный кабинет",
    cabinetPlan: "Тариф",
    cabinetStatus: "Статус",
    cabinetExpiresAt: "Действует до",
    cabinetPromoActivations: "Активировано промокодов",
    cabinetStatusActive: "активна",
    cabinetStatusInactive: "не активна",
    askPromoCode: "Введите промокод.",
    promoActivated: "Промокод активирован.",
    promoInvalid: "Промокод не найден или не активен.",
    promoAlreadyUsed: "Вы уже активировали этот промокод.",
    promoExhausted: "Лимит активаций промокода исчерпан.",
    promoEmpty: "Введите непустой промокод.",
    paymentChooseNetwork: "Выберите сеть для оплаты подписки.",
    paymentInvoiceTitle: "Оплата подписки",
    paymentAmount: "Сумма",
    paymentAddress: "Адрес",
    paymentExpiresAt: "Действует до",
    paymentInstruction:
      "Оплатите ТОЧНУЮ сумму и нажмите «✅ Проверить оплату». Автопроверка также идет каждые 2 минуты.",
    paymentCheckNoRequest: "Активного счета нет. Нажмите «💳 Оплатить подписку».",
    paymentCheckPending: "Платеж пока не найден. Проверьте сумму/сеть и попробуйте еще раз через минуту.",
    paymentNetworkBsc: "🟡 USDT BEP20",
    paymentNetworkTrc20: "🔴 USDT TRC20",
    accessRequired: "Доступ к функциям бота открывается после оплаты подписки.",
    accessRequiredHint: "Откройте личный кабинет и нажмите «💳 Оплатить подписку».",
    reputationTitle: "Репутация",
    reputationValue: "Ваш текущий рейтинг: {score}",
    adminPanelTitle: "Админ панель",
    adminOnly: "Эта команда доступна только администратору.",
    adminReputationEmpty: "В таблице репутации пока нет пользователей.",
    adminReputationTitle: "Топ репутации",
    adminResetAsk: "Введите Telegram user id для обнуления репутации.",
    adminResetInvalidUserId: "Неверный user id. Отправьте только цифры.",
    adminResetDone: "Репутация пользователя обнулена.",
    adminStopHelp:
      "Управление стоп-кошельками:\nlist\n<ADDRESS> (добавить в стоп)\ndel <ADDRESS> (удалить из стоп)",
    adminStopAdded: "Кошелек добавлен в стоп-лист.",
    adminStopRemoved: "Кошелек удален из стоп-листа.",
    adminStopNotFound: "Кошелек не найден в стоп-листе.",
    adminStopEmpty: "Стоп-лист пуст.",
    adminStopListTitle: "Стоп-кошельки",
    adminStopInvalidCommand: "Неверная команда. Используйте list/add/del.",
    adminStopPickNetwork: "Адрес подходит под несколько сетей. Выберите сеть для стоп-листа.",
    adminLinksEmpty: "Лог ссылок пока пуст.",
    adminLinksTitle: "Кто какие ссылки добавлял",
    btnWallets: "👁️ Отслеживаемые",
    btnContacts: "👥 Знакомые кошельки",
    btnSettings: "⚙️ Настройки",
    btnCabinet: "🪪 Личный кабинет",
    btnReputation: "⭐ Моя репутация",
    btnList: "📋 Список",
    btnAdd: "➕ Добавить",
    btnDelete: "🗑️ Удалить",
    btnBalance: "💰 Баланс",
    btnHistory: "🧾 История",
    btnRateTransfer: "👍 Оценить перевод",
    btnLike: "👍 Лайк",
    btnDislike: "👎 Дизлайк",
    btnBack: "◀️ Назад",
    btnMainMenu: "🏠 Главное меню",
    btnLangRu: "🇷🇺 Язык: Русский",
    btnLangEn: "🇬🇧 Language: English",
    btnToggleUsd: "💵 USD оценка ON/OFF",
    btnToggleChain: "🔔 Уведомления по блокчейну ON/OFF",
    btnToggleService: "🛎️ Сервисные уведомления ON/OFF",
    btnSetBtc: "₿ Порог BTC",
    btnSetEth: "Ξ Порог ETH",
    btnSetUsdt: "💲 Порог USDT",
    btnTest: "🧪 Тестовое уведомление",
    btnAdminPanel: "🛡️ Админ панель",
    btnAdminReputation: "🏆 Топ репутации",
    btnAdminResetReputation: "♻️ Обнулить репутацию",
    btnAdminStopWallets: "⛔ Стоп-кошельки",
    btnAdminLinks: "🔎 Логи ссылок",
    btnActivatePromo: "🎟️ Активировать промокод",
    btnPaySubscription: "💳 Оплатить подписку",
    btnCheckPayment: "✅ Проверить оплату",
    askBtc: "Введите порог BTC (например, 0.001).",
    askEth: "Введите порог ETH (например, 0.01).",
    askUsdt: "Введите порог USDT (например, 50).",
    stateOn: "включено",
    stateOff: "выключено",
    usdState: "Показывать оценку USD: {state}",
    chainState: "Блокчейн-уведомления: {state}",
    serviceState: "Сервисные уведомления: {state}"
  },
  en: {
    greet: "VOROBEY: Check is ready. Use the buttons below to manage wallets, contacts, and settings.",
    unknown: "I did not understand. Please choose an action from the menu.",
    mainMenu: "Main menu",
    walletsTitle: "My wallets",
    contactsTitle: "Known wallets",
    settingsTitle: "Settings",
    askWalletNetwork: "Choose wallet network.",
    askWalletAddress: "Send wallet address. I will detect the network automatically.",
    askDetectedNetwork: "This address matches multiple networks. Choose one.",
    walletAdded: "Wallet added.",
    walletDeleted: "Wallet deleted.",
    walletDeletePick: "Send wallet number to delete.",
    walletListEmpty: "Wallet list is empty.",
    walletDeleteEmpty: "Nothing to delete: list is empty.",
    askContactNetwork: "Choose contact network.",
    askContactAddress: "Send contact wallet address. I will detect the network automatically.",
    askContactLabel: "Send label (example: Pasha).",
    contactAdded: "Known wallet added.",
    contactDeleted: "Entry deleted.",
    contactDeletePick: "Send entry number to delete.",
    contactsListEmpty: "Known wallets list is empty.",
    contactsDeleteEmpty: "Nothing to delete: list is empty.",
    invalidNumber: "Please send a valid number from the list.",
    invalidAddress: "Invalid address. Please verify and try again.",
    walletAlreadyExists: "This wallet is already added in this network.",
    contactAlreadyExists: "This known wallet is already added in this network.",
    walletLimitReached: "Wallet limit reached (10).",
    contactLimitReached: "Known wallet limit reached (50).",
    enterNumeric: "Enter a number, for example 0.01",
    settingsSaved: "Settings saved.",
    testNotification: "Test notification: bot is connected.",
    walletBalancesPick: "Send wallet number to view balance.",
    walletBalanceError: "Unable to fetch balance. Please try again later.",
    walletBalanceCachedAt: "⚠️ Showing the last available balance from {date}.",
    transferHistoryEmpty: "Transfer history is empty.",
    transferHistoryTitle: "Transfer history",
    transferRatePick: "Choose transfer number to rate counterparty wallet.",
    transferRateNoSender: "This transfer has no counterparty wallet, rating is unavailable.",
    transferRateAskVote: "Rate the counterparty wallet.",
    transferRateDone: "Rating saved.",
    cabinetTitle: "Account",
    cabinetPlan: "Plan",
    cabinetStatus: "Status",
    cabinetExpiresAt: "Valid until",
    cabinetPromoActivations: "Promo codes activated",
    cabinetStatusActive: "active",
    cabinetStatusInactive: "inactive",
    askPromoCode: "Send promo code.",
    promoActivated: "Promo code activated.",
    promoInvalid: "Promo code was not found or is inactive.",
    promoAlreadyUsed: "You have already used this promo code.",
    promoExhausted: "Promo code activation limit has been reached.",
    promoEmpty: "Please send a non-empty promo code.",
    paymentChooseNetwork: "Choose network for subscription payment.",
    paymentInvoiceTitle: "Subscription payment",
    paymentAmount: "Amount",
    paymentAddress: "Address",
    paymentExpiresAt: "Valid until",
    paymentInstruction:
      "Pay the EXACT amount and tap \"✅ Check payment\". Automatic check runs every 2 minutes.",
    paymentCheckNoRequest: "No active invoice. Tap \"💳 Pay subscription\" first.",
    paymentCheckPending: "Payment not found yet. Verify amount/network and try again in a minute.",
    paymentNetworkBsc: "🟡 USDT BEP20",
    paymentNetworkTrc20: "🔴 USDT TRC20",
    accessRequired: "Bot features unlock after subscription payment.",
    accessRequiredHint: "Open Account and tap \"💳 Pay subscription\".",
    reputationTitle: "Reputation",
    reputationValue: "Your current score: {score}",
    adminPanelTitle: "Admin panel",
    adminOnly: "This command is available only for admins.",
    adminReputationEmpty: "Reputation table is empty.",
    adminReputationTitle: "Top reputation",
    adminResetAsk: "Send Telegram user id to reset reputation.",
    adminResetInvalidUserId: "Invalid user id. Please send digits only.",
    adminResetDone: "User reputation reset.",
    adminStopHelp:
      "Stop-wallet management:\nlist\n<ADDRESS> (add to stop list)\ndel <ADDRESS> (remove from stop list)",
    adminStopAdded: "Wallet added to stop list.",
    adminStopRemoved: "Wallet removed from stop list.",
    adminStopNotFound: "Wallet was not found in stop list.",
    adminStopEmpty: "Stop list is empty.",
    adminStopListTitle: "Stop wallets",
    adminStopInvalidCommand: "Invalid command. Use list/add/del.",
    adminStopPickNetwork: "This address matches multiple networks. Choose network for stop list.",
    adminLinksEmpty: "Link log is empty.",
    adminLinksTitle: "Who added which links",
    btnWallets: "👛 My wallets",
    btnContacts: "👥 Known wallets",
    btnSettings: "⚙️ Settings",
    btnCabinet: "🪪 Account",
    btnReputation: "⭐ My reputation",
    btnList: "📋 List",
    btnAdd: "➕ Add",
    btnDelete: "🗑️ Delete",
    btnBalance: "💰 Balance",
    btnHistory: "🧾 History",
    btnRateTransfer: "👍 Rate transfer",
    btnLike: "👍 Like",
    btnDislike: "👎 Dislike",
    btnBack: "◀️ Back",
    btnMainMenu: "🏠 Main menu",
    btnLangRu: "🇷🇺 Язык: Русский",
    btnLangEn: "🇬🇧 Language: English",
    btnToggleUsd: "💵 USD estimate ON/OFF",
    btnToggleChain: "🔔 Blockchain notifications ON/OFF",
    btnToggleService: "🛎️ Service notifications ON/OFF",
    btnSetBtc: "₿ BTC threshold",
    btnSetEth: "Ξ ETH threshold",
    btnSetUsdt: "💲 USDT threshold",
    btnTest: "🧪 Test notification",
    btnAdminPanel: "🛡️ Admin panel",
    btnAdminReputation: "🏆 Top reputation",
    btnAdminResetReputation: "♻️ Reset reputation",
    btnAdminStopWallets: "⛔ Stop wallets",
    btnAdminLinks: "🔎 Links log",
    btnActivatePromo: "🎟️ Activate promo code",
    btnPaySubscription: "💳 Pay subscription",
    btnCheckPayment: "✅ Check payment",
    askBtc: "Enter BTC threshold (example: 0.001).",
    askEth: "Enter ETH threshold (example: 0.01).",
    askUsdt: "Enter USDT threshold (example: 50).",
    stateOn: "ON",
    stateOff: "OFF",
    usdState: "Show USD estimate: {state}",
    chainState: "Blockchain notifications: {state}",
    serviceState: "Service notifications: {state}"
  }
} as const;

const bot = new Hono<{ Bindings: Env; Variables: Variables }>();

function t(language: Language, key: keyof (typeof I18N)["ru"]): string {
  return I18N[language][key];
}

function isBtn(input: string, key: keyof (typeof I18N)["ru"]): boolean {
  return input === I18N.ru[key] || input === I18N.en[key];
}

function isAdminActionButton(input: string): boolean {
  return (
    isBtn(input, "btnAdminPanel") ||
    isBtn(input, "btnAdminReputation") ||
    isBtn(input, "btnAdminResetReputation") ||
    isBtn(input, "btnAdminStopWallets") ||
    isBtn(input, "btnAdminLinks")
  );
}

function isSectionActionButton(input: string): boolean {
  return (
    isBtn(input, "btnList") ||
    isBtn(input, "btnAdd") ||
    isBtn(input, "btnDelete") ||
    isBtn(input, "btnBalance") ||
    isBtn(input, "btnHistory") ||
    isBtn(input, "btnRateTransfer")
  );
}

function isCabinetActionButton(input: string): boolean {
  return (
    isBtn(input, "btnPaySubscription") ||
    isBtn(input, "btnCheckPayment") ||
    isBtn(input, "btnActivatePromo") ||
    isBtn(input, "paymentNetworkBsc") ||
    isBtn(input, "paymentNetworkTrc20")
  );
}

function inferSectionFromFlow(flow: string | undefined): "wallets" | "contacts" | null {
  if (!flow) {
    return null;
  }
  if (flow.startsWith("wallet:") || flow.startsWith("transfer:rate:")) {
    return "wallets";
  }
  if (flow.startsWith("contact:")) {
    return "contacts";
  }
  return null;
}

function canAutoAddWalletFromMessage(session: BotSession | null): boolean {
  if (!session) {
    return true;
  }
  return session.flow === "section:wallets";
}

function withState(
  language: Language,
  key: "usdState" | "chainState" | "serviceState",
  isEnabled: boolean
): string {
  const state = isEnabled ? t(language, "stateOn") : t(language, "stateOff");
  return t(language, key).replace("{state}", state);
}

function maskAddress(value: string): string {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function maskTxid(value: string): string {
  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function toUserLabel(params: {
  userId: string;
  username?: string | null;
  displayName?: string | null;
}): string {
  if (params.username) {
    return `@${params.username} (${params.userId})`;
  }
  if (params.displayName) {
    return `${params.displayName} (${params.userId})`;
  }
  return params.userId;
}

function paginateLines(lines: string[], pageSize = 8): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    pages.push(lines.slice(i, i + pageSize));
  }
  return pages;
}

async function sendPagedList(params: {
  token: string;
  chatId: number;
  language: Language;
  title: string;
  lines: string[];
  replyMarkup?: ReplyMarkup;
  pageSize?: number;
}): Promise<void> {
  const pages = paginateLines(params.lines, params.pageSize ?? 8);
  for (let i = 0; i < pages.length; i += 1) {
    const pageLabel =
      pages.length > 1
        ? params.language === "ru"
          ? `\n\nСтраница ${i + 1}/${pages.length}`
          : `\n\nPage ${i + 1}/${pages.length}`
        : "";
    await sendTelegramMessage(
      params.token,
      params.chatId,
      `${params.title}\n${pages[i].join("\n")}${pageLabel}`,
      params.replyMarkup
    );
  }
}

async function showWalletsList(
  env: Env,
  chatId: number,
  userId: string,
  language: Language,
  replyMarkup: ReplyMarkup
): Promise<void> {
  const wallets = await listWallets(env, userId);
  if (wallets.length === 0) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, t(language, "walletListEmpty"), replyMarkup);
    return;
  }
  const lines = wallets.map((item, index) => `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)}`);
  await sendPagedList({
    token: env.TELEGRAM_BOT_TOKEN,
    chatId,
    language,
    title: `${t(language, "walletsTitle")}:`,
    lines,
    replyMarkup
  });
}

function formatDateForLanguage(value: string | null, language: Language): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(language === "ru" ? "ru-RU" : "en-US");
}

function mapCreateError(
  language: Language,
  error: unknown,
  entity: "wallet" | "contact"
): string {
  const message = (error as Error).message ?? "";
  if (message.includes("Invalid")) {
    return t(language, "invalidAddress");
  }
  if (entity === "wallet" && message === "WALLET_ALREADY_EXISTS") {
    return t(language, "walletAlreadyExists");
  }
  if (entity === "contact" && message === "CONTACT_ALREADY_EXISTS") {
    return t(language, "contactAlreadyExists");
  }
  if (entity === "wallet" && message.startsWith("Wallet limit reached")) {
    return t(language, "walletLimitReached");
  }
  if (entity === "contact" && message.startsWith("Contact limit reached")) {
    return t(language, "contactLimitReached");
  }
  return message;
}

function currentSection(session: BotSession | null): "wallets" | "contacts" | null {
  if (!session?.flow.startsWith("section:")) {
    return null;
  }
  if (session.flow === "section:wallets") {
    return "wallets";
  }
  if (session.flow === "section:contacts") {
    return "contacts";
  }
  return null;
}

function isAdminUser(env: Env, userId: string): boolean {
  const ids = (env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

function hasActiveSubscription(subscription: { status: "inactive" | "active"; expiresAt: string | null }): boolean {
  if (subscription.status !== "active") {
    return false;
  }
  if (!subscription.expiresAt) {
    return false;
  }
  const expiresMs = Date.parse(subscription.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs > Date.now();
}

function mainKeyboard(language: Language, isAdmin = false, hasFullAccess = true): ReplyMarkup {
  if (!hasFullAccess && !isAdmin) {
    return {
      keyboard: [[t(language, "btnCabinet")]],
      resize_keyboard: true
    };
  }
  const keyboard: string[][] = [
    [t(language, "btnWallets"), t(language, "btnContacts")],
    [t(language, "btnSettings"), t(language, "btnCabinet")]
  ];
  if (isAdmin) {
    keyboard.push([t(language, "btnAdminPanel")]);
  }
  return {
    keyboard,
    resize_keyboard: true
  };
}

function cabinetKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [
      [t(language, "btnPaySubscription"), t(language, "btnCheckPayment")],
      [t(language, "btnActivatePromo")],
      [t(language, "btnMainMenu")]
    ],
    resize_keyboard: true
  };
}

function paymentNetworkKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [
      [t(language, "paymentNetworkBsc"), t(language, "paymentNetworkTrc20")],
      [t(language, "btnBack"), t(language, "btnMainMenu")]
    ],
    resize_keyboard: true
  };
}

function voteKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [[t(language, "btnLike"), t(language, "btnDislike")], [t(language, "btnBack"), t(language, "btnMainMenu")]],
    resize_keyboard: true
  };
}

function sectionKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [
      [t(language, "btnList"), t(language, "btnAdd"), t(language, "btnDelete")],
      [t(language, "btnBalance"), t(language, "btnHistory")],
      [t(language, "btnMainMenu")]
    ],
    resize_keyboard: true
  };
}

function networkKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [["₿ BTC", "Ξ ETH", "🟡 BEP20", "🔴 TRC20"], [t(language, "btnBack"), t(language, "btnMainMenu")]],
    resize_keyboard: true
  };
}

function formatNetwork(network: WalletNetwork): "BTC" | "ETH" | "BEP20" | "TRC20" {
  if (network === "trc20") {
    return "TRC20";
  }
  if (network === "bsc") {
    return "BEP20";
  }
  return network.toUpperCase() as "BTC" | "ETH";
}

function networkLabel(network: WalletNetwork): "₿ BTC" | "Ξ ETH" | "🟡 BEP20" | "🔴 TRC20" {
  if (network === "btc") {
    return "₿ BTC";
  }
  if (network === "eth") {
    return "Ξ ETH";
  }
  if (network === "bsc") {
    return "🟡 BEP20";
  }
  return "🔴 TRC20";
}

function parseNetworkLabel(value: string): WalletNetwork | null {
  const normalized = value.toUpperCase();
  if (normalized.includes("BTC")) {
    return "btc";
  }
  if (normalized.includes("ETH")) {
    return "eth";
  }
  if (normalized.includes("BSC") || normalized.includes("BEP20")) {
    return "bsc";
  }
  if (normalized.includes("TRC20")) {
    return "trc20";
  }
  return null;
}

function detectedNetworkKeyboard(language: Language, candidates: WalletNetwork[]): ReplyMarkup {
  const buttons = candidates.map((item) => networkLabel(item));
  return {
    keyboard: [buttons, [t(language, "btnBack"), t(language, "btnMainMenu")]],
    resize_keyboard: true
  };
}

function settingsKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [
      [t(language, "btnLangRu"), t(language, "btnLangEn")],
      [t(language, "btnSetBtc"), t(language, "btnSetEth"), t(language, "btnSetUsdt")],
      [t(language, "btnToggleUsd"), t(language, "btnToggleChain")],
      [t(language, "btnToggleService"), t(language, "btnTest")],
      [t(language, "btnMainMenu")]
    ],
    resize_keyboard: true
  };
}

function adminKeyboard(language: Language): ReplyMarkup {
  return {
    keyboard: [
      [t(language, "btnAdminStopWallets"), t(language, "btnAdminLinks")],
      [t(language, "btnMainMenu")]
    ],
    resize_keyboard: true
  };
}

async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: ReplyMarkup
): Promise<Response> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

bot.post("/telegram", async (c) => {
  const secret = c.req.header("x-telegram-bot-api-secret-token");
  if (!secret || secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const update = (await c.req.json()) as TelegramUpdate;
  const message = update.message;
  if (!message?.from?.id || message.chat.type !== "private") {
    return c.json({ ok: true });
  }

  const userId = String(message.from.id);
  const text = message.text?.trim();
  const displayName = [message.from.first_name, message.from.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  await upsertUserProfile(c.env, {
    userId,
    username: message.from.username ?? null,
    displayName: displayName || null
  });
  const isAdmin = isAdminUser(c.env, userId);
  let settings = await getSettings(c.env, userId);
  const language = settings.language;
  let session = await getBotSession(c.env, userId);
  const subscription = await getSubscriptionInfo(c.env, userId);
  const hasBotAccess = isAdmin || hasActiveSubscription(subscription);

  if (!text || text === "/start" || text === "/menu") {
    await clearBotSession(c.env, userId);
    const welcomeText = hasBotAccess
      ? `${t(language, "greet")}\n\n${t(language, "mainMenu")}`
      : `${t(language, "accessRequired")}\n\n${t(language, "accessRequiredHint")}`;
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      welcomeText,
      mainKeyboard(language, isAdmin, hasBotAccess)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnMainMenu") || isBtn(text, "btnBack")) {
    if (!session) {
      return c.json({ ok: true });
    }
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      hasBotAccess
        ? `${t(language, "greet")}\n\n${t(language, "mainMenu")}`
        : `${t(language, "accessRequired")}\n\n${t(language, "accessRequiredHint")}`,
      mainKeyboard(language, isAdmin, hasBotAccess)
    );
    return c.json({ ok: true });
  }

  // Buttons should always switch to the requested section, even if the user
  // is currently inside a text-input flow.
  if (isSectionActionButton(text)) {
    const inferred = inferSectionFromFlow(session?.flow);
    if (inferred) {
      session = { flow: `section:${inferred}` };
      await setBotSession(c.env, userId, session);
    }
  }

  if (isCabinetActionButton(text) && session?.flow.startsWith("cabinet:")) {
    session = { flow: "section:cabinet" };
    await setBotSession(c.env, userId, session);
  }

  const allowsPaymentFlow =
    isBtn(text, "btnCabinet") ||
    isBtn(text, "btnPaySubscription") ||
    isBtn(text, "btnCheckPayment") ||
    isBtn(text, "btnActivatePromo") ||
    isBtn(text, "paymentNetworkBsc") ||
    isBtn(text, "paymentNetworkTrc20") ||
    session?.flow === "cabinet:promo:code" ||
    session?.flow === "cabinet:pay:network";

  if (!hasBotAccess && !allowsPaymentFlow) {
    await setBotSession(c.env, userId, { flow: "section:cabinet" });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "accessRequired")}\n\n${t(language, "accessRequiredHint")}`,
      mainKeyboard(language, isAdmin, false)
    );
    return c.json({ ok: true });
  }

  if (canAutoAddWalletFromMessage(session)) {
    const candidates = detectAddressNetworks(text) as WalletNetwork[];
    if (candidates.length === 1) {
      try {
        await createWallet(c.env, userId, { network: candidates[0], address: text });
        await setBotSession(c.env, userId, { flow: "section:wallets" });
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletAdded"), sectionKeyboard(language));
      } catch (error) {
        const messageText = mapCreateError(language, error, "wallet");
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, messageText, sectionKeyboard(language));
      }
      return c.json({ ok: true });
    }
    if (candidates.length > 1) {
      await setBotSession(c.env, userId, {
        flow: "wallet:add:pick-network",
        payload: { address: text, candidates }
      });
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "askDetectedNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }
  }

  if (session?.flow === "wallet:add:auto-address") {
    const candidates = detectAddressNetworks(text);
    if (candidates.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidAddress"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    if (candidates.length > 1) {
      await setBotSession(c.env, userId, {
        flow: "wallet:add:pick-network",
        payload: { address: text, candidates }
      });
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "askDetectedNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }

    const network = candidates[0];
    try {
      await createWallet(c.env, userId, { network, address: text });
      await setBotSession(c.env, userId, { flow: "section:wallets" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletAdded"), sectionKeyboard(language));
    } catch (error) {
      const messageText = mapCreateError(language, error, "wallet");
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, messageText, sectionKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "wallet:add:pick-network") {
    const candidates = (session.payload?.candidates as WalletNetwork[] | undefined) ?? [];
    const address = session.payload?.address as string | undefined;
    const network = parseNetworkLabel(text);
    if (!network || !address || !candidates.includes(network)) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "askDetectedNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }
    try {
      await createWallet(c.env, userId, { network, address });
      await setBotSession(c.env, userId, { flow: "section:wallets" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletAdded"), sectionKeyboard(language));
    } catch (error) {
      const messageText = mapCreateError(language, error, "wallet");
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, messageText, sectionKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "wallet:add:address") {
    const network = session.payload?.network as WalletNetwork | undefined;
    if (!network) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "unknown"),
        mainKeyboard(language, isAdmin)
      );
      return c.json({ ok: true });
    }
    try {
      await createWallet(c.env, userId, { network, address: text });
      await setBotSession(c.env, userId, { flow: "section:wallets" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletAdded"), sectionKeyboard(language));
    } catch (error) {
      const messageText = mapCreateError(language, error, "wallet");
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, messageText, sectionKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "wallet:delete:pick") {
    const ids = (session.payload?.ids as string[] | undefined) ?? [];
    const pick = Number.parseInt(text, 10);
    if (!Number.isInteger(pick) || pick < 1 || pick > ids.length) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidNumber"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    await deleteWallet(c.env, userId, ids[pick - 1]);
    await setBotSession(c.env, userId, { flow: "section:wallets" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletDeleted"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "wallet:balance:pick") {
    const ids = (session.payload?.ids as string[] | undefined) ?? [];
    const pick = Number.parseInt(text, 10);
    if (!Number.isInteger(pick) || pick < 1 || pick > ids.length) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "invalidNumber"),
        sectionKeyboard(language)
      );
      return c.json({ ok: true });
    }

    const wallets = await listWallets(c.env, userId);
    const wallet = wallets.find((item) => item.id === ids[pick - 1]);
    if (!wallet) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "invalidNumber"),
        sectionKeyboard(language)
      );
      return c.json({ ok: true });
    }

    try {
      const balanceResult = await getWalletBalances(c.env, wallet);
      const body = balanceResult.entries.length
        ? balanceResult.entries.map((item) => `• ${item.asset}: ${item.amount}`).join("\n")
        : language === "ru"
          ? "Нет доступных активов для отображения."
          : "No assets are enabled for this wallet.";
      const cacheNotice =
        balanceResult.source === "cache"
          ? `\n\n${t(language, "walletBalanceCachedAt").replace(
              "{date}",
              formatDateForLanguage(balanceResult.fetchedAt, language)
            )}`
          : "";
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `[${formatNetwork(wallet.network)}] ${maskAddress(wallet.address)}\n${body}${cacheNotice}`,
        sectionKeyboard(language)
      );
    } catch {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "walletBalanceError"),
        sectionKeyboard(language)
      );
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "transfer:rate:pick") {
    const ids = (session.payload?.ids as string[] | undefined) ?? [];
    const pick = Number.parseInt(text, 10);
    if (!Number.isInteger(pick) || pick < 1 || pick > ids.length) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "invalidNumber"),
        sectionKeyboard(language)
      );
      return c.json({ ok: true });
    }

    const history = await listTransferHistory(c.env, userId, 50);
    const item = history.find((entry) => entry.id === ids[pick - 1]);
    if (!item || !item.counterpartyAddress) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "transferRateNoSender"),
        sectionKeyboard(language)
      );
      return c.json({ ok: true });
    }

    await setBotSession(c.env, userId, {
      flow: "transfer:rate:vote",
      payload: { transferId: item.id }
    });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "transferRateAskVote")}\n[${formatNetwork(item.network)}] ${maskAddress(item.counterpartyAddress)}`,
      voteKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (session?.flow === "transfer:rate:vote") {
    const transferId = session.payload?.transferId as string | undefined;
    if (!transferId) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "unknown"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const vote = isBtn(text, "btnLike") ? 1 : isBtn(text, "btnDislike") ? -1 : null;
    if (!vote) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "transferRateAskVote"), voteKeyboard(language));
      return c.json({ ok: true });
    }
    try {
      const updated = await rateTransferCounterparty(c.env, userId, transferId, vote);
      await setBotSession(c.env, userId, { flow: "section:wallets" });
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `${t(language, "transferRateDone")}\n[${formatNetwork(updated.network)}] ${maskAddress(updated.address)}\n` +
          `Score: ${updated.score} (👍 ${updated.likesCount} / 👎 ${updated.dislikesCount})`,
        sectionKeyboard(language)
      );
    } catch {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "transferRateNoSender"), sectionKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:address") {
    const network = session.payload?.network as WalletNetwork | undefined;
    if (!network) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "unknown"),
        mainKeyboard(language, isAdmin)
      );
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "contact:add:label", payload: { network, address: text } });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactLabel"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:auto-address") {
    const candidates = detectAddressNetworks(text);
    if (candidates.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidAddress"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    if (candidates.length > 1) {
      await setBotSession(c.env, userId, {
        flow: "contact:add:pick-network",
        payload: { address: text, candidates }
      });
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "askDetectedNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, {
      flow: "contact:add:label",
      payload: { network: candidates[0], address: text }
    });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactLabel"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:pick-network") {
    const candidates = (session.payload?.candidates as WalletNetwork[] | undefined) ?? [];
    const address = session.payload?.address as string | undefined;
    const network = parseNetworkLabel(text);
    if (!network || !address || !candidates.includes(network)) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "askDetectedNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, {
      flow: "contact:add:label",
      payload: { network, address }
    });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactLabel"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:label") {
    const network = session.payload?.network as WalletNetwork | undefined;
    const address = session.payload?.address as string | undefined;
    if (!network || !address) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "unknown"),
        mainKeyboard(language, isAdmin)
      );
      return c.json({ ok: true });
    }
    try {
      await createContact(c.env, userId, { network, address, label: text });
      await setBotSession(c.env, userId, { flow: "section:contacts" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactAdded"), sectionKeyboard(language));
    } catch (error) {
      const messageText = mapCreateError(language, error, "contact");
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, messageText, sectionKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:delete:pick") {
    const ids = (session.payload?.ids as string[] | undefined) ?? [];
    const pick = Number.parseInt(text, 10);
    if (!Number.isInteger(pick) || pick < 1 || pick > ids.length) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidNumber"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    await deleteContact(c.env, userId, ids[pick - 1]);
    await setBotSession(c.env, userId, { flow: "section:contacts" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactDeleted"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "settings:threshold:btc" || session?.flow === "settings:threshold:eth" || session?.flow === "settings:threshold:usdt") {
    if (!/^\d+(\.\d+)?$/.test(text)) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "enterNumeric"), settingsKeyboard(language));
      return c.json({ ok: true });
    }
    if (session.flow.endsWith("btc")) {
      settings = await updateSettings(c.env, userId, { btcThreshold: text });
    } else if (session.flow.endsWith("eth")) {
      settings = await updateSettings(c.env, userId, { ethThreshold: text });
    } else {
      settings = await updateSettings(c.env, userId, { usdtThreshold: text });
    }
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(settings.language, "settingsSaved"), settingsKeyboard(settings.language));
    return c.json({ ok: true });
  }

  if (session?.flow === "cabinet:pay:network") {
    const network = isBtn(text, "paymentNetworkBsc")
      ? "bsc"
      : isBtn(text, "paymentNetworkTrc20")
        ? "trc20"
        : null;
    if (!network) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "paymentChooseNetwork"),
        paymentNetworkKeyboard(language)
      );
      return c.json({ ok: true });
    }
    const invoice = await createSubscriptionPaymentInvoice(c.env, userId, network);
    await setBotSession(c.env, userId, { flow: "section:cabinet" });
    const networkLabel = network === "bsc" ? t(language, "paymentNetworkBsc") : t(language, "paymentNetworkTrc20");
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "paymentInvoiceTitle")} (${networkLabel})\n` +
        `${t(language, "paymentAmount")}: ${invoice.amountText} ${invoice.asset}\n` +
        `${t(language, "paymentAddress")}: ${invoice.payAddress}\n` +
        `${t(language, "paymentExpiresAt")}: ${formatDateForLanguage(invoice.expiresAt, language)}\n\n` +
        `${t(language, "paymentInstruction")}`,
      cabinetKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (session?.flow === "cabinet:promo:code") {
    try {
      if (!text.trim()) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "promoEmpty"), cabinetKeyboard(language));
        return c.json({ ok: true });
      }
      const subscription = await activatePromoCode(c.env, userId, text);
      await clearBotSession(c.env, userId);
      const statusLabel =
        subscription.status === "active"
          ? t(language, "cabinetStatusActive")
          : t(language, "cabinetStatusInactive");
      const expiresAt = formatDateForLanguage(subscription.expiresAt, language);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `${t(language, "promoActivated")}\n\n${t(language, "cabinetTitle")}\n` +
          `${t(language, "cabinetPlan")}: ${subscription.planCode}\n` +
          `${t(language, "cabinetStatus")}: ${statusLabel}\n` +
          `${t(language, "cabinetExpiresAt")}: ${expiresAt}\n` +
          `${t(language, "cabinetPromoActivations")}: ${subscription.promoActivations}`,
        cabinetKeyboard(language)
      );
    } catch (error) {
      const code = (error as Error).message;
      const errorText =
        code === "PROMO_CODE_ALREADY_USED"
          ? t(language, "promoAlreadyUsed")
          : code === "PROMO_CODE_EXHAUSTED"
            ? t(language, "promoExhausted")
            : code === "PROMO_CODE_EMPTY"
              ? t(language, "promoEmpty")
              : t(language, "promoInvalid");
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, errorText, cabinetKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "admin:reputation:reset:user" && !isAdminActionButton(text)) {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    if (!/^\d+$/.test(text)) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "adminResetInvalidUserId"),
        adminKeyboard(language)
      );
      return c.json({ ok: true });
    }
    await resetUserReputation(c.env, text);
    await setBotSession(c.env, userId, { flow: "section:admin" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminResetDone"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "admin:stop:manage" && !isAdminActionButton(text)) {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const trimmed = text.trim();
    const commandLower = trimmed.toLowerCase();

    if (commandLower === "list") {
      const stopped = await listStoppedWallets(c.env);
      if (stopped.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminStopEmpty"), adminKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = stopped.map(
        (item, index) =>
          `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)} by ${toUserLabel({
            userId: item.addedByUserId,
            username: item.addedByUsername,
            displayName: item.addedByDisplayName
          })}`
      );
      await sendPagedList({
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        language,
        title: `${t(language, "adminStopListTitle")}:`,
        lines,
        replyMarkup: adminKeyboard(language)
      });
      return c.json({ ok: true });
    }

    let action: "add" | "del" = "add";
    let address = trimmed;

    if (commandLower.startsWith("del ")) {
      action = "del";
      address = trimmed.slice(4).trim();
    } else if (commandLower.startsWith("add ")) {
      action = "add";
      address = trimmed.slice(4).trim();
    }

    const candidates = detectAddressNetworks(address) as WalletNetwork[];
    if (candidates.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidAddress"), adminKeyboard(language));
      return c.json({ ok: true });
    }

    if (candidates.length > 1) {
      await setBotSession(c.env, userId, {
        flow: "admin:stop:pick-network",
        payload: { action, address, candidates }
      });
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "adminStopPickNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }

    try {
      if (action === "add") {
        await addStoppedWallet(c.env, userId, candidates[0], address);
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminStopAdded"), adminKeyboard(language));
      } else {
        const removed = await removeStoppedWallet(c.env, candidates[0], address);
        await sendTelegramMessage(
          c.env.TELEGRAM_BOT_TOKEN,
          message.chat.id,
          removed ? t(language, "adminStopRemoved") : t(language, "adminStopNotFound"),
          adminKeyboard(language)
        );
      }
    } catch {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidAddress"), adminKeyboard(language));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "admin:stop:pick-network" && !isAdminActionButton(text)) {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const action = (session.payload?.action as "add" | "del" | undefined) ?? "add";
    const address = session.payload?.address as string | undefined;
    const candidates = (session.payload?.candidates as WalletNetwork[] | undefined) ?? [];
    const network = parseNetworkLabel(text);
    if (!network || !address || !candidates.includes(network)) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "adminStopPickNetwork"),
        detectedNetworkKeyboard(language, candidates)
      );
      return c.json({ ok: true });
    }

    try {
      if (action === "add") {
        await addStoppedWallet(c.env, userId, network, address);
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminStopAdded"), adminKeyboard(language));
      } else {
        const removed = await removeStoppedWallet(c.env, network, address);
        await sendTelegramMessage(
          c.env.TELEGRAM_BOT_TOKEN,
          message.chat.id,
          removed ? t(language, "adminStopRemoved") : t(language, "adminStopNotFound"),
          adminKeyboard(language)
        );
      }
    } catch {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidAddress"), adminKeyboard(language));
    }
    await setBotSession(c.env, userId, { flow: "admin:stop:manage" });
    return c.json({ ok: true });
  }

  if ((session?.flow === "admin:stop:manage" || session?.flow === "admin:stop:pick-network") && !isAdminActionButton(text)) {
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "adminStopInvalidCommand")}\n\n${t(language, "adminStopHelp")}`,
      adminKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnWallets")) {
    await setBotSession(c.env, userId, { flow: "section:wallets" });
    await showWalletsList(c.env, message.chat.id, userId, language, sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnContacts")) {
    await setBotSession(c.env, userId, { flow: "section:contacts" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsTitle"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnSettings")) {
    await setBotSession(c.env, userId, { flow: "section:settings" });
    const summary =
      `${t(language, "settingsTitle")}\n` +
      `BTC: ${settings.btcThreshold}\nETH: ${settings.ethThreshold}\nUSDT: ${settings.usdtThreshold}\n` +
      `USD: ${settings.showUsdEstimate ? "ON" : "OFF"}\n` +
      `Chain: ${settings.blockchainNotificationsEnabled ? "ON" : "OFF"}\n` +
      `Service: ${settings.serviceNotificationsEnabled ? "ON" : "OFF"}`;
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, summary, settingsKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnCabinet")) {
    await setBotSession(c.env, userId, { flow: "section:cabinet" });
    const subscription = await getSubscriptionInfo(c.env, userId);
    const statusLabel =
      subscription.status === "active"
        ? t(language, "cabinetStatusActive")
        : t(language, "cabinetStatusInactive");
    const expiresAt = formatDateForLanguage(subscription.expiresAt, language);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "cabinetTitle")}\n` +
        `${t(language, "cabinetPlan")}: ${subscription.planCode}\n` +
        `${t(language, "cabinetStatus")}: ${statusLabel}\n` +
        `${t(language, "cabinetExpiresAt")}: ${expiresAt}\n` +
        `${t(language, "cabinetPromoActivations")}: ${subscription.promoActivations}`,
      cabinetKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnReputation")) {
    const score = await getUserReputation(c.env, userId);
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "reputationTitle")}\n${t(language, "reputationValue").replace("{score}", String(score))}`,
      mainKeyboard(language, isAdmin)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminPanel")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "section:admin" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminPanelTitle"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnActivatePromo")) {
    await setBotSession(c.env, userId, { flow: "cabinet:promo:code" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askPromoCode"), cabinetKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnPaySubscription")) {
    await setBotSession(c.env, userId, { flow: "cabinet:pay:network" });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "paymentChooseNetwork"),
      paymentNetworkKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnCheckPayment")) {
    const result = await processSubscriptionPayments(c.env, { userId });
    const active = await getActiveSubscriptionPaymentRequest(c.env, userId);
    if (result.paid > 0) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        language === "ru" ? "✅ Платеж найден и подписка активирована." : "✅ Payment found and subscription activated.",
        cabinetKeyboard(language)
      );
      return c.json({ ok: true });
    }
    if (!active) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "paymentCheckNoRequest"), cabinetKeyboard(language));
      return c.json({ ok: true });
    }
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "paymentCheckPending"), cabinetKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnList")) {
    const section = currentSection(session);
    if (section === "wallets") {
      await showWalletsList(c.env, message.chat.id, userId, language, sectionKeyboard(language));
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      const contacts = await listContacts(c.env, userId);
      if (contacts.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsListEmpty"), sectionKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = contacts.map((item, index) => `${index + 1}. [${formatNetwork(item.network)}] ${item.label} - ${maskAddress(item.address)}`);
      await sendPagedList({
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        language,
        title: `${t(language, "contactsTitle")}:`,
        lines,
        replyMarkup: sectionKeyboard(language)
      });
      return c.json({ ok: true });
    }

    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "unknown"),
      mainKeyboard(language, isAdmin)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnBalance")) {
    const section = currentSection(session);
    if (section !== "wallets") {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "unknown"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const wallets = await listWallets(c.env, userId);
    if (wallets.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletListEmpty"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    const lines = wallets.map((item, index) => `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)}`);
    await setBotSession(c.env, userId, { flow: "wallet:balance:pick", payload: { ids: wallets.map((item) => item.id) } });
    await sendPagedList({
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      language,
      title: t(language, "walletBalancesPick"),
      lines,
      replyMarkup: sectionKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnHistory")) {
    const section = currentSection(session);
    if (section !== "wallets") {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "unknown"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const history = await listTransferHistory(c.env, userId, 10);
    if (history.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "transferHistoryEmpty"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    const lines = await Promise.all(
      history.map(async (item, index) => {
        let ratingSuffix = "";
        if (item.counterpartyAddress) {
          const rep = await getWalletReputationByAddress(c.env, item.network, item.counterpartyAddress);
          if (rep) {
            ratingSuffix = ` · ⭐ ${rep.score}`;
          }
        }
        const directionMark = item.direction === "incoming" ? "⬅" : "➡";
        return `${index + 1}. ${directionMark} [${formatNetwork(item.network)}] ${item.amount} ${item.asset} · ${maskTxid(item.txid)}${ratingSuffix}`;
      })
    );
    await sendPagedList({
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      language,
      title: `${t(language, "transferHistoryTitle")}:`,
      lines,
      replyMarkup: sectionKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnRateTransfer")) {
    const section = currentSection(session);
    if (section !== "wallets") {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "unknown"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const history = await listTransferHistory(c.env, userId, 20);
    const rateable = history.filter((item) => Boolean(item.counterpartyAddress));
    if (rateable.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "transferRateNoSender"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    const lines = rateable.map(
      (item, index) =>
        `${index + 1}. [${formatNetwork(item.network)}] ${item.amount} ${item.asset} · ${maskTxid(item.txid)} · ${maskAddress(item.counterpartyAddress ?? "")}`
    );
    await setBotSession(c.env, userId, { flow: "transfer:rate:pick", payload: { ids: rateable.map((item) => item.id) } });
    await sendPagedList({
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      language,
      title: t(language, "transferRatePick"),
      lines,
      replyMarkup: sectionKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdd")) {
    const section = currentSection(session);
    if (section === "wallets") {
      await setBotSession(c.env, userId, { flow: "wallet:add:auto-address" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletAddress"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      await setBotSession(c.env, userId, { flow: "contact:add:auto-address" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactAddress"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "unknown"),
      mainKeyboard(language, isAdmin)
    );
    return c.json({ ok: true });
  }

  if (session?.flow === "wallet:add:network" && parseNetworkLabel(text)) {
    const network = parseNetworkLabel(text) as WalletNetwork;
    await setBotSession(c.env, userId, { flow: "wallet:add:address", payload: { network } });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletAddress"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:network" && parseNetworkLabel(text)) {
    const network = parseNetworkLabel(text) as WalletNetwork;
    await setBotSession(c.env, userId, { flow: "contact:add:address", payload: { network } });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactAddress"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnDelete")) {
    const section = currentSection(session);
    if (section === "wallets") {
      const wallets = await listWallets(c.env, userId);
      if (wallets.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletDeleteEmpty"), sectionKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = wallets.map((item, index) => `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)}`);
      await setBotSession(c.env, userId, { flow: "wallet:delete:pick", payload: { ids: wallets.map((item) => item.id) } });
      await sendPagedList({
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        language,
        title: t(language, "walletDeletePick"),
        lines,
        replyMarkup: sectionKeyboard(language)
      });
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      const contacts = await listContacts(c.env, userId);
      if (contacts.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsDeleteEmpty"), sectionKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = contacts.map((item, index) => `${index + 1}. [${formatNetwork(item.network)}] ${item.label} - ${maskAddress(item.address)}`);
      await setBotSession(c.env, userId, { flow: "contact:delete:pick", payload: { ids: contacts.map((item) => item.id) } });
      await sendPagedList({
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        language,
        title: t(language, "contactDeletePick"),
        lines,
        replyMarkup: sectionKeyboard(language)
      });
      return c.json({ ok: true });
    }
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "unknown"),
      mainKeyboard(language, isAdmin)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnLangRu")) {
    settings = await updateSettings(c.env, userId, { language: "ru" });
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t("ru", "settingsSaved"), settingsKeyboard(settings.language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnLangEn")) {
    settings = await updateSettings(c.env, userId, { language: "en" });
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t("en", "settingsSaved"), settingsKeyboard(settings.language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnToggleUsd")) {
    settings = await updateSettings(c.env, userId, { showUsdEstimate: !settings.showUsdEstimate });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      withState(settings.language, "usdState", settings.showUsdEstimate),
      settingsKeyboard(settings.language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnToggleChain")) {
    settings = await updateSettings(c.env, userId, {
      blockchainNotificationsEnabled: !settings.blockchainNotificationsEnabled
    });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      withState(settings.language, "chainState", settings.blockchainNotificationsEnabled),
      settingsKeyboard(settings.language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnToggleService")) {
    settings = await updateSettings(c.env, userId, {
      serviceNotificationsEnabled: !settings.serviceNotificationsEnabled
    });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      withState(settings.language, "serviceState", settings.serviceNotificationsEnabled),
      settingsKeyboard(settings.language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnSetBtc")) {
    await setBotSession(c.env, userId, { flow: "settings:threshold:btc" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askBtc"), settingsKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnSetEth")) {
    await setBotSession(c.env, userId, { flow: "settings:threshold:eth" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askEth"), settingsKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnSetUsdt")) {
    await setBotSession(c.env, userId, { flow: "settings:threshold:usdt" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askUsdt"), settingsKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnTest")) {
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "testNotification"), settingsKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminReputation")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const top = await listTopWalletReputations(c.env, 20);
    if (top.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminReputationEmpty"), adminKeyboard(language));
      return c.json({ ok: true });
    }
    const lines = top.map(
      (item, index) =>
        `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)} — ${item.score} (👍 ${item.likesCount} / 👎 ${item.dislikesCount})`
    );
    await sendPagedList({
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      language,
      title: `${t(language, "adminReputationTitle")}:`,
      lines,
      replyMarkup: adminKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminResetReputation")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "admin:reputation:reset:user" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminResetAsk"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminStopWallets")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "admin:stop:manage" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminStopHelp"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminLinks")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const entries = await listLinkAuditEntries(c.env, 20);
    if (entries.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminLinksEmpty"), adminKeyboard(language));
      return c.json({ ok: true });
    }
    const lines = entries.map(
      (item, index) =>
        `${index + 1}. ${toUserLabel({
          userId: item.actorUserId,
          username: item.actorUsername,
          displayName: item.actorDisplayName
        })} · ${item.entityType} · [${formatNetwork(item.network)}] ${maskAddress(item.address)}${item.label ? ` (${item.label})` : ""}`
    );
    await sendPagedList({
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      language,
      title: `${t(language, "adminLinksTitle")}:`,
      lines,
      replyMarkup: adminKeyboard(language)
    });
    return c.json({ ok: true });
  }

  await sendTelegramMessage(
    c.env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    t(language, "unknown"),
    mainKeyboard(language, isAdmin)
  );
  return c.json({ ok: true });
});

export default bot;
