import { Hono } from "hono";
import type { Env } from "../types/env";
import {
  addStoppedWallet,
  clearBotSession,
  createContact,
  createWallet,
  deleteContact,
  deleteWallet,
  getBotSession,
  getUserReputation,
  getSettings,
  listLinkAuditEntries,
  listStoppedWallets,
  listTopReputations,
  listTransferHistory,
  listContacts,
  listWallets,
  resetUserReputation,
  removeStoppedWallet,
  setBotSession,
  updateSettings
} from "../lib/db";
import { getWalletBalances } from "../lib/wallet-insights";
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
    walletsTitle: "Мои кошельки",
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
    enterNumeric: "Введите число, например 0.01",
    settingsSaved: "Настройки сохранены.",
    testNotification: "Тестовое уведомление: бот подключен.",
    walletBalancesPick: "Выберите номер кошелька для просмотра баланса.",
    walletBalanceError: "Не удалось получить баланс. Попробуйте позже.",
    transferHistoryEmpty: "История переводов пока пуста.",
    transferHistoryTitle: "История переводов",
    reputationTitle: "Репутация",
    reputationValue: "Ваш текущий рейтинг: {score}",
    adminPanelTitle: "Админ панель",
    adminOnly: "Эта команда доступна только администратору.",
    adminReputationEmpty: "В таблице репутации пока нет пользователей.",
    adminReputationTitle: "Топ репутации",
    adminResetAsk: "Введите Telegram user id для обнуления репутации.",
    adminResetDone: "Репутация пользователя обнулена.",
    adminStopHelp:
      "Управление стоп-кошельками:\nlist\nadd <NETWORK> <ADDRESS>\ndel <NETWORK> <ADDRESS>",
    adminStopAdded: "Кошелек добавлен в стоп-лист.",
    adminStopRemoved: "Кошелек удален из стоп-листа.",
    adminStopNotFound: "Кошелек не найден в стоп-листе.",
    adminStopEmpty: "Стоп-лист пуст.",
    adminStopListTitle: "Стоп-кошельки",
    adminStopInvalidCommand: "Неверная команда. Используйте list/add/del.",
    adminLinksEmpty: "Лог ссылок пока пуст.",
    adminLinksTitle: "Кто какие ссылки добавлял",
    btnWallets: "Мои кошельки",
    btnContacts: "Знакомые кошельки",
    btnSettings: "Настройки",
    btnReputation: "Моя репутация",
    btnList: "Список",
    btnAdd: "Добавить",
    btnDelete: "Удалить",
    btnBalance: "Баланс",
    btnHistory: "История",
    btnBack: "Назад",
    btnMainMenu: "Главное меню",
    btnLangRu: "Язык: Русский",
    btnLangEn: "Language: English",
    btnToggleUsd: "USD оценка ON/OFF",
    btnToggleChain: "Уведомления по блокчейну ON/OFF",
    btnToggleService: "Сервисные уведомления ON/OFF",
    btnSetBtc: "Порог BTC",
    btnSetEth: "Порог ETH",
    btnSetUsdt: "Порог USDT",
    btnTest: "Тестовое уведомление",
    btnAdminPanel: "Админ панель",
    btnAdminReputation: "Топ репутации",
    btnAdminResetReputation: "Обнулить репутацию",
    btnAdminStopWallets: "Стоп-кошельки",
    btnAdminLinks: "Логи ссылок",
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
    enterNumeric: "Enter a number, for example 0.01",
    settingsSaved: "Settings saved.",
    testNotification: "Test notification: bot is connected.",
    walletBalancesPick: "Send wallet number to view balance.",
    walletBalanceError: "Unable to fetch balance. Please try again later.",
    transferHistoryEmpty: "Transfer history is empty.",
    transferHistoryTitle: "Transfer history",
    reputationTitle: "Reputation",
    reputationValue: "Your current score: {score}",
    adminPanelTitle: "Admin panel",
    adminOnly: "This command is available only for admins.",
    adminReputationEmpty: "Reputation table is empty.",
    adminReputationTitle: "Top reputation",
    adminResetAsk: "Send Telegram user id to reset reputation.",
    adminResetDone: "User reputation reset.",
    adminStopHelp:
      "Stop-wallet management:\nlist\nadd <NETWORK> <ADDRESS>\ndel <NETWORK> <ADDRESS>",
    adminStopAdded: "Wallet added to stop list.",
    adminStopRemoved: "Wallet removed from stop list.",
    adminStopNotFound: "Wallet was not found in stop list.",
    adminStopEmpty: "Stop list is empty.",
    adminStopListTitle: "Stop wallets",
    adminStopInvalidCommand: "Invalid command. Use list/add/del.",
    adminLinksEmpty: "Link log is empty.",
    adminLinksTitle: "Who added which links",
    btnWallets: "My wallets",
    btnContacts: "Known wallets",
    btnSettings: "Settings",
    btnReputation: "My reputation",
    btnList: "List",
    btnAdd: "Add",
    btnDelete: "Delete",
    btnBalance: "Balance",
    btnHistory: "History",
    btnBack: "Back",
    btnMainMenu: "Main menu",
    btnLangRu: "Язык: Русский",
    btnLangEn: "Language: English",
    btnToggleUsd: "USD estimate ON/OFF",
    btnToggleChain: "Blockchain notifications ON/OFF",
    btnToggleService: "Service notifications ON/OFF",
    btnSetBtc: "BTC threshold",
    btnSetEth: "ETH threshold",
    btnSetUsdt: "USDT threshold",
    btnTest: "Test notification",
    btnAdminPanel: "Admin panel",
    btnAdminReputation: "Top reputation",
    btnAdminResetReputation: "Reset reputation",
    btnAdminStopWallets: "Stop wallets",
    btnAdminLinks: "Links log",
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

