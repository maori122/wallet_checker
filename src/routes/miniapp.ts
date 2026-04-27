import { Hono } from "hono";
import type { Env } from "../types/env";

const miniapp = new Hono<{ Bindings: Env }>();

function pageHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>VOROBEY: Track · Mini App</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
      :root { --bg:#0f1116; --card:#171a23; --muted:#8f96a8; --text:#e8ecf7; --line:#2a3142; --btn:#4f7cff; --ok:#2ecc71; --bad:#ff5f7a; }
      * { box-sizing: border-box; }
      body { margin:0; padding:0; background:var(--bg); color:var(--text); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
      .wrap { max-width: 920px; margin: 0 auto; padding: 14px; }
      .head { position: sticky; top:0; z-index:8; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); padding: 10px 0 12px; border-bottom: 1px solid var(--line); }
      .title { font-size: 22px; font-weight: 800; }
      .sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
      .stats { margin-top: 10px; display:flex; gap: 8px; }
      .stat { flex:1; background: var(--card); border:1px solid var(--line); border-radius: 12px; padding:8px 10px; }
      .stat .k { color:var(--muted); font-size:11px; text-transform: uppercase; }
      .stat .v { font-weight: 700; margin-top: 2px; }
      .tabs { margin-top: 12px; display:grid; grid-template-columns: repeat(3,1fr); gap: 6px; }
      .tab { border:1px solid var(--line); background: var(--card); color: var(--muted); border-radius: 10px; padding: 9px 8px; font-size: 13px; font-weight: 700; text-align:center; cursor:pointer; }
      .tab.active { color: var(--text); border-color: color-mix(in srgb, var(--btn) 60%, var(--line)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--btn) 35%, transparent) inset; }
      .panel { display:none; padding-top: 12px; }
      .panel.active { display:block; }
      .card { background: var(--card); border:1px solid var(--line); border-radius: 14px; padding: 12px; margin-bottom: 10px; box-shadow: 0 10px 26px rgba(0,0,0,.18); }
      .card h3 { margin: 0 0 10px; font-size: 15px; }
      .grid { display:grid; gap: 8px; }
      .row { display:grid; gap: 6px; }
      label { font-size: 12px; color: var(--muted); }
      input, select, textarea { width:100%; border:1px solid var(--line); background:#111521; color:var(--text); border-radius: 10px; min-height: 40px; padding: 9px 10px; font-size: 14px; }
      textarea { min-height: 78px; resize: vertical; }
      .btn { border:0; border-radius: 10px; min-height: 40px; padding: 8px 11px; font-size: 14px; font-weight: 700; cursor:pointer; transition: transform .08s ease, opacity .15s ease; }
      .btn:active { transform: translateY(1px); opacity: .92; }
      .btn.primary { background: var(--btn); color: white; }
      .btn.ghost { background: transparent; border:1px solid var(--line); color: var(--text); }
      .btn.bad { background: color-mix(in srgb, var(--bad) 20%, transparent); border:1px solid color-mix(in srgb, var(--bad) 45%, transparent); color: #ffb9c6; }
      .btn.ok { background: color-mix(in srgb, var(--ok) 20%, transparent); border:1px solid color-mix(in srgb, var(--ok) 45%, transparent); color: #b9f7d4; }
      .btns { display:flex; gap: 8px; flex-wrap: wrap; }
      .item { border-top: 1px solid var(--line); padding: 10px 0; }
      .item:first-child { border-top: 0; padding-top: 0; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; user-select: all; }
      .muted { color: var(--muted); font-size: 12px; }
      .toast { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: #131826; color: var(--text); border:1px solid var(--line); padding: 10px 12px; border-radius: 10px; display:none; z-index: 20; max-width: calc(100% - 20px); }
      .hidden { display:none !important; }
      .address-line { margin-top: 6px; display:flex; align-items:flex-start; gap: 8px; flex-wrap: wrap; }
      .addr-pill { display:inline-block; background: #111521; border:1px solid var(--line); border-radius: 10px; padding: 8px 10px; }
      .copy-btn { min-height: 34px; padding: 6px 10px; font-size: 12px; border-radius: 9px; }
      .copy-block { margin-top: 8px; display:grid; gap: 6px; }
    </style>
  </head>
  <body>
    <div id="toast" class="toast"></div>
    <div class="wrap">
      <div class="head">
        <div id="app-title" class="title">VOROBEY: Track</div>
        <div id="app-subtitle" class="sub">Private tracking of crypto wallet transactions</div>
        <div class="stats">
          <div class="stat"><div id="stat-wallets-label" class="k">Wallets</div><div id="stat-wallets" class="v">0 / 10</div></div>
          <div class="stat"><div id="stat-contacts-label" class="k">Contacts</div><div id="stat-contacts" class="v">0 / 50</div></div>
          <div class="stat"><div id="stat-role-label" class="k">Role</div><div id="stat-role" class="v">User</div></div>
        </div>
        <div class="tabs" id="tabs">
          <div id="tab-wallets" class="tab active" data-tab="wallets">Wallets</div>
          <div id="tab-contacts" class="tab" data-tab="contacts">Contacts</div>
          <div id="tab-history" class="tab" data-tab="history">History</div>
          <div id="tab-cabinet" class="tab" data-tab="cabinet">Cabinet</div>
          <div id="tab-settings" class="tab" data-tab="settings">Settings</div>
          <div class="tab hidden" data-tab="admin" id="admin-tab">Admin</div>
        </div>
      </div>

      <section id="wallets" class="panel active">
        <div class="card">
          <h3 id="wallet-add-title">Add tracked wallet</h3>
          <div class="grid">
            <div class="row">
              <label id="wallet-network-label">Network</label>
              <select id="wallet-network">
                <option value="auto">Auto</option>
                <option value="btc">BTC</option>
                <option value="eth">ETH</option>
                <option value="bsc">BEP20</option>
                <option value="trc20">TRC20</option>
              </select>
            </div>
            <div class="row"><label id="wallet-address-label">Address</label><input id="wallet-address" placeholder="0x... / bc1... / T..." /></div>
            <div class="row"><label id="wallet-label-label">Label</label><input id="wallet-label" placeholder="Pasha / Main wallet / Salary" /></div>
            <div class="btns"><button class="btn primary" id="wallet-add">Add wallet</button></div>
          </div>
        </div>
        <div class="card">
          <h3 id="wallet-list-title">Tracked wallets</h3>
          <div id="wallet-list"></div>
        </div>
      </section>

      <section id="contacts" class="panel">
        <div class="card">
          <h3 id="contact-add-title">Add known wallet</h3>
          <div class="grid">
            <div class="row">
              <label id="contact-network-label">Network</label>
              <select id="contact-network">
                <option value="auto">Auto</option>
                <option value="btc">BTC</option>
                <option value="eth">ETH</option>
                <option value="bsc">BEP20</option>
                <option value="trc20">TRC20</option>
              </select>
            </div>
            <div class="row"><label id="contact-address-label">Address</label><input id="contact-address" placeholder="Address" /></div>
            <div class="row"><label id="contact-label-label">Label</label><input id="contact-label" placeholder="Label" /></div>
            <div class="btns"><button class="btn primary" id="contact-add">Add contact</button></div>
          </div>
        </div>
        <div class="card"><h3 id="contact-list-title">Known wallets</h3><div id="contact-list"></div></div>
      </section>

      <section id="history" class="panel">
        <div class="card"><h3 id="history-title">Transfer history</h3><div id="history-list"></div></div>
      </section>

      <section id="cabinet" class="panel">
        <div class="card"><h3 id="cabinet-subscription-title">Subscription</h3><div id="cabinet-subscription"></div></div>
        <div class="card">
          <h3 id="payment-title">Payment</h3>
          <div class="grid">
            <div class="row"><label id="pay-network-label">Network</label><select id="pay-network"><option value="bsc">USDT BEP20</option><option value="trc20">USDT TRC20</option></select></div>
            <div class="btns">
              <button class="btn primary" id="pay-create">Create invoice</button>
              <button class="btn ok" id="pay-check">Check payment</button>
            </div>
            <h4 id="slot-pack-heading" style="margin:0.75rem 0 0">+10 slots</h4>
            <div class="row"><label id="pay-slots-network-label">Network</label><select id="pay-slots-network"><option value="bsc">USDT BEP20</option><option value="trc20">USDT TRC20</option></select></div>
            <div class="btns"><button class="btn primary" id="pay-slots-create" type="button">Create</button></div>
            <div id="pay-info" class="muted"></div>
          </div>
        </div>
        <div class="card">
          <h3 id="promo-title">Promo code</h3>
          <div class="grid">
            <div class="row"><label id="promo-code-label">Code</label><input id="promo-code" placeholder="PROMO2026" /></div>
            <div class="btns"><button class="btn primary" id="promo-activate">Activate promo</button></div>
          </div>
        </div>
      </section>

      <section id="settings" class="panel">
        <div class="card">
          <h3 id="settings-title">Settings</h3>
          <div class="grid">
            <div class="row"><label id="settings-lang-label">Language</label><select id="set-lang"><option value="ru">RU</option><option value="en">EN</option></select></div>
            <div class="row"><label id="settings-btc-label">BTC threshold</label><input id="set-btc" /></div>
            <div class="row"><label id="settings-eth-label">ETH threshold</label><input id="set-eth" /></div>
            <div class="row"><label id="settings-usdt-label">USDT threshold</label><input id="set-usdt" /></div>
            <div class="btns"><button class="btn primary" id="settings-save">Save settings</button></div>
          </div>
        </div>
      </section>

      <section id="admin" class="panel hidden">
        <div class="card">
          <h3 id="admin-promo-create-title">Generate promo code</h3>
          <div class="grid">
            <div class="row"><label id="admin-promo-code-label">Code</label><input id="admin-promo-code" placeholder="SPRING2026" /></div>
            <div class="row"><label id="admin-promo-days-label">Duration days</label><input id="admin-promo-days" type="number" value="30" /></div>
            <div class="row"><label id="admin-promo-max-label">Max activations</label><input id="admin-promo-max" type="number" placeholder="Optional" /></div>
            <div class="row"><label id="admin-promo-percent-label">Bonus percent (e.g. 20 = +20% days)</label><input id="admin-promo-percent" type="number" value="0" /></div>
            <div class="btns"><button class="btn primary" id="admin-promo-create">Create promo</button></div>
          </div>
        </div>
        <div class="card"><h3 id="admin-promo-list-title">Promo codes</h3><div id="admin-promo-list"></div></div>
        <div class="card">
          <h3 id="admin-stop-title">Stop wallets</h3>
          <div class="grid">
            <div class="row"><label id="admin-stop-network-label">Network</label><select id="admin-stop-network"><option value="btc">BTC</option><option value="eth">ETH</option><option value="bsc">BEP20</option><option value="trc20">TRC20</option></select></div>
            <div class="row"><label id="admin-stop-address-label">Address</label><input id="admin-stop-address" placeholder="Address" /></div>
            <div class="btns">
              <button class="btn primary" id="admin-stop-add">Add to stop list</button>
              <button class="btn bad" id="admin-stop-remove-btn">Remove from stop list</button>
            </div>
          </div>
          <div id="admin-stop-list"></div>
        </div>
        <div class="card"><h3 id="admin-link-title">Link audit</h3><div id="admin-link-list"></div></div>
        <div class="card"><h3 id="admin-reputation-title">Wallet reputation</h3><div id="admin-reputation-list"></div></div>
        <div class="card">
          <h3 id="admin-slots-title">User slot bonuses</h3>
          <div class="grid">
            <div class="row"><label id="admin-slots-user-label">Telegram user id</label><input id="admin-slots-user" inputmode="numeric" placeholder="123456789" /></div>
            <div class="row"><label id="admin-slots-w-label">+Wallet slots</label><input id="admin-slots-w" type="number" min="0" value="0" /></div>
            <div class="row"><label id="admin-slots-c-label">+Contact slots</label><input id="admin-slots-c" type="number" min="0" value="0" /></div>
            <div class="btns"><button class="btn primary" id="admin-slots-apply" type="button">Apply</button></div>
          </div>
        </div>
      </section>
    </div>

    <script>
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const initData = tg?.initData || "";
      const tgLanguageCode = String(tg?.initDataUnsafe?.user?.language_code || "").toLowerCase();
      const initialLang = tgLanguageCode.startsWith("ru") ? "ru" : "en";

      const state = { me: null, wallets: [], contacts: [], history: [], subscription: null, payment: null, activeSlotPack: null, summary: null, lang: initialLang };
      const $ = (id) => document.getElementById(id);
      const L10N = {
        ru: {
          appTitle: "VOROBEY: Track",
          subtitle: "Приватный трекинг транзакций криптокошельков",
          wallets: "Кошельки",
          contacts: "Контакты",
          role: "Роль",
          tabWallets: "Кошельки",
          tabContacts: "Контакты",
          tabHistory: "История",
          tabCabinet: "Кабинет",
          tabSettings: "Настройки",
          tabAdmin: "Админ",
          walletAddTitle: "Добавить отслеживаемый кошелек",
          address: "Адрес",
          label: "Метка",
          addWallet: "Добавить кошелек",
          trackedWallets: "Отслеживаемые кошельки",
          addKnownWallet: "Добавить знакомый кошелек",
          label: "Метка",
          addContact: "Добавить контакт",
          knownWallets: "Знакомые кошельки",
          transferHistory: "История переводов",
          subscription: "Подписка",
          payment: "Оплата",
          network: "Сеть",
          createInvoice: "Создать счет",
          checkPayment: "Проверить оплату",
          slotPackHeading: "+10 слотов (10 USDT)",
          slotPackCreate: "Счёт +10 слотов",
          pendingSubInvoice: "Подписка",
          pendingSlotInvoice: "Пакет +10 слотов",
          adminSlotsTitle: "Доп. слоты пользователю",
          adminSlotsUser: "Telegram user id",
          adminSlotsW: "+Слоты кошельков",
          adminSlotsC: "+Слоты контактов",
          adminSlotsApply: "Начислить",
          adminSlotsOk: "Слоты обновлены.",
          promoCode: "Промокод",
          activatePromo: "Активировать промокод",
          settings: "Настройки",
          language: "Язык",
          btcThreshold: "Порог BTC",
          ethThreshold: "Порог ETH",
          usdtThreshold: "Порог USDT",
          saveSettings: "Сохранить настройки",
          generatePromoCode: "Создать промокод",
          durationDays: "Длительность в днях",
          maxActivations: "Макс. активаций",
          bonusPercent: "+% к дням: при базе 30 и 20 → 36. Не от суммы оплаты",
          createPromo: "Создать промокод",
          promoCodes: "Промокоды",
          stopWallets: "Стоп-кошельки",
          addToStopList: "Добавить в стоп-лист",
          removeFromStopList: "Удалить из стоп-листа",
          linkAudit: "Лог ссылок",
          walletReputation: "Репутация кошельков",
          roleAdmin: "Админ",
          roleUser: "Пользователь",
          noWallets: "Пока нет кошельков.",
          noContacts: "Пока нет контактов.",
          noTransfers: "Пока нет переводов.",
          copy: "Копировать",
          assets: "Активы",
          balance: "Баланс",
          delete: "Удалить",
          plan: "План",
          status: "Статус",
          validUntil: "Действует до",
          promoActivations: "Активаций промокодов",
          pendingInvoice: "Активный счет",
          expires: "Истекает",
          noActiveInvoice: "Нет активного счета.",
          copyAddress: "Копировать адрес",
          active: "активен",
          disabled: "выключен",
          uses: "использовано",
          enable: "Включить",
          disable: "Выключить",
          noStopWallets: "Стоп-кошельков нет.",
          noLinkLogs: "Логи ссылок отсутствуют.",
          score: "рейтинг",
          userLabel: "пользователь",
          walletAdded: "Кошелек добавлен.",
          contactAdded: "Контакт добавлен.",
          settingsSaved: "Настройки сохранены.",
          invoiceCreated: "Счет создан.",
          paymentConfirmed: "Оплата подтверждена.",
          paymentNotFound: "Платеж пока не найден.",
          promoActivatedOk: "Промокод активирован.",
          promoCreatedOk: "Промокод создан.",
          addedStopOk: "Добавлено в стоп-лист.",
          removedStopOk: "Удалено из стоп-листа.",
          walletDeleted: "Кошелек удален.",
          contactDeleted: "Контакт удален.",
          promoStateUpdated: "Статус промокода обновлен.",
          detectFailed: "Не удалось определить сеть.",
          chooseNetworkForAddress: "Для этого адреса подходит несколько сетей. Выберите сеть вручную.",
          selectedNetworkMismatch: "Адрес не соответствует выбранной сети.",
          openFromTelegram: "Откройте Mini App из Telegram для авторизации.",
          accessFirst: "Сначала оплатите подписку в разделе Cabinet, затем откроется весь функционал."
        },
        en: {
          appTitle: "VOROBEY: Track",
          subtitle: "Private tracking of crypto wallet transactions",
          wallets: "Wallets",
          contacts: "Contacts",
          role: "Role",
          tabWallets: "Wallets",
          tabContacts: "Contacts",
          tabHistory: "History",
          tabCabinet: "Cabinet",
          tabSettings: "Settings",
          tabAdmin: "Admin",
          walletAddTitle: "Add tracked wallet",
          address: "Address",
          label: "Label",
          addWallet: "Add wallet",
          trackedWallets: "Tracked wallets",
          addKnownWallet: "Add known wallet",
          label: "Label",
          addContact: "Add contact",
          knownWallets: "Known wallets",
          transferHistory: "Transfer history",
          subscription: "Subscription",
          payment: "Payment",
          network: "Network",
          createInvoice: "Create invoice",
          checkPayment: "Check payment",
          slotPackHeading: "+10 slots (10 USDT)",
          slotPackCreate: "Create slot invoice",
          pendingSubInvoice: "Subscription",
          pendingSlotInvoice: "Slot pack +10",
          adminSlotsTitle: "User slot bonuses",
          adminSlotsUser: "Telegram user id",
          adminSlotsW: "+Wallet slots",
          adminSlotsC: "+Contact slots",
          adminSlotsApply: "Apply",
          adminSlotsOk: "Slot bonuses updated.",
          promoCode: "Promo code",
          activatePromo: "Activate promo",
          settings: "Settings",
          language: "Language",
          btcThreshold: "BTC threshold",
          ethThreshold: "ETH threshold",
          usdtThreshold: "USDT threshold",
          saveSettings: "Save settings",
          generatePromoCode: "Generate promo code",
          durationDays: "Duration days",
          maxActivations: "Max activations",
          bonusPercent: "+% to days: base 30 + 20% → 36. Not payment amount",
          createPromo: "Create promo",
          promoCodes: "Promo codes",
          stopWallets: "Stop wallets",
          addToStopList: "Add to stop list",
          removeFromStopList: "Remove from stop list",
          linkAudit: "Link audit",
          walletReputation: "Wallet reputation",
          roleAdmin: "Admin",
          roleUser: "User",
          noWallets: "No wallets yet.",
          noContacts: "No contacts yet.",
          noTransfers: "No transfers yet.",
          copy: "Copy",
          assets: "Assets",
          balance: "Balance",
          delete: "Delete",
          plan: "Plan",
          status: "Status",
          validUntil: "Valid until",
          promoActivations: "Promo activations",
          pendingInvoice: "Pending invoice",
          expires: "Expires",
          noActiveInvoice: "No active invoice.",
          copyAddress: "Copy address",
          active: "active",
          disabled: "disabled",
          uses: "uses",
          enable: "Enable",
          disable: "Disable",
          noStopWallets: "No stop wallets.",
          noLinkLogs: "No link logs.",
          score: "score",
          userLabel: "user",
          walletAdded: "Wallet added.",
          contactAdded: "Contact added.",
          settingsSaved: "Settings saved.",
          invoiceCreated: "Invoice created.",
          paymentConfirmed: "Payment confirmed.",
          paymentNotFound: "Payment not found yet.",
          promoActivatedOk: "Promo activated.",
          promoCreatedOk: "Promo code created.",
          addedStopOk: "Added to stop list.",
          removedStopOk: "Removed from stop list.",
          walletDeleted: "Wallet deleted.",
          contactDeleted: "Contact deleted.",
          promoStateUpdated: "Promo state updated.",
          detectFailed: "Could not detect network.",
          chooseNetworkForAddress: "This address matches multiple networks. Choose network manually.",
          selectedNetworkMismatch: "Address does not match selected network.",
          openFromTelegram: "Open from Telegram to authorize.",
          accessFirst: "Pay subscription in Cabinet first, then full functionality will unlock."
        }
      };
      function tr(key) {
        return (L10N[state.lang] && L10N[state.lang][key]) || L10N.en[key] || key;
      }
      function msg(ru, en) {
        return state.lang === "en" ? en : ru;
      }
      function applyLocaleStatic() {
        $("app-title").textContent = tr("appTitle");
        document.title = tr("appTitle") + " · Mini App";
        $("app-subtitle").textContent = tr("subtitle");
        $("stat-wallets-label").textContent = tr("wallets");
        $("stat-contacts-label").textContent = tr("contacts");
        $("stat-role-label").textContent = tr("role");
        $("tab-wallets").textContent = tr("tabWallets");
        $("tab-contacts").textContent = tr("tabContacts");
        $("tab-history").textContent = tr("tabHistory");
        $("tab-cabinet").textContent = tr("tabCabinet");
        $("tab-settings").textContent = tr("tabSettings");
        $("admin-tab").textContent = tr("tabAdmin");
        $("wallet-add-title").textContent = tr("walletAddTitle");
        $("wallet-network-label").textContent = tr("network");
        $("wallet-address-label").textContent = tr("address");
        $("wallet-address").placeholder = "0x... / bc1... / T...";
        $("wallet-label-label").textContent = tr("label");
        $("wallet-label").placeholder = tr("label");
        $("wallet-add").textContent = tr("addWallet");
        $("wallet-list-title").textContent = tr("trackedWallets");
        $("contact-add-title").textContent = tr("addKnownWallet");
        $("contact-network-label").textContent = tr("network");
        $("contact-address-label").textContent = tr("address");
        $("contact-address").placeholder = tr("address");
        $("contact-label-label").textContent = tr("label");
        $("contact-label").placeholder = tr("label");
        $("contact-add").textContent = tr("addContact");
        $("contact-list-title").textContent = tr("knownWallets");
        $("history-title").textContent = tr("transferHistory");
        $("cabinet-subscription-title").textContent = tr("subscription");
        $("payment-title").textContent = tr("payment");
        $("pay-network-label").textContent = tr("network");
        $("pay-create").textContent = tr("createInvoice");
        $("pay-check").textContent = tr("checkPayment");
        const slotHead = $("slot-pack-heading");
        if (slotHead) slotHead.textContent = tr("slotPackHeading");
        const paySlotsNet = $("pay-slots-network-label");
        if (paySlotsNet) paySlotsNet.textContent = tr("network");
        const paySlotsBtn = $("pay-slots-create");
        if (paySlotsBtn) paySlotsBtn.textContent = tr("slotPackCreate");
        $("promo-title").textContent = tr("promoCode");
        $("promo-code-label").textContent = tr("promoCode");
        $("promo-activate").textContent = tr("activatePromo");
        $("settings-title").textContent = tr("settings");
        $("settings-lang-label").textContent = tr("language");
        $("settings-btc-label").textContent = tr("btcThreshold");
        $("settings-eth-label").textContent = tr("ethThreshold");
        $("settings-usdt-label").textContent = tr("usdtThreshold");
        $("settings-save").textContent = tr("saveSettings");
        const promoCreateTitle = $("admin-promo-create-title");
        if (promoCreateTitle) promoCreateTitle.textContent = tr("generatePromoCode");
        const promoCodeLabel = $("admin-promo-code-label");
        if (promoCodeLabel) promoCodeLabel.textContent = tr("promoCode");
        const promoDaysLabel = $("admin-promo-days-label");
        if (promoDaysLabel) promoDaysLabel.textContent = tr("durationDays");
        const promoMaxLabel = $("admin-promo-max-label");
        if (promoMaxLabel) promoMaxLabel.textContent = tr("maxActivations");
        const promoPercentLabel = $("admin-promo-percent-label");
        if (promoPercentLabel) promoPercentLabel.textContent = tr("bonusPercent");
        $("admin-promo-create").textContent = tr("createPromo");
        const promoListTitle = $("admin-promo-list-title");
        if (promoListTitle) promoListTitle.textContent = tr("promoCodes");
        const stopTitle = $("admin-stop-title");
        if (stopTitle) stopTitle.textContent = tr("stopWallets");
        const stopNetworkLabel = $("admin-stop-network-label");
        if (stopNetworkLabel) stopNetworkLabel.textContent = tr("network");
        const stopAddressLabel = $("admin-stop-address-label");
        if (stopAddressLabel) stopAddressLabel.textContent = tr("address");
        $("admin-stop-add").textContent = tr("addToStopList");
        $("admin-stop-remove-btn").textContent = tr("removeFromStopList");
        const linkTitle = $("admin-link-title");
        if (linkTitle) linkTitle.textContent = tr("linkAudit");
        const reputationTitle = $("admin-reputation-title");
        if (reputationTitle) reputationTitle.textContent = tr("walletReputation");
        const adminSlotsTitle = $("admin-slots-title");
        if (adminSlotsTitle) adminSlotsTitle.textContent = tr("adminSlotsTitle");
        const lUser = $("admin-slots-user-label");
        if (lUser) lUser.textContent = tr("adminSlotsUser");
        const lW = $("admin-slots-w-label");
        if (lW) lW.textContent = tr("adminSlotsW");
        const lC = $("admin-slots-c-label");
        if (lC) lC.textContent = tr("adminSlotsC");
        const adminSlotsBtn = $("admin-slots-apply");
        if (adminSlotsBtn) adminSlotsBtn.textContent = tr("adminSlotsApply");
      }
      document.documentElement.lang = state.lang;
      applyLocaleStatic();
      function toast(text, bad = false) {
        const el = $("toast");
        el.textContent = String(text || "");
        el.style.display = "block";
        el.style.borderColor = bad ? "#7a2d39" : "#2a3142";
        setTimeout(() => { el.style.display = "none"; }, 2400);
      }
      async function api(path, method = "GET", body = null) {
        const res = await fetch("/api" + path, {
          method,
          headers: { "content-type": "application/json", authorization: "tma " + initData },
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
        return data;
      }
      async function copyText(value) {
        const text = String(value || "").trim();
        if (!text) return false;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {}
        try {
          const area = document.createElement("textarea");
          area.value = text;
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.focus();
          area.select();
          document.execCommand("copy");
          document.body.removeChild(area);
          return true;
        } catch {
          return false;
        }
      }
      function fmtDate(v) {
        if (!v) return "—";
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return v;
        return d.toLocaleString(state.lang === "en" ? "en-US" : "ru-RU", { timeZone: "Europe/Moscow" });
      }
      function shortAddr(v) {
        if (!v) return "—";
        if (v.length < 16) return v;
        return v.slice(0, 8) + "..." + v.slice(-6);
      }
      function clearNode(id) { $(id).innerHTML = ""; }
      function append(id, html) {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = html;
        $(id).appendChild(div);
      }
      function renderSummary() {
        $("stat-role").textContent = state.me?.isAdmin ? tr("roleAdmin") : tr("roleUser");
        if (!state.summary) {
          $("stat-wallets").textContent = "—";
          $("stat-contacts").textContent = "—";
          return;
        }
        $("stat-wallets").textContent = state.summary.walletCount + " / " + state.summary.walletLimit;
        $("stat-contacts").textContent = state.summary.contactCount + " / " + state.summary.contactLimit;
      }
      function activateTab(name) {
        document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el.dataset.tab === name));
        document.querySelectorAll(".panel").forEach((el) => el.classList.toggle("active", el.id === name));
      }
      async function loadMe() {
        const data = await api("/me");
        state.me = data.me;
        state.subscription = data.subscription;
        if (data.subscription?.status === "active") {
          const expiresMs = Date.parse(data.subscription.expiresAt || "");
          if (Number.isFinite(expiresMs) && expiresMs > Date.now()) {
            state.me.hasFullAccess = true;
          }
        }
        if (data.me?.isAdmin) {
          $("admin-tab").classList.remove("hidden");
          $("admin").classList.remove("hidden");
        }
      }
      function applyAccessRestrictions() {
        if (state.me?.isAdmin || state.me?.hasFullAccess) {
          return;
        }
        document.querySelectorAll(".tab").forEach((el) => {
          if (el.dataset.tab !== "cabinet") {
            el.classList.add("hidden");
          }
        });
        activateTab("cabinet");
      }
      async function loadSummary() {
        const data = await api("/summary");
        state.summary = data.summary;
      }
      async function loadWallets() {
        const data = await api("/wallets");
        state.wallets = data.items || [];
        clearNode("wallet-list");
        if (!state.wallets.length) {
          append("wallet-list", '<div class="muted">' + tr("noWallets") + "</div>");
          return;
        }
        state.wallets.forEach((w) => {
          const title = w.label
            ? "<div><b>" + w.label + "</b> <span class='muted'>[" + String(w.network).toUpperCase() + "]</span></div>"
            : "<div><b>[" + String(w.network).toUpperCase() + "]</b></div>";
          append(
            "wallet-list",
            title +
              "<div class='address-line'><span class='mono addr-pill'>" +
              w.address +
              "</span><button class='btn ghost copy-btn' data-copy='" +
              w.address +
              "'>" + tr("copy") + "</button></div>" +
              "<div class='muted'>" + tr("assets") + ": " +
              [w.monitorEthNative ? "ETH" : "", w.monitorUsdtErc20 ? "USDT ERC20" : "", w.monitorUsdtBep20 ? "USDT BEP20" : "", w.monitorUsdtTrc20 ? "USDT TRC20" : ""]
                .filter(Boolean)
                .join(", ") +
              "</div>" +
              "<div class='btns'><button class='btn ghost' data-bal='" +
              w.id +
              "'>" + tr("balance") + "</button><button class='btn bad' data-del-wallet='" +
              w.id +
              "'>" + tr("delete") + "</button></div><div id='bal-" +
              w.id +
              "' class='muted'></div>"
          );
        });
      }
      async function loadContacts() {
        const data = await api("/contacts");
        state.contacts = data.items || [];
        clearNode("contact-list");
        if (!state.contacts.length) {
          append("contact-list", '<div class="muted">' + tr("noContacts") + "</div>");
          return;
        }
        state.contacts.forEach((it) => {
          append(
            "contact-list",
            "<div><b>" +
              it.label +
              "</b> [" +
              String(it.network).toUpperCase() +
              "]</div><div class='address-line'><span class='mono muted addr-pill'>" +
              it.address +
              "</span><button class='btn ghost copy-btn' data-copy='" +
              it.address +
              "'>" + tr("copy") + "</button></div><div class='btns'><button class='btn bad' data-del-contact='" +
              it.id +
              "'>" + tr("delete") + "</button></div>"
          );
        });
      }
      async function loadHistory() {
        const data = await api("/transfer-history?limit=100");
        state.history = data.items || [];
        clearNode("history-list");
        if (!state.history.length) {
          append("history-list", '<div class="muted">' + tr("noTransfers") + "</div>");
          return;
        }
        state.history.forEach((h) => {
          append(
            "history-list",
            "<div><b>" +
              h.asset +
              "</b> · " +
              h.amount +
              " · " +
              h.direction +
              "</div><div class='muted'>[" +
              String(h.network).toUpperCase() +
              "] " +
              shortAddr(h.counterpartyAddress || h.fromAddress || "") +
              " · " +
              fmtDate(h.createdAt) +
              "</div>"
          );
        });
      }
      async function loadSettings() {
        const data = await api("/settings");
        const s = data.settings;
        // Prefer explicit saved setting, fallback to Telegram language when setting is missing/invalid.
        const lang = s.language === "en" || s.language === "ru" ? s.language : initialLang;
        state.lang = lang;
        document.documentElement.lang = lang;
        applyLocaleStatic();
        $("set-lang").value = lang;
        $("set-btc").value = s.btcThreshold;
        $("set-eth").value = s.ethThreshold;
        $("set-usdt").value = s.usdtThreshold;
      }
      async function loadSubscription() {
        const data = await api("/subscription");
        state.subscription = data.subscription;
        state.payment = data.activePayment;
        state.activeSlotPack = data.activeSlotPack;
        const s = data.subscription;
        $("cabinet-subscription").innerHTML =
          "<div><b>" + tr("plan") + ":</b> <code>" +
          s.planCode +
          "</code></div><div><b>" + tr("status") + ":</b> " +
          s.status +
          "</div><div><b>" + tr("validUntil") + ":</b> " +
          fmtDate(s.expiresAt) +
          "</div><div><b>" + tr("promoActivations") + ":</b> " +
          s.promoActivations +
          "</div>";
        const blocks = [];
        if (data.activePayment) {
          blocks.push(
            "<div><b>" + tr("pendingSubInvoice") + "</b> — " + tr("pendingInvoice").toLowerCase() + ": <b>" +
              data.activePayment.amountText +
              " " +
              data.activePayment.asset +
              "</b><div class='copy-block'>" + tr("address") + ":<span class='mono addr-pill'>" +
              data.activePayment.payAddress +
              "</span><button class='btn ghost copy-btn' data-copy='" +
              data.activePayment.payAddress +
              "'>" + tr("copyAddress") + "</button></div>" + tr("expires") + ": " +
              fmtDate(data.activePayment.expiresAt) + "</div>"
          );
        }
        if (data.activeSlotPack) {
          blocks.push(
            "<div><b>" + tr("pendingSlotInvoice") + "</b> — " + tr("pendingInvoice").toLowerCase() + ": <b>" +
              data.activeSlotPack.amountText +
              " " +
              data.activeSlotPack.asset +
              "</b><div class='copy-block'>" + tr("address") + ":<span class='mono addr-pill'>" +
              data.activeSlotPack.payAddress +
              "</span><button class='btn ghost copy-btn' data-copy='" +
              data.activeSlotPack.payAddress +
              "'>" + tr("copyAddress") + "</button></div>" + tr("expires") + ": " +
              fmtDate(data.activeSlotPack.expiresAt) + "</div>"
          );
        }
        if (blocks.length) {
          $("pay-info").innerHTML = blocks.join("<hr style='border:none;border-top:1px solid #2a3142;margin:0.5rem 0' />");
        } else {
          $("pay-info").textContent = tr("noActiveInvoice");
        }
      }
      async function loadAdmin() {
        if (!state.me?.isAdmin) return;
        const [promo, stop, links, rep] = await Promise.all([
          api("/admin/promo-codes"),
          api("/admin/stopped-wallets"),
          api("/admin/link-audit"),
          api("/admin/wallet-reputation")
        ]);
        clearNode("admin-promo-list");
        (promo.items || []).forEach((p) => {
          append(
            "admin-promo-list",
            "<div><b>" +
              p.code +
              "</b> · " +
              p.durationDays +
              "d · +" +
              p.bonusPercent +
              "% · " +
              (p.isActive ? tr("active") : tr("disabled")) +
              "</div><div class='muted'>" + tr("uses") + ": " +
              p.activationsCount +
              " / " +
              (p.maxActivations ?? "∞") +
              "</div><div class='btns'><button class='btn ghost' data-promo-toggle='" +
              p.id +
              "' data-next-active='" +
              (p.isActive ? "0" : "1") +
              "'>" +
              (p.isActive ? tr("disable") : tr("enable")) +
              "</button></div>"
          );
        });
        clearNode("admin-stop-list");
        (stop.items || []).forEach((s) =>
          append(
            "admin-stop-list",
            "<div>[" +
              String(s.network).toUpperCase() +
              "]</div><div class='address-line'><span class='mono addr-pill'>" +
              s.address +
              "</span><button class='btn ghost copy-btn' data-copy='" +
              s.address +
              "'>" + tr("copy") + "</button></div><div class='btns'><button class='btn bad' data-stop-remove='" +
              s.network +
              "' data-stop-address='" +
              s.address +
              "'>" + tr("delete") + "</button></div>"
          )
        );
        if (!(stop.items || []).length) append("admin-stop-list", '<div class="muted">' + tr("noStopWallets") + "</div>");
        clearNode("admin-link-list");
        (links.items || []).forEach((it) =>
          append("admin-link-list", "<div>" + it.entityType + " · [" + String(it.network).toUpperCase() + "] " + shortAddr(it.address) + "</div><div class='muted'>" + tr("userLabel") + " " + it.actorUserId + " · " + fmtDate(it.createdAt) + "</div>")
        );
        if (!(links.items || []).length) append("admin-link-list", '<div class="muted">' + tr("noLinkLogs") + "</div>");
        clearNode("admin-reputation-list");
        (rep.items || []).forEach((it) =>
          append("admin-reputation-list", "<div>[" + String(it.network).toUpperCase() + "] " + shortAddr(it.address) + "</div><div class='muted'>" + tr("score") + ": " + it.score + " (👍 " + it.likesCount + " / 👎 " + it.dislikesCount + ")</div>")
        );
      }

      document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));

      $("wallet-add").addEventListener("click", async () => {
        try {
          const address = $("wallet-address").value.trim();
          const label = $("wallet-label").value.trim();
          const preferredNetwork = $("wallet-network").value;
          const detected = await api("/detect-network", "POST", { address });
          const candidates = detected.candidates || [];
          if (!candidates.length) throw new Error(tr("detectFailed"));
          let network = candidates[0];
          if (preferredNetwork !== "auto") {
            if (!candidates.includes(preferredNetwork)) {
              throw new Error(tr("selectedNetworkMismatch"));
            }
            network = preferredNetwork;
          } else if (candidates.length > 1) {
            throw new Error(tr("chooseNetworkForAddress"));
          }
          await api("/wallets", "POST", { network, address, label: label || undefined, monitorEthNative: true, monitorUsdtErc20: true, monitorUsdtBep20: true, monitorUsdtTrc20: true });
          $("wallet-address").value = "";
          $("wallet-label").value = "";
          toast(tr("walletAdded"));
          await Promise.all([loadWallets(), loadContacts(), loadSummary()]);
          renderSummary();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("contact-add").addEventListener("click", async () => {
        try {
          const address = $("contact-address").value.trim();
          const label = $("contact-label").value.trim();
          const preferredNetwork = $("contact-network").value;
          const detected = await api("/detect-network", "POST", { address });
          const candidates = detected.candidates || [];
          if (!candidates.length) throw new Error(tr("detectFailed"));
          let network = candidates[0];
          if (preferredNetwork !== "auto") {
            if (!candidates.includes(preferredNetwork)) {
              throw new Error(tr("selectedNetworkMismatch"));
            }
            network = preferredNetwork;
          } else if (candidates.length > 1) {
            throw new Error(tr("chooseNetworkForAddress"));
          }
          await api("/contacts", "POST", { network, address, label });
          $("contact-address").value = "";
          $("contact-label").value = "";
          toast(tr("contactAdded"));
          await Promise.all([loadContacts(), loadWallets(), loadSummary()]);
          renderSummary();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("settings-save").addEventListener("click", async () => {
        try {
          await api("/settings", "PUT", {
            language: $("set-lang").value,
            btcThreshold: $("set-btc").value.trim(),
            ethThreshold: $("set-eth").value.trim(),
            usdtThreshold: $("set-usdt").value.trim(),
            showUsdEstimate: true,
            blockchainNotificationsEnabled: true,
            serviceNotificationsEnabled: true
          });
          state.lang = $("set-lang").value === "en" ? "en" : "ru";
          document.documentElement.lang = state.lang;
          applyLocaleStatic();
          await Promise.all([loadWallets(), loadContacts(), loadHistory(), loadSubscription()]);
          if (state.me?.isAdmin) {
            await loadAdmin();
          }
          renderSummary();
          toast(tr("settingsSaved"));
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("pay-create").addEventListener("click", async () => {
        try {
          const data = await api("/subscription/invoice", "POST", { network: $("pay-network").value });
          toast(tr("invoiceCreated"));
          await loadSubscription();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("pay-slots-create")?.addEventListener("click", async () => {
        try {
          const data = await api("/subscription/slots/invoice", "POST", { network: $("pay-slots-network").value });
          if (data.invoice) {
            toast(tr("invoiceCreated"));
            await loadSubscription();
          }
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("pay-check").addEventListener("click", async () => {
        try {
          const data = await api("/subscription/check", "POST", {});
          if (data.result?.paid > 0) {
            toast(tr("paymentConfirmed"));
          } else {
            toast(tr("paymentNotFound"));
          }
          await loadSubscription();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("promo-activate").addEventListener("click", async () => {
        try {
          const code = $("promo-code").value.trim();
          await api("/promo/activate", "POST", { code });
          $("promo-code").value = "";
          toast(tr("promoActivatedOk"));
          await loadSubscription();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("admin-promo-create").addEventListener("click", async () => {
        try {
          await api("/admin/promo-codes", "POST", {
            code: $("admin-promo-code").value.trim(),
            durationDays: Number($("admin-promo-days").value || 30),
            maxActivations: $("admin-promo-max").value ? Number($("admin-promo-max").value) : null,
            bonusPercent: Number($("admin-promo-percent").value || 0),
            isActive: true
          });
          toast(tr("promoCreatedOk"));
          await loadAdmin();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("admin-stop-add").addEventListener("click", async () => {
        try {
          await api("/admin/stopped-wallets", "POST", {
            network: $("admin-stop-network").value,
            address: $("admin-stop-address").value.trim()
          });
          $("admin-stop-address").value = "";
          toast(tr("addedStopOk"));
          await loadAdmin();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("admin-stop-remove-btn").addEventListener("click", async () => {
        try {
          await api("/admin/stopped-wallets", "DELETE", {
            network: $("admin-stop-network").value,
            address: $("admin-stop-address").value.trim()
          });
          $("admin-stop-address").value = "";
          toast(tr("removedStopOk"));
          await loadAdmin();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("admin-slots-apply")?.addEventListener("click", async () => {
        try {
          const targetUserId = $("admin-slots-user").value.trim();
          if (!/^\d+$/.test(targetUserId)) throw new Error("Invalid user id");
          await api("/admin/slot-bonuses", "POST", {
            targetUserId,
            extraWalletSlots: Number($("admin-slots-w").value || 0),
            extraContactSlots: Number($("admin-slots-c").value || 0)
          });
          toast(tr("adminSlotsOk"));
          $("admin-slots-user").value = "";
          $("admin-slots-w").value = "0";
          $("admin-slots-c").value = "0";
        } catch (e) { toast(e.message || "Error", true); }
      });

      document.body.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const copyEl = target.closest("[data-copy]");
        if (copyEl instanceof HTMLElement) {
          const ok = await copyText(copyEl.dataset.copy || "");
          toast(ok ? msg("Адрес скопирован.", "Address copied.") : msg("Не удалось скопировать адрес.", "Could not copy address."), !ok);
          return;
        }
        const delWallet = target.dataset.delWallet;
        if (delWallet) {
          try {
            await api("/wallets/" + delWallet, "DELETE");
            toast(tr("walletDeleted"));
            await Promise.all([loadWallets(), loadSummary()]);
            renderSummary();
          } catch (e) { toast(e.message || "Error", true); }
          return;
        }
        const delContact = target.dataset.delContact;
        if (delContact) {
          try {
            await api("/contacts/" + delContact, "DELETE");
            toast(tr("contactDeleted"));
            await Promise.all([loadContacts(), loadWallets(), loadSummary()]);
            renderSummary();
          } catch (e) { toast(e.message || "Error", true); }
          return;
        }
        const walletId = target.dataset.bal;
        if (walletId) {
          try {
            const data = await api("/wallets/" + walletId + "/balance");
            const lines = (data.balance?.entries || []).map((x) => "• " + x.asset + ": " + x.amount).join("<br/>");
            const source = data.balance?.source === "cache" ? " (cache)" : "";
            $("bal-" + walletId).innerHTML = lines + source;
          } catch (e) { toast(e.message || "Error", true); }
          return;
        }
        const promoId = target.dataset.promoToggle;
        if (promoId) {
          try {
            await api("/admin/promo-codes/" + promoId, "PATCH", {
              isActive: target.dataset.nextActive === "1"
            });
            toast(tr("promoStateUpdated"));
            await loadAdmin();
          } catch (e) { toast(e.message || "Error", true); }
          return;
        }
        const stopNetwork = target.dataset.stopRemove;
        if (stopNetwork) {
          try {
            await api("/admin/stopped-wallets", "DELETE", {
              network: stopNetwork,
              address: target.dataset.stopAddress || ""
            });
            toast(tr("removedStopOk"));
            await loadAdmin();
          } catch (e) { toast(e.message || "Error", true); }
        }
      });

      (async function init() {
        if (!initData) toast(tr("openFromTelegram"), true);
        try {
          await loadMe();
          applyAccessRestrictions();
          if (state.me?.isAdmin || state.me?.hasFullAccess) {
            await loadSettings();
            await Promise.all([loadSummary(), loadWallets(), loadContacts(), loadHistory(), loadSubscription()]);
            if (state.me?.isAdmin) {
              await loadAdmin();
            }
          } else {
            await loadSubscription();
            toast(
              tr("accessFirst"),
              true
            );
          }
          renderSummary();
        } catch (e) {
          toast(e.message || "Init failed", true);
        }
      })();
    </script>
  </body>
</html>`;
}

miniapp.get("/miniapp", (c) => {
  return c.html(pageHtml());
});

export default miniapp;
