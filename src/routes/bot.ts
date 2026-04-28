import { Hono } from "hono";
import type { Env } from "../types/env";
import {
  activatePromoCode,
  addStoppedWallet,
  clearBotSession,
  createContact,
  createPromoCodeEntry,
  createWallet,
  deleteContact,
  deleteWallet,
  type AdminDashboardStats,
  getBotSession,
  getActiveSubscriptionPaymentRequest,
  getSubscriptionInfo,
  getUserReputation,
  getUsageSummary,
  getWalletReputationByAddress,
  getSettings,
  getActiveSlotPackPaymentRequest,
  addExtraContactSlots,
  addExtraWalletSlots,
  getAdminDashboardStats,
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
  createSlotPackPaymentInvoice,
  createSubscriptionPaymentInvoice,
  processSubscriptionPayments
} from "../lib/subscription-payments";
import { detectAddressNetworks } from "../lib/validation";

type Variables = {
  userId: string;
};

type Language = "ru" | "en";

type InlineReplyMarkup = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

type TelegramUpdate = {
  message?: {
    message_id: number;
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
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string; last_name?: string };
    message?: { message_id: number; chat: { id: number; type: string } };
    data?: string;
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
    greet: "VOROBEY: Track — приватный трекинг транзакций криптокошельков. Управляйте кошельками, знакомыми адресами и настройками через кнопки ниже.",
    greetQuotaLine:
      "Квоты: отслеживаемые {wUsed}/{wMax} (свободно {wFree}), знакомые {cUsed}/{cMax} (свободно {cFree}).",
    listQuotaWallets: "Занято {used} из {max} · Можно добавить ещё: {free}",
    listQuotaContacts: "Занято {used} из {max} · Можно добавить ещё: {free}",
    unknown: "Не понял сообщение. Выберите действие кнопкой меню.",
    mainMenu: "Главное меню",
    walletsTitle: "Отслеживаемые",
    contactsTitle: "Знакомые кошельки",
    settingsTitle: "Настройки",
    askWalletNetwork: "Выберите сеть для кошелька.",
    askWalletAddress: "Отправьте адрес кошелька. Сеть определю автоматически.",
    askWalletLabel: "Отправьте имя для кошелька (например, Зарплатный). Для пропуска отправьте «-».",
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
    walletLimitReached: "Достигнут лимит кошельков ({max}).",
    contactLimitReached: "Достигнут лимит знакомых кошельков ({max}).",
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
    walletActionsOnly: "Эта кнопка работает только в разделе «Отслеживаемые».",
    pagedListStale: "Список устарел. Откройте его снова кнопкой «Список».",
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
    paymentCopyHint: "Нажмите на адрес, чтобы быстро скопировать.",
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
    adminPromoAsk:
      "Создать промокод — одна строка:\nCODE DAYS [MAX] [BONUS]\n\n• CODE — сам код, напр. SPRING2026\n• DAYS — дней подписки (база)\n• MAX — лимит вводов, можно пропустить\n• BONUS — по желанию: +% к дням. 30+20% = 36, не от суммы оплаты\n\nПримеры: SPRING2026 30 | SPRING2026 30 100 | SPRING2026 30 100 20",
    adminPromoCreated: "Промокод создан.",
    adminPromoInvalid:
      "Формат неверный.\nИспользуйте: CODE DAYS [MAX] [BONUS]\nПример: SPRING2026 30 100 20",
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
    btnPagedPrev: "⬅️ Пред.",
    btnPagedNext: "След. ➡️",
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
    btnAdminCreatePromo: "🎟️ Создать промокод",
    btnActivatePromo: "🎟️ Активировать промокод",
    btnPaySubscription: "💳 Оплатить подписку",
    btnPaySlotPack: "➕ +10 слотов ($10)",
    slotPackPaymentChooseNetwork: "Выберите сеть (10 USDT = +10 слотов для отслеживаемых кошельков).",
    slotPackInvoiceTitle: "Пакет: +10 слотов",
    adminSlotsHelp:
      "Команда слотов: <code>SLOTS &lt;telegram_id&gt; &lt;+кош&gt; &lt;+контакты&gt;</code>\nПример: <code>SLOTS 123456789 10 0</code> — +10 кошельков, контакты без изменений.",
    btnAdminStats: "📊 Статистика",
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
    greet: "VOROBEY: Track — private tracking of crypto wallet transactions. Use the buttons below to manage wallets, contacts, and settings.",
    greetQuotaLine: "Quotas: tracked {wUsed}/{wMax} ({wFree} free), known {cUsed}/{cMax} ({cFree} free).",
    listQuotaWallets: "In use: {used} of {max} · You can add: {free} more",
    listQuotaContacts: "In use: {used} of {max} · You can add: {free} more",
    unknown: "I did not understand. Please choose an action from the menu.",
    mainMenu: "Main menu",
    btnPagedPrev: "⬅️ Prev",
    btnPagedNext: "Next ➡️",
    walletsTitle: "My wallets",
    contactsTitle: "Known wallets",
    settingsTitle: "Settings",
    askWalletNetwork: "Choose wallet network.",
    askWalletAddress: "Send wallet address. I will detect the network automatically.",
    askWalletLabel: "Send wallet name/label (example: Salary). Send '-' to skip.",
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
    walletLimitReached: "Wallet limit reached ({max}).",
    contactLimitReached: "Known wallet limit reached ({max}).",
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
    walletActionsOnly: "This action works only in the wallets section.",
    pagedListStale: "The list is outdated. Open it again with the List button.",
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
    paymentCopyHint: "Tap the address to copy it quickly.",
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
    adminPromoAsk:
      "Create a promo in one line:\nCODE DAYS [MAX] [BONUS]\n\n• CODE — e.g. SPRING2026\n• DAYS — subscription days (base)\n• MAX — redemption cap, optional\n• BONUS — optional: +% to days. 30+20% = 36, not payment-related\n\nExamples: SPRING2026 30 | SPRING2026 30 100 | SPRING2026 30 100 20",
    adminPromoCreated: "Promo code created.",
    adminPromoInvalid:
      "Invalid format.\nUse: CODE DAYS [MAX] [BONUS]\nExample: SPRING2026 30 100 20",
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
    btnAdminCreatePromo: "🎟️ Create promo code",
    btnActivatePromo: "🎟️ Activate promo code",
    btnPaySubscription: "💳 Pay subscription",
    btnPaySlotPack: "➕ +10 slots ($10)",
    slotPackPaymentChooseNetwork: "Choose a network (10 USDT = +10 wallet slots).",
    slotPackInvoiceTitle: "Pack: +10 slots",
    adminSlotsHelp:
      "Slot command: <code>SLOTS &lt;telegram_id&gt; &lt;+wallets&gt; &lt;+contacts&gt;</code>\nExample: <code>SLOTS 123456789 10 0</code>",
    btnAdminStats: "📊 Statistics",
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
/** Tracked message ids to delete on the next UI message (one chat may have e.g. list + keyboard anchor). */
const lastUiMessageIdsByChat = new Map<number, number[]>();

function t(language: Language, key: keyof (typeof I18N)["ru"]): string {
  return I18N[language][key];
}

function isBtn(input: string, key: keyof (typeof I18N)["ru"]): boolean {
  return input === I18N.ru[key] || input === I18N.en[key];
}

function isAdminActionButton(input: string): boolean {
  return (
    isBtn(input, "btnAdminPanel") ||
    isBtn(input, "btnAdminStats") ||
    isBtn(input, "btnAdminReputation") ||
    isBtn(input, "btnAdminResetReputation") ||
    isBtn(input, "btnAdminStopWallets") ||
    isBtn(input, "btnAdminLinks") ||
    isBtn(input, "btnAdminCreatePromo")
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
    isBtn(input, "btnPaySlotPack") ||
    isBtn(input, "btnCheckPayment") ||
    isBtn(input, "btnActivatePromo")
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

type PagedListKind = "w" | "cl" | "b" | "h" | "rt" | "dw" | "dc" | "ar" | "al" | "as";

function paginateLines(lines: string[], pageSize = 8): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    pages.push(lines.slice(i, i + pageSize));
  }
  return pages;
}

function pagedListEmptyText(language: Language, kind: PagedListKind): string {
  switch (kind) {
    case "w":
    case "b":
      return t(language, "walletListEmpty");
    case "cl":
      return t(language, "contactsListEmpty");
    case "h":
      return t(language, "transferHistoryEmpty");
    case "rt":
      return t(language, "transferRateNoSender");
    case "dw":
      return t(language, "walletDeleteEmpty");
    case "dc":
      return t(language, "contactsDeleteEmpty");
    case "ar":
      return t(language, "adminReputationEmpty");
    case "al":
      return t(language, "adminLinksEmpty");
    case "as":
      return t(language, "adminStopEmpty");
  }
}

function isSessionValidForPickPagedList(session: BotSession | null, kind: PagedListKind): boolean {
  if (kind === "b") {
    return session?.flow === "wallet:balance:pick" && ((session.payload?.ids as string[] | undefined) ?? []).length > 0;
  }
  if (kind === "rt") {
    return session?.flow === "transfer:rate:pick" && ((session.payload?.ids as string[] | undefined) ?? []).length > 0;
  }
  if (kind === "dw") {
    return session?.flow === "wallet:delete:pick" && ((session.payload?.ids as string[] | undefined) ?? []).length > 0;
  }
  if (kind === "dc") {
    return session?.flow === "contact:delete:pick" && ((session.payload?.ids as string[] | undefined) ?? []).length > 0;
  }
  return true;
}

/** "N. Имя" or "N. BEP20" if no custom name — без [сеть] в скобках. */
function listItemHeadHtml(item: { label: string | null | undefined; network: WalletNetwork }): string {
  const trimmed = item.label?.trim();
  if (trimmed) {
    return escapeHtml(trimmed);
  }
  return formatNetwork(item.network);
}

type ListPageTitleContext = {
  kind: PagedListKind;
  currentPage0: number;
  totalPages: number;
  language: Language;
};

/** Заголовок, пустая строка, строки. Для «Отслеживаемые» при нескольких страницах: «/ стр.N» (или p.N). */
function buildListPageBody(
  title: string,
  lineChunk: string[],
  ctx?: ListPageTitleContext,
  quotaLineHtml?: string
): string {
  let head = title;
  if (ctx && (ctx.kind === "w" || ctx.kind === "cl") && ctx.totalPages > 1) {
    const p = ctx.currentPage0 + 1;
    const part = ctx.language === "ru" ? "стр." : "p.";
    head = `${title} / ${part}${p}`;
  }
  if (quotaLineHtml) {
    head = `${head}\n\n${quotaLineHtml}`;
  }
  return `${head}\n\n${lineChunk.join("\n")}`;
}

function buildListPaginationInline(
  kind: PagedListKind,
  currentPage0: number,
  totalPages: number,
  language: Language
): InlineReplyMarkup {
  const prevPage = currentPage0 <= 0 ? 0 : currentPage0 - 1;
  const nextPage = currentPage0 >= totalPages - 1 ? totalPages - 1 : currentPage0 + 1;
  const k = `p:${kind}:`;
  if (totalPages <= 1) {
    return { inline_keyboard: [] };
  }
  return {
    inline_keyboard: [
      [
        { text: language === "ru" ? "⬅️ Пред." : "⬅️ Prev", callback_data: `${k}${prevPage}` },
        { text: t(language, "btnMainMenu"), callback_data: "m:main" },
        { text: language === "ru" ? "След. ➡️" : "Next ➡️", callback_data: `${k}${nextPage}` }
      ]
    ]
  };
}

function defaultReplyKeyboardForListKind(kind: PagedListKind, language: Language): ReplyMarkup {
  if (kind === "ar" || kind === "al" || kind === "as") {
    return adminKeyboard(language);
  }
  if (kind === "cl" || kind === "dc") {
    return sectionKeyboard(language, "contacts");
  }
  return sectionKeyboard(language);
}

/** Only used when the list is split into several pages. Telegram allows one reply_markup per message — we paginate in the custom keyboard, not with inline. */
function pagedListReplyKeyboard(language: Language, kind: PagedListKind, totalPages: number): ReplyMarkup {
  if (totalPages <= 1) {
    return defaultReplyKeyboardForListKind(kind, language);
  }
  const navRow = [t(language, "btnPagedPrev"), t(language, "btnMainMenu"), t(language, "btnPagedNext")];
  if (kind === "ar" || kind === "al" || kind === "as") {
    return {
      keyboard: [
        [t(language, "btnAdminStats")],
        [t(language, "btnAdminCreatePromo")],
        [t(language, "btnAdminStopWallets"), t(language, "btnAdminLinks")],
        navRow
      ],
      resize_keyboard: true
    };
  }
  if (kind === "cl" || kind === "dc") {
    return {
      keyboard: [
        [t(language, "btnList"), t(language, "btnAdd"), t(language, "btnDelete")],
        navRow
      ],
      resize_keyboard: true
    };
  }
  return {
    keyboard: [
      [t(language, "btnList"), t(language, "btnAdd"), t(language, "btnDelete")],
      [t(language, "btnBalance"), t(language, "btnHistory")],
      navRow
    ],
    resize_keyboard: true
  };
}

function quotaPlainWallets(language: Language, used: number, max: number): string {
  const free = Math.max(0, max - used);
  return t(language, "listQuotaWallets")
    .replace("{used}", String(used))
    .replace("{max}", String(max))
    .replace("{free}", String(free));
}

function quotaPlainContacts(language: Language, used: number, max: number): string {
  const free = Math.max(0, max - used);
  return t(language, "listQuotaContacts")
    .replace("{used}", String(used))
    .replace("{max}", String(max))
    .replace("{free}", String(free));
}

function quotaWalletsLineHtml(language: Language, used: number, max: number): string {
  return `<i>${escapeHtml(quotaPlainWallets(language, used, max))}</i>`;
}

function quotaContactsLineHtml(language: Language, used: number, max: number): string {
  return `<i>${escapeHtml(quotaPlainContacts(language, used, max))}</i>`;
}

function formatGreetQuotaLine(
  language: Language,
  walletsUsed: number,
  contactsUsed: number,
  walletMax: number,
  contactMax: number
): string {
  const wFree = Math.max(0, walletMax - walletsUsed);
  const cFree = Math.max(0, contactMax - contactsUsed);
  return t(language, "greetQuotaLine")
    .replace("{wUsed}", String(walletsUsed))
    .replace("{wMax}", String(walletMax))
    .replace("{wFree}", String(wFree))
    .replace("{cUsed}", String(contactsUsed))
    .replace("{cMax}", String(contactMax))
    .replace("{cFree}", String(cFree));
}

async function loadPagedListContent(
  env: Env,
  userId: string,
  language: Language,
  isAdmin: boolean,
  session: BotSession | null,
  kind: PagedListKind
): Promise<{
  title: string;
  lines: string[];
  parseMode?: "HTML" | "MarkdownV2";
  quotaLineHtml?: string;
} | null> {
  switch (kind) {
    case "w": {
      const [wallets, summary] = await Promise.all([listWallets(env, userId), getUsageSummary(env, userId)]);
      if (wallets.length === 0) {
        return null;
      }
      const lines = wallets.map(
        (item, index) =>
          `${index + 1}. <b>${listItemHeadHtml(item)}</b>\n<blockquote>${escapeHtml(item.address)}</blockquote>`
      );
      return {
        title: `👁️ <b>${escapeHtml(t(language, "walletsTitle"))}</b>`,
        lines,
        parseMode: "HTML",
        quotaLineHtml: quotaWalletsLineHtml(language, wallets.length, summary.walletLimit)
      };
    }
    case "cl": {
      const [contacts, summary] = await Promise.all([listContacts(env, userId), getUsageSummary(env, userId)]);
      if (contacts.length === 0) {
        return null;
      }
      const lines = contacts.map(
        (item, index) =>
          `${index + 1}. <b>${listItemHeadHtml(item)}</b>\n<blockquote>${escapeHtml(item.address)}</blockquote>`
      );
      return {
        title: `👥 <b>${escapeHtml(t(language, "contactsTitle"))}</b>`,
        lines,
        parseMode: "HTML",
        quotaLineHtml: quotaContactsLineHtml(language, contacts.length, summary.contactLimit)
      };
    }
    case "b": {
      if (!isSessionValidForPickPagedList(session, "b")) {
        return null;
      }
      const wallets = await listWallets(env, userId);
      if (wallets.length === 0) {
        return null;
      }
      const lines = wallets.map(
        (item, index) =>
          `${index + 1}. <b>${listItemHeadHtml(item)}</b>\n<blockquote>${escapeHtml(maskAddress(item.address))}</blockquote>`
      );
      return { title: t(language, "walletBalancesPick"), lines, parseMode: "HTML" };
    }
    case "h": {
      const history = await listTransferHistory(env, userId, 10);
      if (history.length === 0) {
        return null;
      }
      const lines = await Promise.all(
        history.map(async (item, index) => {
          let ratingSuffix = "";
          if (item.counterpartyAddress) {
            const rep = await getWalletReputationByAddress(env, item.network, item.counterpartyAddress);
            if (rep) {
              ratingSuffix = ` · ⭐ ${rep.score}`;
            }
          }
          const directionMark = item.direction === "incoming" ? "⬅" : "➡";
          return `${index + 1}. ${directionMark} [${formatNetwork(item.network)}] ${item.amount} ${item.asset} · ${maskTxid(item.txid)}${ratingSuffix}`;
        })
      );
      return { title: `${t(language, "transferHistoryTitle")}:`, lines };
    }
    case "rt": {
      if (!isSessionValidForPickPagedList(session, "rt")) {
        return null;
      }
      const history = await listTransferHistory(env, userId, 20);
      const rateable = history.filter((item) => Boolean(item.counterpartyAddress));
      if (rateable.length === 0) {
        return null;
      }
      const lines = rateable.map(
        (item, index) =>
          `${index + 1}. [${formatNetwork(item.network)}] ${item.amount} ${item.asset} · ${maskTxid(item.txid)} · ${maskAddress(
            item.counterpartyAddress ?? ""
          )}`
      );
      return { title: t(language, "transferRatePick"), lines };
    }
    case "dw": {
      if (!isSessionValidForPickPagedList(session, "dw")) {
        return null;
      }
      const wallets = await listWallets(env, userId);
      if (wallets.length === 0) {
        return null;
      }
      const lines = wallets.map(
        (item, index) =>
          `${index + 1}. <b>${listItemHeadHtml(item)}</b>\n<blockquote>${escapeHtml(maskAddress(item.address))}</blockquote>`
      );
      return { title: t(language, "walletDeletePick"), lines, parseMode: "HTML" };
    }
    case "dc": {
      if (!isSessionValidForPickPagedList(session, "dc")) {
        return null;
      }
      const contacts = await listContacts(env, userId);
      if (contacts.length === 0) {
        return null;
      }
      const lines = contacts.map(
        (item, index) =>
          `${index + 1}. <b>${listItemHeadHtml(item)}</b>\n<blockquote>${escapeHtml(maskAddress(item.address))}</blockquote>`
      );
      return { title: t(language, "contactDeletePick"), lines, parseMode: "HTML" };
    }
    case "ar": {
      if (!isAdmin) {
        return null;
      }
      const top = await listTopWalletReputations(env, 20);
      if (top.length === 0) {
        return null;
      }
      const lines = top.map(
        (item, index) =>
          `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)} — ${item.score} (👍 ${item.likesCount} / 👎 ${
            item.dislikesCount
          })`
      );
      return { title: `${t(language, "adminReputationTitle")}:`, lines };
    }
    case "al": {
      if (!isAdmin) {
        return null;
      }
      const entries = await listLinkAuditEntries(env, 20);
      if (entries.length === 0) {
        return null;
      }
      const lines = entries.map(
        (item, index) =>
          `${index + 1}. ${toUserLabel({
            userId: item.actorUserId,
            username: item.actorUsername,
            displayName: item.actorDisplayName
          })} · ${item.entityType} · [${formatNetwork(item.network)}] ${maskAddress(item.address)}${
            item.label ? ` (${item.label})` : ""
          }`
      );
      return { title: `${t(language, "adminLinksTitle")}:`, lines };
    }
    case "as": {
      if (!isAdmin) {
        return null;
      }
      const stopped = await listStoppedWallets(env);
      if (stopped.length === 0) {
        return null;
      }
      const lines = stopped.map(
        (item, index) =>
          `${index + 1}. [${formatNetwork(item.network)}] ${maskAddress(item.address)} by ${toUserLabel({
            userId: item.addedByUserId,
            username: item.addedByUsername,
            displayName: item.addedByDisplayName
          })}`
      );
      return { title: `${t(language, "adminStopListTitle")}:`, lines };
    }
    default:
      return null;
  }
}

async function sendPagedList(params: {
  env: Env;
  token: string;
  chatId: number;
  userId: string;
  language: Language;
  isAdmin: boolean;
  session: BotSession | null;
  kind: PagedListKind;
  replyKeyboard: ReplyMarkup;
  pageSize?: number;
  /** Zero-based page index (clamped to available range). */
  page0?: number;
}): Promise<void> {
  if ((params.kind === "ar" || params.kind === "al" || params.kind === "as") && !params.isAdmin) {
    await sendTelegramMessage(
      params.token,
      params.chatId,
      t(params.language, "adminOnly"),
      adminKeyboard(params.language)
    );
    return;
  }

  const pageSize = params.pageSize ?? 8;
  const content = await loadPagedListContent(
    params.env,
    params.userId,
    params.language,
    params.isAdmin,
    params.session,
    params.kind
  );
  if (!content) {
    const pld = { ...(params.session?.payload as Record<string, unknown> | undefined) };
    delete pld.paged;
    if (params.session?.flow) {
      await setBotSession(params.env, params.userId, { flow: params.session.flow, payload: pld });
    }
    let emptyText = pagedListEmptyText(params.language, params.kind);
    if (params.kind === "w") {
      const summary = await getUsageSummary(params.env, params.userId);
      emptyText += `\n\n${quotaPlainWallets(params.language, 0, summary.walletLimit)}`;
    } else if (params.kind === "cl") {
      const summary = await getUsageSummary(params.env, params.userId);
      emptyText += `\n\n${quotaPlainContacts(params.language, 0, summary.contactLimit)}`;
    }
    await sendTelegramMessage(params.token, params.chatId, emptyText, params.replyKeyboard);
    return;
  }
  const pages = paginateLines(content.lines, pageSize);
  const totalPages = pages.length;
  if (totalPages === 0) {
    const pld = { ...(params.session?.payload as Record<string, unknown> | undefined) };
    delete pld.paged;
    if (params.session?.flow) {
      await setBotSession(params.env, params.userId, { flow: params.session.flow, payload: pld });
    }
    await sendTelegramMessage(
      params.token,
      params.chatId,
      pagedListEmptyText(params.language, params.kind),
      params.replyKeyboard
    );
    return;
  }
  const startPage = Math.max(0, Math.min((params.page0 ?? 0) | 0, totalPages - 1));
  const chunk = pages[startPage] ?? [];
  const body0 = buildListPageBody(
    content.title,
    chunk,
    {
      kind: params.kind,
      currentPage0: startPage,
      totalPages,
      language: params.language
    },
    content.quotaLineHtml
  );
  const replyMarkup =
    totalPages > 1
      ? pagedListReplyKeyboard(params.language, params.kind, totalPages)
      : params.replyKeyboard;
  await sendTelegramMessage(
    params.token,
    params.chatId,
    body0,
    replyMarkup,
    content.parseMode
  );
  if (params.session?.flow) {
    const pld: Record<string, unknown> = { ...(params.session.payload as Record<string, unknown> | undefined) };
    if (totalPages > 1) {
      pld.paged = { kind: params.kind, page0: startPage, total: totalPages };
    } else {
      delete pld.paged;
    }
    await setBotSession(params.env, params.userId, { flow: params.session.flow, payload: pld });
  }
}

async function showWalletsList(
  env: Env,
  chatId: number,
  userId: string,
  language: Language,
  isAdmin: boolean,
  session: BotSession | null,
  replyMarkup: ReplyMarkup
): Promise<void> {
  await sendPagedList({
    env,
    token: env.TELEGRAM_BOT_TOKEN,
    chatId,
    userId,
    language,
    isAdmin,
    session,
    kind: "w",
    replyKeyboard: replyMarkup
  });
}

async function showContactsList(
  env: Env,
  chatId: number,
  userId: string,
  language: Language,
  isAdmin: boolean,
  session: BotSession | null,
  replyMarkup: ReplyMarkup
): Promise<void> {
  await sendPagedList({
    env,
    token: env.TELEGRAM_BOT_TOKEN,
    chatId,
    userId,
    language,
    isAdmin,
    session,
    kind: "cl",
    replyKeyboard: replyMarkup
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
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
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
    const m = message.match(/Wallet limit reached:\s*(\d+)/);
    return t(language, "walletLimitReached").replace("{max}", m ? m[1] : "10");
  }
  if (entity === "contact" && message.startsWith("Contact limit reached")) {
    const m = message.match(/Contact limit reached:\s*(\d+)/);
    return t(language, "contactLimitReached").replace("{max}", m ? m[1] : "50");
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
  if (!hasFullAccess) {
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
      [t(language, "btnPaySlotPack")],
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

function sectionKeyboard(language: Language, section: "wallets" | "contacts" = "wallets"): ReplyMarkup {
  if (section === "contacts") {
    return {
      keyboard: [
        [t(language, "btnList"), t(language, "btnAdd"), t(language, "btnDelete")],
        [t(language, "btnMainMenu")]
      ],
      resize_keyboard: true
    };
  }
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
      [t(language, "btnAdminStats")],
      [t(language, "btnAdminCreatePromo")],
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
  replyMarkup?: ReplyMarkup,
  parseMode?: "HTML" | "MarkdownV2",
  inlineKeyboard?: InlineReplyMarkup
): Promise<Response> {
  if (replyMarkup || inlineKeyboard) {
    const previousIds = lastUiMessageIdsByChat.get(chatId);
    if (previousIds?.length) {
      for (const mid of previousIds) {
        await deleteTelegramMessageWithRetry(token, chatId, mid);
      }
      lastUiMessageIdsByChat.delete(chatId);
    }
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text
  };
  if (inlineKeyboard) {
    payload.reply_markup = inlineKeyboard;
  } else if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if ((replyMarkup || inlineKeyboard) && response.ok) {
    try {
      const data = (await response.clone().json()) as { result?: { message_id?: number } };
      const sentMessageId = data.result?.message_id;
      if (typeof sentMessageId === "number") {
        lastUiMessageIdsByChat.set(chatId, [sentMessageId]);
      }
    } catch {
      // Ignore tracking parse errors; message still sent.
    }
  }

  return response;
}

async function answerCallbackQuery(
  token: string,
  callbackId: string,
  options?: { text?: string; showAlert?: boolean }
): Promise<void> {
  const payload: Record<string, unknown> = { callback_query_id: callbackId };
  if (options?.text) {
    payload.text = options.text;
    payload.show_alert = Boolean(options.showAlert);
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore
  }
}

async function editTelegramMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  inlineKeyboard: InlineReplyMarkup,
  parseMode?: "HTML" | "MarkdownV2"
): Promise<Response> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: inlineKeyboard
  };
  if (parseMode) {
    payload.parse_mode = parseMode;
  }
  return fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function deleteTelegramMessage(token: string, chatId: number, messageId: number): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    if (response.ok) return true;
    const body = await response.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.warn("Telegram deleteMessage failed", { status: response.status, body, chatId, messageId });
    return false;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Telegram deleteMessage request error", {
      chatId,
      messageId,
      error: (error as Error)?.message ?? String(error)
    });
    return false;
  }
}