function mainKeyboard(language: Language, isAdmin = false): ReplyMarkup {
  const keyboard: string[][] = [
    [t(language, "btnWallets"), t(language, "btnContacts")],
    [t(language, "btnSettings"), t(language, "btnReputation")]
  ];
  if (isAdmin) {
    keyboard.push([t(language, "btnAdminPanel")]);
  }
  return {
    keyboard,
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
    keyboard: [["BTC", "ETH", "BSC", "TRC20"], [t(language, "btnBack"), t(language, "btnMainMenu")]],
    resize_keyboard: true
  };
}

function networkLabel(network: WalletNetwork): "BTC" | "ETH" | "BSC" | "TRC20" {
  if (network === "trc20") {
    return "TRC20";
  }
  return network.toUpperCase() as "BTC" | "ETH" | "BSC";
}

function parseNetworkLabel(value: string): WalletNetwork | null {
  if (value === "BTC") {
    return "btc";
  }
  if (value === "ETH") {
    return "eth";
  }
  if (value === "BSC") {
    return "bsc";
  }
  if (value === "TRC20") {
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
      [t(language, "btnAdminReputation"), t(language, "btnAdminResetReputation")],
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
  const isAdmin = isAdminUser(c.env, userId);
  let settings = await getSettings(c.env, userId);
  const language = settings.language;
  const session = await getBotSession(c.env, userId);

  if (!text || text === "/start" || text === "/menu") {
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "greet")}\n\n${t(language, "mainMenu")}`,
      mainKeyboard(language, isAdmin)
    );
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnMainMenu") || isBtn(text, "btnBack")) {
    await clearBotSession(c.env, userId);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      t(language, "mainMenu"),
      mainKeyboard(language, isAdmin)
    );
    return c.json({ ok: true });
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
      const messageText = (error as Error).message.includes("Invalid") ? t(language, "invalidAddress") : (error as Error).message;
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
      const messageText = (error as Error).message.includes("Invalid") ? t(language, "invalidAddress") : (error as Error).message;
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
      const messageText = (error as Error).message.includes("Invalid") ? t(language, "invalidAddress") : (error as Error).message;
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
      const balances = await getWalletBalances(c.env, wallet);
      const body = balances.length
        ? balances.map((item) => `• ${item.asset}: ${item.amount}`).join("\n")
        : language === "ru"
          ? "Нет доступных активов для отображения."
          : "No assets are enabled for this wallet.";
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `[${wallet.network.toUpperCase()}] ${maskAddress(wallet.address)}\n${body}`,
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
      const messageText = (error as Error).message.includes("Invalid") ? t(language, "invalidAddress") : (error as Error).message;
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

  if (session?.flow === "admin:reputation:reset:user") {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    await resetUserReputation(c.env, text);
    await setBotSession(c.env, userId, { flow: "section:admin" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminResetDone"), adminKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "admin:stop:manage") {
    if (!isAdmin) {
      await clearBotSession(c.env, userId);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminOnly"), mainKeyboard(language, isAdmin));
      return c.json({ ok: true });
    }
    const [command, networkRaw, ...rest] = text.split(/\s+/);
    const commandLower = (command ?? "").toLowerCase();

    if (commandLower === "list") {
      const stopped = await listStoppedWallets(c.env);
      if (stopped.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminStopEmpty"), adminKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = stopped.map(
        (item, index) =>
          `${index + 1}. [${item.network.toUpperCase()}] ${maskAddress(item.address)} by ${item.addedByUserId}`
      );
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        `${t(language, "adminStopListTitle")}:\n${lines.join("\n")}`,
        adminKeyboard(language)
      );
      return c.json({ ok: true });
    }

    if ((commandLower === "add" || commandLower === "del") && networkRaw && rest.length > 0) {
      const networkCandidate = networkRaw.toLowerCase();
      if (
        networkCandidate !== "btc" &&
        networkCandidate !== "eth" &&
        networkCandidate !== "bsc" &&
        networkCandidate !== "trc20"
      ) {
        await sendTelegramMessage(
          c.env.TELEGRAM_BOT_TOKEN,
          message.chat.id,
          t(language, "adminStopInvalidCommand"),
          adminKeyboard(language)
        );
        return c.json({ ok: true });
      }
      const network = networkCandidate;
      const address = rest.join(" ").trim();
      try {
        if (commandLower === "add") {
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
      return c.json({ ok: true });
    }

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
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletsTitle"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnContacts")) {
    await setBotSession(c.env, userId, { flow: "section:contacts" });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsTitle"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (isBtn(text, "btnSettings")) {
    await clearBotSession(c.env, userId);
    const summary =
      `${t(language, "settingsTitle")}\n` +
      `BTC: ${settings.btcThreshold}\nETH: ${settings.ethThreshold}\nUSDT: ${settings.usdtThreshold}\n` +
      `USD: ${settings.showUsdEstimate ? "ON" : "OFF"}\n` +
      `Chain: ${settings.blockchainNotificationsEnabled ? "ON" : "OFF"}\n` +
      `Service: ${settings.serviceNotificationsEnabled ? "ON" : "OFF"}`;
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, summary, settingsKeyboard(language));
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

  if (isBtn(text, "btnList")) {
    const section = currentSection(session);
    if (section === "wallets") {
      const wallets = await listWallets(c.env, userId);
      if (wallets.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "walletListEmpty"), sectionKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = wallets.map((item, index) => `${index + 1}. [${item.network.toUpperCase()}] ${maskAddress(item.address)}`);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, `${t(language, "walletsTitle")}:\n${lines.join("\n")}`, sectionKeyboard(language));
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      const contacts = await listContacts(c.env, userId);
      if (contacts.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsListEmpty"), sectionKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = contacts.map((item, index) => `${index + 1}. [${item.network.toUpperCase()}] ${item.label} - ${maskAddress(item.address)}`);
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, `${t(language, "contactsTitle")}:\n${lines.join("\n")}`, sectionKeyboard(language));
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
    const lines = wallets.map((item, index) => `${index + 1}. [${item.network.toUpperCase()}] ${maskAddress(item.address)}`);
    await setBotSession(c.env, userId, { flow: "wallet:balance:pick", payload: { ids: wallets.map((item) => item.id) } });
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "walletBalancesPick")}\n${lines.join("\n")}`,
      sectionKeyboard(language)
    );
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
    const lines = history.map(
      (item, index) =>
        `${index + 1}. [${item.network.toUpperCase()}] ${item.amount} ${item.asset} · ${maskTxid(item.txid)}`
    );
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "transferHistoryTitle")}:\n${lines.join("\n")}`,
      sectionKeyboard(language)
    );
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

  if (session?.flow === "wallet:add:network" && (text === "BTC" || text === "ETH" || text === "BSC" || text === "TRC20")) {
    const network = text === "TRC20" ? "trc20" : text.toLowerCase();
    await setBotSession(c.env, userId, { flow: "wallet:add:address", payload: { network } });
    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "askWalletAddress"), sectionKeyboard(language));
    return c.json({ ok: true });
  }

  if (session?.flow === "contact:add:network" && (text === "BTC" || text === "ETH" || text === "BSC" || text === "TRC20")) {
    const network = text === "TRC20" ? "trc20" : text.toLowerCase();
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
      const lines = wallets.map((item, index) => `${index + 1}. [${item.network.toUpperCase()}] ${maskAddress(item.address)}`);
      await setBotSession(c.env, userId, { flow: "wallet:delete:pick", payload: { ids: wallets.map((item) => item.id) } });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, `${t(language, "walletDeletePick")}\n${lines.join("\n")}`, sectionKeyboard(language));
      return c.json({ ok: true });
    }
    if (section === "contacts") {
      const contacts = await listContacts(c.env, userId);
      if (contacts.length === 0) {
        await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "contactsDeleteEmpty"), sectionKeyboard(language));
        return c.json({ ok: true });
      }
      const lines = contacts.map((item, index) => `${index + 1}. [${item.network.toUpperCase()}] ${item.label} - ${maskAddress(item.address)}`);
      await setBotSession(c.env, userId, { flow: "contact:delete:pick", payload: { ids: contacts.map((item) => item.id) } });
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, `${t(language, "contactDeletePick")}\n${lines.join("\n")}`, sectionKeyboard(language));
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
    const top = await listTopReputations(c.env, 20);
    if (top.length === 0) {
      await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, message.chat.id, t(language, "adminReputationEmpty"), adminKeyboard(language));
      return c.json({ ok: true });
    }
    const lines = top.map((item, index) => `${index + 1}. ${item.userId} — ${item.score}`);
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "adminReputationTitle")}:\n${lines.join("\n")}`,
      adminKeyboard(language)
    );
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
        `${index + 1}. ${item.actorUserId} · ${item.entityType} · [${item.network.toUpperCase()}] ${maskAddress(item.address)}${item.label ? ` (${item.label})` : ""}`
    );
    await sendTelegramMessage(
      c.env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `${t(language, "adminLinksTitle")}:\n${lines.join("\n")}`,
      adminKeyboard(language)
    );
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