async function deleteTelegramMessageWithRetry(token: string, chatId: number, messageId: number): Promise<void> {
  const firstTry = await deleteTelegramMessage(token, chatId, messageId);
  if (firstTry) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  await deleteTelegramMessage(token, chatId, messageId);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildCabinetSummaryHtml(
  language: Language,
  subscription: { planCode: string; status: "active" | "inactive"; expiresAt: string | null; promoActivations: number }
): string {
  const statusLabel =
    subscription.status === "active"
      ? `✅ ${t(language, "cabinetStatusActive")}`
      : `⛔ ${t(language, "cabinetStatusInactive")}`;
  const expiresAt = formatDateForLanguage(subscription.expiresAt, language);
  return (
    `🪪 <b>${escapeHtml(t(language, "cabinetTitle"))}</b>\n\n` +
    `📦 <b>${escapeHtml(t(language, "cabinetPlan"))}:</b> <code>${escapeHtml(subscription.planCode)}</code>\n` +
    `🟢 <b>${escapeHtml(t(language, "cabinetStatus"))}:</b> ${escapeHtml(statusLabel)}\n` +
    `🕒 <b>${escapeHtml(t(language, "cabinetExpiresAt"))}:</b> ${escapeHtml(expiresAt)}\n` +
    `🎟️ <b>${escapeHtml(t(language, "cabinetPromoActivations"))}:</b> ${subscription.promoActivations}`
  );
}

function buildAdminStatsHtml(language: Language, stats: AdminDashboardStats): string {
  if (language === "ru") {
    return (
      `📊 <b>Статистика бота</b>\n\n` +
      `👥 Зарегистрировано в базе: <b>${stats.totalUsers}</b>\n` +
      `👁 С отслеживаемым кошельком: <b>${stats.usersWithTrackedWallets}</b>\n` +
      `✅ Активная подписка сейчас: <b>${stats.activeSubscriptions}</b>\n` +
      `🎟 Промокод активирован (всего за всё время): <b>${stats.promoActivationsEver}</b>`
    );
  }
  return (
    `📊 <b>Bot statistics</b>\n\n` +
    `👥 Users in database: <b>${stats.totalUsers}</b>\n` +
    `👁 With at least one tracked wallet: <b>${stats.usersWithTrackedWallets}</b>\n` +
    `✅ Active subscriptions now: <b>${stats.activeSubscriptions}</b>\n` +
    `🎟 Promo code activations (all-time): <b>${stats.promoActivationsEver}</b>`
  );
}

function buildAdminPromoGuideHtml(language: Language): string {
  if (language === "ru") {
    return (
      "🎟️ <b>Создание промокода</b>\n\n" +
      "<code>CODE DAYS [MAX] [BONUS]</code>\n\n" +
      "• <b>CODE</b> — ваш код, напр. <code>SPRING2026</code>\n" +
      "• <b>DAYS</b> — сколько дней подписки дать (база)\n" +
      "• <b>MAX</b> — лимит вводов, можно пропустить\n" +
      "• <b>BONUS</b> — по желанию: +% к <code>DAYS</code>, напр. 30+20% → 36 (не от оплаты)\n\n" +
      "<b>Примеры:</b>\n" +
      "<code>SPRING2026 30</code>\n" +
      "<code>SPRING2026 30 100</code>\n" +
      "<code>SPRING2026 30 100 20</code>"
    );
  }
  return (
    "🎟️ <b>Create promo code</b>\n\n" +
    "<code>CODE DAYS [MAX] [BONUS]</code>\n\n" +
    "• <b>CODE</b> — your code, e.g. <code>SPRING2026</code>\n" +
    "• <b>DAYS</b> — subscription days (base amount)\n" +
    "• <b>MAX</b> — redemption cap, optional\n" +
    "• <b>BONUS</b> — optional: +% to <code>DAYS</code>. 30+20% → 36 days (not the payment size)\n\n" +
    "<b>Examples:</b>\n" +
    "<code>SPRING2026 30</code>\n" +
    "<code>SPRING2026 30 100</code>\n" +
    "<code>SPRING2026 30 100 20</code>"
  );
}

bot.post("/telegram", async (c) => {
  const secret = c.req.header("x-telegram-bot-api-secret-token");
  if (!secret || secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const update = (await c.req.json()) as TelegramUpdate;
  if (update.callback_query?.from && update.callback_query.message?.chat) {
    const cq = update.callback_query;
    const cbMessage = cq.message;
    if (!cbMessage) {
      return c.json({ ok: true });
    }
    if (cbMessage.chat.type !== "private") {
      return c.json({ ok: true });
    }
    const token = c.env.TELEGRAM_BOT_TOKEN;
    const userId = String(cq.from.id);
    const chatId = cbMessage.chat.id;
    const data = cq.data ?? "";
    if (data === "p:noop") {
      await answerCallbackQuery(token, cq.id);
      return c.json({ ok: true });
    }
    if (data === "m:main") {
      await clearBotSession(c.env, userId);
      const settings = await getSettings(c.env, userId);
      const language = settings.language;
      const isAdmin = isAdminUser(c.env, userId);
      const subscription = await getSubscriptionInfo(c.env, userId);
      const hasBotAccess = isAdmin || hasActiveSubscription(subscription);
      await answerCallbackQuery(token, cq.id);
      await sendTelegramMessage(
        token,
        chatId,
        hasBotAccess ? `🏠 ${t(language, "mainMenu")}` : t(language, "accessRequiredHint"),
        mainKeyboard(language, isAdmin, hasBotAccess)
      );
      return c.json({ ok: true });
    }
    const pageMatch = data.match(/^p:([^:]+):(\d+)$/);
    if (pageMatch) {
      const kind = pageMatch[1];
      const pageArg = pageMatch[2] ?? "0";
      const ALL_KINDS: PagedListKind[] = ["w", "cl", "b", "h", "rt", "dw", "dc", "ar", "al", "as"];
      if (!ALL_KINDS.includes(kind as PagedListKind)) {
        await answerCallbackQuery(token, cq.id);
        return c.json({ ok: true });
      }
      const k = kind as PagedListKind;
      const isAdmin = isAdminUser(c.env, userId);
      const settings = await getSettings(c.env, userId);
      const language = settings.language;
      const session = await getBotSession(c.env, userId);
      if ((k === "ar" || k === "al" || k === "as") && !isAdmin) {
        await answerCallbackQuery(token, cq.id, { text: t(language, "adminOnly"), showAlert: true });
        return c.json({ ok: true });
      }
      if (["b", "rt", "dw", "dc"].includes(k) && !isSessionValidForPickPagedList(session, k)) {
        await answerCallbackQuery(token, cq.id, { text: t(language, "pagedListStale"), showAlert: true });
        return c.json({ ok: true });
      }
      const content = await loadPagedListContent(c.env, userId, language, isAdmin, session, k);
      if (!content) {
        await answerCallbackQuery(token, cq.id, { text: t(language, "pagedListStale"), showAlert: true });
        return c.json({ ok: true });
      }
      const pageSize = 8;
      const pages = paginateLines(content.lines, pageSize);
      const total = pages.length;
      const wantPage = Math.max(0, Number.parseInt(pageArg, 10) || 0);
      const p = Math.min(wantPage, Math.max(0, total - 1));
      const chunk = pages[p] ?? [];
      const body = buildListPageBody(
        content.title,
        chunk,
        {
          kind: k,
          currentPage0: p,
          totalPages: total,
          language
        },
        content.quotaLineHtml
      );
      const inline = buildListPaginationInline(k, p, total, language);
      const msgId = cbMessage.message_id;
      if (typeof msgId === "number") {
        const res = await editTelegramMessage(token, chatId, msgId, body, inline, content.parseMode);
        if (!res.ok) {
          await sendPagedList({
            env: c.env,
            token,
            chatId,
            userId,
            language,
            isAdmin,
            session,
            kind: k,
            replyKeyboard: defaultReplyKeyboardForListKind(k, language),
            page0: p
          });
        }
      }
      await answerCallbackQuery(token, cq.id);
      return c.json({ ok: true });
    }
    await answerCallbackQuery(token, cq.id);
    return c.json({ ok: true });
  }

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

  // Remove the user's tap/command from the chat so history stays a single bot "card" + keyboard.
  await deleteTelegramMessageWithRetry(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, message.message_id);

  if (!text || text === "/start" || text === "/menu") {
    await clearBotSession(c.env, userId);
    let welcomeText = hasBotAccess
      ? t(language, "greet")
      : `${t(language, "accessRequired")}\n\n${t(language, "accessRequiredHint")}`;
    if (hasBotAccess) {
      const [walletsG, contactsG, summaryG] = await Promise.all([
        listWallets(c.env, userId),
        listContacts(c.env, userId),
        getUsageSummary(c.env, userId)
      ]);
      welcomeText += "\n\n" + formatGreetQuotaLine(language, walletsG.length, contactsG.length, summaryG.walletLimit, summaryG.contactLimit);
    }
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      welcomeText,
      mainKeyboard(language, isAdmin, hasBotAccess)
    );
    return c.json({ ok: true });
  }

  if (isAdmin && text) {
    const slotsMatch = text.match(/^\s*SLOTS\s+(\d+)\s+(\d+)\s+(\d+)\s*$/i);
    if (slotsMatch) {
      const targetUserId = slotsMatch[1] ?? "";
      const wAdd = Number.parseInt(slotsMatch[2] ?? "0", 10);
      const cAdd = Number.parseInt(slotsMatch[3] ?? "0", 10);
      if (!/^\d+$/.test(targetUserId) || wAdd < 0 || cAdd < 0) {
        await sendTelegramMessage(
          c.env.TELEGRAM_BOT_TOKEN,
          message.chat.id,
          t(language, "adminSlotsHelp"),
          adminKeyboard(language),
          "HTML"
        );
        return c.json({ ok: true });
      }
      const [totalExtraW, totalExtraC] = await Promise.all([
        addExtraWalletSlots(c.env, targetUserId, wAdd),
        addExtraContactSlots(c.env, targetUserId, cAdd)
      ]);
      const msg =
        language === "ru"
          ? `Слоты обновлены (user <code>${escapeHtml(targetUserId)}</code>).\nКошельки: +${wAdd} → всего доп.: ${totalExtraW}\nКонтакты: +${cAdd} → всего доп.: ${totalExtraC}`
          : `Slots updated (user <code>${escapeHtml(targetUserId)}</code>).\nWallets: +${wAdd} → total extra: ${totalExtraW}\nContacts: +${cAdd} → total extra: ${totalExtraC}`;
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, msg, adminKeyboard(language), "HTML");
      return c.json({ ok: true });
    }
  }

  if (isBtn(text, "btnMainMenu") || isBtn(text, "btnBack")) {
    await clearBotSession(c.env, userId);
    // Explicitly resend the main keyboard so user can always exit nested flows,
    // including admin panel, in one tap.
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      hasBotAccess ? `🏠 ${t(language, "mainMenu")}` : t(language, "accessRequiredHint"),
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
    isBtn(text, "btnPaySlotPack") ||
    isBtn(text, "btnCheckPayment") ||
    isBtn(text, "btnActivatePromo") ||
    isBtn(text, "paymentNetworkBsc") ||
    isBtn(text, "paymentNetworkTrc20") ||
    session?.flow === "cabinet:promo:code" ||
    session?.flow === "cabinet:pay:network" ||
    session?.flow === "cabinet:pay-slots:network";

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

  if (text && (isBtn(text, "btnPagedPrev") || isBtn(text, "btnPagedNext"))) {
    const latest = await getBotSession(c.env, userId);
    const paged = latest?.payload?.paged as { kind: PagedListKind; page0: number; total: number } | undefined;
    if (paged && paged.total > 1) {
      const delta = isBtn(text, "btnPagedPrev") ? -1 : 1;
      const next0 = Math.max(0, Math.min(paged.total - 1, paged.page0 + delta));
      await sendPagedList({
        env: c.env,
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        userId,
        language,
        isAdmin,
        session: latest,
        kind: paged.kind,
        replyKeyboard: defaultReplyKeyboardForListKind(paged.kind, language),
        page0: next0
      });
      return c.json({ ok: true });
    }
  }

  if (canAutoAddWalletFromMessage(session)) {
    const candidates = detectAddressNetworks(text) as WalletNetwork[];
    if (candidates.length === 1) {
      await setBotSession(c.env, userId, {
        flow: "wallet:add:label",
        payload: { network: candidates[0], address: text }
      });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletLabel"), sectionKeyboard(language));
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
    await setBotSession(c.env, userId, {
      flow: "wallet:add:label",
      payload: { network, address: text }
    });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletLabel"), sectionKeyboard(language));
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
    await setBotSession(c.env, userId, {
      flow: "wallet:add:label",
      payload: { network, address }
    });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletLabel"), sectionKeyboard(language));
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
        mainKeyboard(language, isAdmin, hasBotAccess)
      );
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, {
      flow: "wallet:add:label",
      payload: { network, address: text }
    });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletLabel"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "wallet:add:label") {
    const network = session.payload?.network as WalletNetwork | undefined;
    const address = session.payload?.address as string | undefined;
    if (!network || !address) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "unknown"),
        mainKeyboard(language, isAdmin, hasBotAccess)
      );
      return c.json({ ok: true });
    }
    const normalizedLabel = text.trim();
    const label =
      normalizedLabel === "-" || normalizedLabel.toLowerCase() === "skip" || normalizedLabel.toLowerCase() === "пропустить"
        ? undefined
        : normalizedLabel;
    try {
      await createWallet(c.env, userId, { network, address, label });
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
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "unknown"), mainKeyboard(language, isAdmin, hasBotAccess));
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
        mainKeyboard(language, isAdmin, hasBotAccess)
      );
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "contact:add:label", payload: { network, address: text } });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactLabel"), sectionKeyboard(language, "contacts"));
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:auto-address") {
    const candidates = detectAddressNetworks(text);
    if (candidates.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidAddress"), sectionKeyboard(language, "contacts"));
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
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactLabel"), sectionKeyboard(language, "contacts"));
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
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactLabel"), sectionKeyboard(language, "contacts"));
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
        mainKeyboard(language, isAdmin, hasBotAccess)
      );
      return c.json({ ok: true });
    }
    try {
      await createContact(c.env, userId, { network, address, label: text });
      await setBotSession(c.env, userId, { flow: "section:contacts" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactAdded"), sectionKeyboard(language, "contacts"));
    } catch (error) {
      const messageText = mapCreateError(language, error, "contact");
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, messageText, sectionKeyboard(language, "contacts"));
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:delete:pick") {
    const ids = (session.payload?.ids as string[] | undefined) ?? [];
    const pick = Number.parseInt(text, 10);
    if (!Number.isInteger(pick) || pick < 1 || pick > ids.length) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "invalidNumber"), sectionKeyboard(language, "contacts"));
      return c.json({ ok: true });
    }
    await deleteContact(c.env, userId, ids[pick - 1]);
    await setBotSession(c.env, userId, { flow: "section:contacts" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactDeleted"), sectionKeyboard(language, "contacts"));
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
    const htmlText =
      `<b>${escapeHtml(t(language, "paymentInvoiceTitle"))}</b> (${escapeHtml(networkLabel)})\n\n` +
      `💵 <b>${escapeHtml(t(language, "paymentAmount"))}:</b> ${escapeHtml(invoice.amountText)} ${escapeHtml(invoice.asset)}\n` +
      `🏦 <b>${escapeHtml(t(language, "paymentAddress"))}:</b>\n<code>${escapeHtml(invoice.payAddress)}</code>\n` +
      `🕒 <b>${escapeHtml(t(language, "paymentExpiresAt"))}:</b> ${escapeHtml(formatDateForLanguage(invoice.expiresAt, language))}\n\n` +
      `ℹ️ ${escapeHtml(t(language, "paymentInstruction"))}\n` +
      `📋 ${escapeHtml(t(language, "paymentCopyHint"))}`;
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      htmlText,
      cabinetKeyboard(language),
      "HTML"
    );
    return c.json({ ok: true });
  }

  if (session?.flow === "cabinet:pay-slots:network") {
    const network = isBtn(text, "paymentNetworkBsc")
      ? "bsc"
      : isBtn(text, "paymentNetworkTrc20")
        ? "trc20"
        : null;
    if (!network) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        t(language, "slotPackPaymentChooseNetwork"),
        paymentNetworkKeyboard(language)
      );
      return c.json({ ok: true });
    }
    const invoice = await createSlotPackPaymentInvoice(c.env, userId, network);
    await setBotSession(c.env, userId, { flow: "section:cabinet" });
    const networkLabel = network === "bsc" ? t(language, "paymentNetworkBsc") : t(language, "paymentNetworkTrc20");
    const htmlText =
      `<b>${escapeHtml(t(language, "slotPackInvoiceTitle"))}</b> (${escapeHtml(networkLabel)})\n\n` +
      `💵 <b>${escapeHtml(t(language, "paymentAmount"))}:</b> ${escapeHtml(invoice.amountText)} ${escapeHtml(invoice.asset)}\n` +
      `🏦 <b>${escapeHtml(t(language, "paymentAddress"))}:</b>\n<code>${escapeHtml(invoice.payAddress)}</code>\n` +
      `🕒 <b>${escapeHtml(t(language, "paymentExpiresAt"))}:</b> ${escapeHtml(formatDateForLanguage(invoice.expiresAt, language))}\n\n` +
      `ℹ️ ${escapeHtml(t(language, "paymentInstruction"))}\n` +
      `📋 ${escapeHtml(t(language, "paymentCopyHint"))}`;
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      htmlText,
      cabinetKeyboard(language),
      "HTML"
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
      const summaryHtml = buildCabinetSummaryHtml(language, subscription);
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `✅ ${escapeHtml(t(language, "promoActivated"))}\n\n${summaryHtml}`,
        cabinetKeyboard(language),
        "HTML"
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

  if (session?.flow === "admin:promo:create" && !isAdminActionButton(text)) {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }

    const parts = text.split(/\s+/).filter(Boolean);
    const code = (parts[0] ?? "").trim();
    const durationDays = Number.parseInt(parts[1] ?? "", 10);
    const maxRaw = parts[2];
    const bonusRaw = parts[3];
    const maxActivations = maxRaw ? Number.parseInt(maxRaw, 10) : null;
    const bonusPercent = bonusRaw ? Number.parseInt(bonusRaw, 10) : 0;
    const isDurationValid = Number.isInteger(durationDays) && durationDays >= 1 && durationDays <= 3650;
    const isMaxValid = maxActivations === null || (Number.isInteger(maxActivations) && maxActivations >= 1 && maxActivations <= 100000);
    const isBonusValid = Number.isInteger(bonusPercent) && bonusPercent >= 0 && bonusPercent <= 1000;

    if (!code || !isDurationValid || !isMaxValid || !isBonusValid || parts.length > 4) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `❌ ${escapeHtml(t(language, "adminPromoInvalid"))}\n\n${buildAdminPromoGuideHtml(language)}`,
        adminKeyboard(language),
        "HTML"
      );
      return c.json({ ok: true });
    }

    try {
      await createPromoCodeEntry(c.env, {
        code,
        durationDays,
        maxActivations,
        bonusPercent,
        isActive: true
      });
      await setBotSession(c.env, userId, { flow: "section:admin" });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminPromoCreated"), adminKeyboard(language));
    } catch {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `❌ ${escapeHtml(t(language, "adminPromoInvalid"))}\n\n${buildAdminPromoGuideHtml(language)}`,
        adminKeyboard(language),
        "HTML"
      );
    }
    return c.json({ ok: true });
  }

  if (session?.flow === "admin:reputation:reset:user" && !isAdminActionButton(text)) {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
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
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    const trimmed = text.trim();
    const commandLower = trimmed.toLowerCase();

    if (commandLower === "list") {
      await sendPagedList({
        env: c.env,
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        userId,
        language,
        isAdmin: true,
        session,
        kind: "as",
        replyKeyboard: adminKeyboard(language)
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
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
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
    session = { flow: "section:wallets" };
    await showWalletsList(
      c.env,
      message.chat.id,
      userId,
      language,
      isAdmin,
      session,
      sectionKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnContacts")) {
    await setBotSession(c.env, userId, { flow: "section:contacts" });
    session = { flow: "section:contacts" };
    await showContactsList(
      c.env,
      message.chat.id,
      userId,
      language,
      isAdmin,
      session,
      sectionKeyboard(language, "contacts")
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnSettings")) {
    await setBotSession(c.env, userId, { flow: "section:settings" });
    const summaryHtml =
      `⚙️ <b>${escapeHtml(t(language, "settingsTitle"))}</b>\n\n` +
      `• <b>BTC:</b> <code>${escapeHtml(settings.btcThreshold)}</code>\n` +
      `• <b>ETH:</b> <code>${escapeHtml(settings.ethThreshold)}</code>\n` +
      `• <b>USDT:</b> <code>${escapeHtml(settings.usdtThreshold)}</code>\n` +
      `• <b>USD:</b> ${settings.showUsdEstimate ? "ON" : "OFF"}\n` +
      `• <b>Chain:</b> ${settings.blockchainNotificationsEnabled ? "ON" : "OFF"}\n` +
      `• <b>Service:</b> ${settings.serviceNotificationsEnabled ? "ON" : "OFF"}`;
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      summaryHtml,
      settingsKeyboard(language),
      "HTML"
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnCabinet")) {
    await setBotSession(c.env, userId, { flow: "section:cabinet" });
    const subscription = await getSubscriptionInfo(c.env, userId);
    const summaryHtml = buildCabinetSummaryHtml(language, subscription);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      summaryHtml,
      cabinetKeyboard(language),
      "HTML"
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
      mainKeyboard(language, isAdmin, hasBotAccess)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminPanel")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "section:admin" });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `🛡️ <b>${escapeHtml(t(language, "adminPanelTitle"))}</b>\n\n${t(language, "adminSlotsHelp")}`,
      adminKeyboard(language),
      "HTML"
    );
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

  if (isBtn(text, "btnPaySlotPack")) {
    await setBotSession(c.env, userId, { flow: "cabinet:pay-slots:network" });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "slotPackPaymentChooseNetwork"),
      paymentNetworkKeyboard(language)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnCheckPayment")) {
    const result = await processSubscriptionPayments(c.env, { userId });
    const [activeSub, activeSlot] = await Promise.all([
      getActiveSubscriptionPaymentRequest(c.env, userId),
      getActiveSlotPackPaymentRequest(c.env, userId)
    ]);
    if (result.paid > 0) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        language === "ru" ? "✅ Платёж обработан." : "✅ Payment applied.",
        cabinetKeyboard(language)
      );
      return c.json({ ok: true });
    }
    if (!activeSub && !activeSlot) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "paymentCheckNoRequest"), cabinetKeyboard(language));
      return c.json({ ok: true });
    }
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "paymentCheckPending"), cabinetKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnList")) {
    const section = currentSection(session);
    if (section === "wallets") {
      await showWalletsList(
        c.env,
        message.chat.id,
        userId,
        language,
        isAdmin,
        session,
        sectionKeyboard(language)
      );
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      await sendPagedList({
        env: c.env,
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        userId,
        language,
        isAdmin,
        session,
        kind: "cl",
        replyKeyboard: sectionKeyboard(language, "contacts")
      });
      return c.json({ ok: true });
    }

    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "unknown"),
      mainKeyboard(language, isAdmin, hasBotAccess)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnBalance")) {
    const section = currentSection(session);
    if (section !== "wallets") {
      const keyboard = section === "contacts" ? sectionKeyboard(language, "contacts") : mainKeyboard(language, isAdmin, hasBotAccess);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletActionsOnly"), keyboard);
      return c.json({ ok: true });
    }
    const wallets = await listWallets(c.env, userId);
    if (wallets.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletListEmpty"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    const sessionBalance: BotSession = {
      flow: "wallet:balance:pick",
      payload: { ids: wallets.map((item) => item.id) }
    };
    await setBotSession(c.env, userId, sessionBalance);
    await sendPagedList({
      env: c.env,
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      userId,
      language,
      isAdmin,
      session: sessionBalance,
      kind: "b",
      replyKeyboard: sectionKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnHistory")) {
    const section = currentSection(session);
    if (section !== "wallets") {
      const keyboard = section === "contacts" ? sectionKeyboard(language, "contacts") : mainKeyboard(language, isAdmin, hasBotAccess);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletActionsOnly"), keyboard);
      return c.json({ ok: true });
    }
    await sendPagedList({
      env: c.env,
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      userId,
      language,
      isAdmin,
      session,
      kind: "h",
      replyKeyboard: sectionKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnRateTransfer")) {
    const section = currentSection(session);
    if (section !== "wallets") {
      const keyboard = section === "contacts" ? sectionKeyboard(language, "contacts") : mainKeyboard(language, isAdmin, hasBotAccess);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletActionsOnly"), keyboard);
      return c.json({ ok: true });
    }
    const history = await listTransferHistory(c.env, userId, 20);
    const rateable = history.filter((item) => Boolean(item.counterpartyAddress));
    if (rateable.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "transferRateNoSender"), sectionKeyboard(language));
      return c.json({ ok: true });
    }
    const sessionRate: BotSession = {
      flow: "transfer:rate:pick",
      payload: { ids: rateable.map((item) => item.id) }
    };
    await setBotSession(c.env, userId, sessionRate);
    await sendPagedList({
      env: c.env,
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      userId,
      language,
      isAdmin,
      session: sessionRate,
      kind: "rt",
      replyKeyboard: sectionKeyboard(language)
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
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactAddress"), sectionKeyboard(language, "contacts"));
      return c.json({ ok: true });
    }
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "unknown"),
      mainKeyboard(language, isAdmin, hasBotAccess)
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
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askContactAddress"), sectionKeyboard(language, "contacts"));
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
      const sessionDel: BotSession = { flow: "wallet:delete:pick", payload: { ids: wallets.map((item) => item.id) } };
      await setBotSession(c.env, userId, sessionDel);
      await sendPagedList({
        env: c.env,
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        userId,
        language,
        isAdmin,
        session: sessionDel,
        kind: "dw",
        replyKeyboard: sectionKeyboard(language)
      });
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      const contacts = await listContacts(c.env, userId);
      if (contacts.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsDeleteEmpty"), sectionKeyboard(language, "contacts"));
        return c.json({ ok: true });
      }
      const sessionDelC: BotSession = { flow: "contact:delete:pick", payload: { ids: contacts.map((item) => item.id) } };
      await setBotSession(c.env, userId, sessionDelC);
      await sendPagedList({
        env: c.env,
        token: c.env.TELEGRAM_BOT_TOKEN,
        chatId: message.chat.id,
        userId,
        language,
        isAdmin,
        session: sessionDelC,
        kind: "dc",
        replyKeyboard: sectionKeyboard(language, "contacts")
      });
      return c.json({ ok: true });
    }
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "unknown"),
      mainKeyboard(language, isAdmin, hasBotAccess)
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

  if (isBtn(text, "btnAdminStats")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    const stats = await getAdminDashboardStats(c.env);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      buildAdminStatsHtml(language, stats),
      adminKeyboard(language),
      "HTML"
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminReputation")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    await sendPagedList({
      env: c.env,
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      userId,
      language,
      isAdmin: true,
      session,
      kind: "ar",
      replyKeyboard: adminKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminResetReputation")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "admin:reputation:reset:user" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminResetAsk"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminStopWallets")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "admin:stop:manage" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminStopHelp"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminLinks")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    await sendPagedList({
      env: c.env,
      token: c.env.TELEGRAM_BOT_TOKEN,
      chatId: message.chat.id,
      userId,
      language,
      isAdmin: true,
      session,
      kind: "al",
      replyKeyboard: adminKeyboard(language)
    });
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnAdminCreatePromo")) {
    if (!isAdmin) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin, hasBotAccess));
      return c.json({ ok: true });
    }
    await setBotSession(c.env, userId, { flow: "admin:promo:create" });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      buildAdminPromoGuideHtml(language),
      adminKeyboard(language),
      "HTML"
    );
    return c.json({ ok: true });
  }

  await sendTelegramMessage(
    c.env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    t(language, "unknown"),
    mainKeyboard(language, isAdmin, hasBotAccess)
  );
  return c.json({ ok: true });
});

export default bot;
