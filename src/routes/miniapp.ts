import { Hono } from "hono";
import type { Env } from "../types/env";

const miniapp = new Hono<{ Bindings: Env }>();

function pageHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>VOROBEY: Check</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
      :root {
        --bg-color: #ffffff;
        --sec-bg-color: #f3f3f3;
        --text-color: #222222;
        --hint-color: #999999;
        --link-color: #2481cc;
        --btn-color: #2481cc;
        --btn-text-color: #ffffff;
        --danger-color: #ff3b30;
        --border: rgba(128, 128, 128, 0.15);
        --card-radius: 12px;
      }

      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background: var(--sec-bg-color);
        color: var(--text-color);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      body { padding: 0 0 24px; }
      .shell { max-width: 920px; margin: 0 auto; }

      .header {
        position: sticky;
        top: 0;
        z-index: 5;
        background: color-mix(in srgb, var(--bg-color) 88%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--border);
        padding: 14px 16px 12px;
      }
      .title {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: var(--hint-color);
      }
      .stats {
        margin-top: 8px;
        display: flex;
        gap: 8px;
      }
      .stat {
        flex: 1;
        background: var(--bg-color);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px;
      }
      .stat-label { font-size: 11px; color: var(--hint-color); }
      .stat-value { margin-top: 2px; font-size: 13px; font-weight: 600; }

      .tabs-wrap {
        padding: 12px 16px 0;
        position: sticky;
        top: 98px;
        z-index: 4;
        background: color-mix(in srgb, var(--sec-bg-color) 88%, transparent);
        backdrop-filter: blur(8px);
      }
      .tabs {
        display: flex;
        gap: 2px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--sec-bg-color);
        padding: 2px;
      }
      .tab {
        flex: 1;
        border-radius: 6px;
        padding: 9px 8px;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }
      .tab.active {
        background: var(--bg-color);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .panel {
        display: none;
        padding: 12px 16px 0;
      }
      .panel.active {
        display: block;
        animation: fade-in 0.22s ease;
      }
      .card {
        background: var(--bg-color);
        border: 1px solid var(--border);
        border-radius: var(--card-radius);
        padding: 14px;
        margin-bottom: 12px;
      }
      .form-group { margin-bottom: 10px; }
      label {
        display: block;
        font-size: 12px;
        color: var(--hint-color);
        margin-bottom: 5px;
      }
      input, select {
        width: 100%;
        border: 1px solid transparent;
        border-radius: 8px;
        background: var(--sec-bg-color);
        color: var(--text-color);
        font-size: 16px;
        min-height: 44px;
        padding: 10px 12px;
        outline: none;
      }
      input::placeholder { color: var(--hint-color); }
      input:focus, select:focus { border-color: var(--btn-color); }

      .btn {
        width: 100%;
        border: none;
        border-radius: 8px;
        min-height: 44px;
        padding: 10px 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn:active { transform: scale(0.98); }
      .btn.primary {
        background: var(--btn-color);
        color: var(--btn-text-color);
      }
      .btn.ghost {
        width: auto;
        min-height: 34px;
        font-size: 14px;
        background: transparent;
        color: var(--link-color);
        padding: 8px 10px;
        border: 1px solid var(--border);
      }
      .btn.danger {
        width: auto;
        min-height: 34px;
        font-size: 14px;
        background: rgba(255, 59, 48, 0.1);
        color: var(--danger-color);
        padding: 8px 10px;
        border: 1px solid color-mix(in srgb, var(--danger-color) 25%, transparent);
      }

      .list-item {
        border-bottom: 1px solid var(--border);
        padding: 12px 0;
      }
      .list-item:last-child { border-bottom: none; }
      .list-item-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .list-item-title {
        font-size: 16px;
        font-weight: 500;
      }
      .list-item-sub {
        margin-top: 4px;
        font-size: 13px;
        color: var(--hint-color);
        word-break: break-all;
      }
      .list-actions {
        margin-top: 8px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .empty {
        text-align: center;
        color: var(--hint-color);
        font-size: 13px;
        padding: 10px 0;
      }
      .edit-wrap {
        margin-top: 8px;
        display: grid;
        gap: 8px;
      }

      .switch {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        background: var(--sec-bg-color);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 8px;
      }
      .switch-title { font-size: 14px; font-weight: 600; }
      .switch-sub { margin-top: 2px; font-size: 12px; color: var(--hint-color); }

      .skeleton-line {
        height: 13px;
        border-radius: 5px;
        background: color-mix(in srgb, var(--hint-color) 22%, transparent);
        animation: pulse 1.35s infinite;
      }
      .skeleton-line + .skeleton-line { margin-top: 8px; }

      .toast {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 20;
        padding: 8px 12px;
        font-size: 13px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--bg-color);
        display: none;
        max-width: calc(100% - 24px);
      }
      .footer {
        text-align: center;
        color: var(--hint-color);
        font-size: 11px;
        margin-top: 10px;
      }

      @keyframes pulse {
        0% { opacity: 0.55; }
        50% { opacity: 0.25; }
        100% { opacity: 0.55; }
      }
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  </head>
  <body>
    <div id="toast" class="toast"></div>
    <div class="shell">
      <header class="header">
        <h1 class="title" data-i18n="title">VOROBEY: Check</h1>
        <div class="subtitle" data-i18n="subtitle">Track wallets privately in Telegram.</div>
        <div class="stats">
          <div class="stat">
            <div class="stat-label" data-i18n="walletUsage">Wallets</div>
            <div class="stat-value" id="wallet-usage">0 / 10</div>
          </div>
          <div class="stat">
            <div class="stat-label" data-i18n="contactUsage">Contacts</div>
            <div class="stat-value" id="contact-usage">0 / 50</div>
          </div>
        </div>
      </header>

      <div class="tabs-wrap">
        <div class="tabs">
          <div class="tab active" data-tab="wallets" data-i18n="tabWallets">Wallets</div>
          <div class="tab" data-tab="contacts" data-i18n="tabContacts">Contacts</div>
          <div class="tab" data-tab="settings" data-i18n="tabSettings">Settings</div>
        </div>
      </div>

      <section id="wallets" class="panel active">
        <div class="card">
          <div class="form-group">
            <label for="wallet-network" data-i18n="network">Network</label>
            <select id="wallet-network" aria-label="Wallet network">
              <option value="btc">BTC</option>
              <option value="eth">ETH</option>
            </select>
          </div>
          <div class="form-group">
            <label for="wallet-address" data-i18n="address">Address</label>
            <input id="wallet-address" aria-label="Wallet address" />
          </div>
          <button id="wallet-add" class="btn primary" data-i18n="addWallet">Add Wallet</button>
        </div>

        <div class="card">
          <div class="form-group">
            <label for="wallet-search" data-i18n="searchWallets">Search wallets...</label>
            <input id="wallet-search" type="search" aria-label="Search wallets" />
          </div>
          <div id="wallet-list"></div>
        </div>
      </section>

      <section id="contacts" class="panel">
        <div class="card">
          <div class="form-group">
            <label for="contact-network" data-i18n="network">Network</label>
            <select id="contact-network" aria-label="Contact network">
              <option value="btc">BTC</option>
              <option value="eth">ETH</option>
            </select>
          </div>
          <div class="form-group">
            <label for="contact-address" data-i18n="address">Address</label>
            <input id="contact-address" aria-label="Contact address" />
          </div>
          <div class="form-group">
            <label for="contact-label" data-i18n="label">Label</label>
            <input id="contact-label" aria-label="Contact label" />
          </div>
          <button id="contact-add" class="btn primary" data-i18n="addContact">Add Contact</button>
        </div>

        <div class="card">
          <div class="form-group">
            <label for="contact-search" data-i18n="searchContacts">Search contacts...</label>
            <input id="contact-search" type="search" aria-label="Search contacts" />
          </div>
          <div id="contact-list"></div>
        </div>
      </section>

      <section id="settings" class="panel">
        <div class="card">
          <div class="form-group">
            <label for="lang" data-i18n="language">Language</label>
            <select id="lang" aria-label="Language">
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </div>
          <div class="form-group">
            <label for="btc-th" data-i18n="btcThreshold">BTC threshold</label>
            <input id="btc-th" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label for="eth-th" data-i18n="ethThreshold">ETH threshold</label>
            <input id="eth-th" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label for="usdt-th" data-i18n="usdtThreshold">USDT threshold</label>
            <input id="usdt-th" inputmode="decimal" />
          </div>

          <div class="switch">
            <div>
              <div class="switch-title" data-i18n="showUsd">Show USD estimate</div>
              <div class="switch-sub" data-i18n="showUsdHelp">Display approx. fiat value.</div>
            </div>
            <input type="checkbox" id="usd-toggle" aria-label="Show USD estimate" />
          </div>

          <div class="switch">
            <div>
              <div class="switch-title" data-i18n="chainNotif">Blockchain alerts</div>
              <div class="switch-sub" data-i18n="chainNotifHelp">Notify on incoming transfers.</div>
            </div>
            <input type="checkbox" id="chain-toggle" aria-label="Blockchain alerts" />
          </div>

          <div class="switch">
            <div>
              <div class="switch-title" data-i18n="serviceNotif">Service alerts</div>
              <div class="switch-sub" data-i18n="serviceNotifHelp">Bot confirmations and updates.</div>
            </div>
            <input type="checkbox" id="service-toggle" aria-label="Service alerts" />
          </div>

          <button id="settings-save" class="btn primary" data-i18n="saveSettings">Save Changes</button>
        </div>
      </section>

      <div class="footer" data-i18n="footer">Telegram Mini App</div>
    </div>

    <script>
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const initData = tg?.initData || "";

      const state = {
        lang: "en",
        wallets: [],
        contacts: [],
        summary: null
      };

      const I18N = {
        en: {
          title: "VOROBEY: Check",
          subtitle: "Track wallets privately in Telegram.",
          tabWallets: "Wallets",
          tabContacts: "Contacts",
          tabSettings: "Settings",
          network: "Network",
          address: "Address",
          label: "Label",
          addWallet: "Add Wallet",
          addContact: "Add Contact",
          saveSettings: "Save Changes",
          language: "Language",
          btcThreshold: "BTC threshold",
          ethThreshold: "ETH threshold",
          usdtThreshold: "USDT threshold",
          walletUsage: "Wallets",
          contactUsage: "Contacts",
          showUsd: "Show USD estimate",
          showUsdHelp: "Display approx. fiat value.",
          chainNotif: "Blockchain alerts",
          chainNotifHelp: "Notify on incoming transfers.",
          serviceNotif: "Service alerts",
          serviceNotifHelp: "Bot confirmations and updates.",
          searchWallets: "Search wallets...",
          searchContacts: "Search contacts...",
          empty: "Nothing found",
          deleted: "Deleted",
          updated: "Updated",
          addedWallet: "Wallet added",
          addedContact: "Contact added",
          saved: "Settings saved",
          edit: "Edit",
          save: "Save",
          cancel: "Cancel",
          delete: "Delete",
          footer: "Telegram Mini App"
        },
        ru: {
          title: "VOROBEY: Check",
          subtitle: "Приватный трекинг кошельков в Telegram.",
          tabWallets: "Кошельки",
          tabContacts: "Контакты",
          tabSettings: "Настройки",
          network: "Сеть",
          address: "Адрес",
          label: "Имя (метка)",
          addWallet: "Добавить кошелек",
          addContact: "Добавить контакт",
          saveSettings: "Сохранить",
          language: "Язык",
          btcThreshold: "Порог BTC",
          ethThreshold: "Порог ETH",
          usdtThreshold: "Порог USDT",
          walletUsage: "Кошельки",
          contactUsage: "Контакты",
          showUsd: "Показывать USD оценку",
          showUsdHelp: "Примерная стоимость в фиате.",
          chainNotif: "Уведомления сети",
          chainNotifHelp: "О входящих переводах.",
          serviceNotif: "Уведомления бота",
          serviceNotifHelp: "Системные сообщения.",
          searchWallets: "Поиск кошельков...",
          searchContacts: "Поиск контактов...",
          empty: "Ничего не найдено",
          deleted: "Удалено",
          updated: "Обновлено",
          addedWallet: "Кошелек добавлен",
          addedContact: "Контакт добавлен",
          saved: "Настройки сохранены",
          edit: "Изменить",
          save: "Сохранить",
          cancel: "Отмена",
          delete: "Удалить",
          footer: "Telegram Mini App"
        }
      };

      function t(key) {
        return (I18N[state.lang] || I18N.en)[key] || key;
      }

      function showToast(text, isError = false) {
        const toast = document.getElementById("toast");
        toast.textContent = text;
        toast.style.display = "block";
        toast.style.borderColor = isError ? "#ff9eb188" : "var(--border)";
        setTimeout(() => {
          toast.style.display = "none";
        }, 2200);
      }

      function applyTheme() {
        const params = tg?.themeParams || {};
        const root = document.documentElement;
        root.style.setProperty("--bg-color", params.bg_color || "#ffffff");
        root.style.setProperty("--sec-bg-color", params.secondary_bg_color || "#f3f3f3");
        root.style.setProperty("--text-color", params.text_color || "#222222");
        root.style.setProperty("--hint-color", params.hint_color || "#999999");
        root.style.setProperty("--link-color", params.link_color || "#2481cc");
        root.style.setProperty("--btn-color", params.button_color || "#2481cc");
        root.style.setProperty("--btn-text-color", params.button_text_color || "#ffffff");
        root.style.setProperty("--danger-color", params.destructive_text_color || "#ff3b30");
      }

      applyTheme();
      tg?.onEvent?.("themeChanged", applyTheme);

      async function api(path, method = "GET", body = null) {
        const response = await fetch("/api" + path, {
          method,
          headers: {
            "content-type": "application/json",
            "authorization": "tma " + initData
          },
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || ("HTTP " + response.status));
        }
        return data;
      }

      function applySummary() {
        if (!state.summary) return;
        document.getElementById("wallet-usage").textContent =
          state.summary.walletCount + " / " + state.summary.walletLimit;
        document.getElementById("contact-usage").textContent =
          state.summary.contactCount + " / " + state.summary.contactLimit;
      }

      function setText() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
          el.textContent = t(el.dataset.i18n);
        });
        document.getElementById("wallet-address").placeholder =
          state.lang === "ru" ? "Вставьте адрес" : "Paste wallet address";
        document.getElementById("contact-address").placeholder =
          state.lang === "ru" ? "Адрес отправителя" : "Known sender address";
        document.getElementById("contact-label").placeholder =
          state.lang === "ru" ? "Паша" : "Pasha";
        document.getElementById("wallet-search").placeholder = t("searchWallets");
        document.getElementById("contact-search").placeholder = t("searchContacts");
      }

      function activatePanel(name) {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
        document.querySelector('.tab[data-tab="' + name + '"]').classList.add("active");
        document.getElementById(name).classList.add("active");
      }

      function renderSkeleton(targetId, rows = 2) {
        const root = document.getElementById(targetId);
        root.innerHTML = "";
        for (let i = 0; i < rows; i += 1) {
          const wrap = document.createElement("div");
          wrap.className = "list-item";
          wrap.innerHTML = '<div class="skeleton-line" style="width:50%"></div><div class="skeleton-line"></div>';
          root.appendChild(wrap);
        }
      }

      function searchable(items, getter, query) {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((x) => getter(x).toLowerCase().includes(q));
      }

      function emptyNode() {
        const el = document.createElement("div");
        el.className = "empty";
        el.textContent = t("empty");
        return el;
      }

      async function loadSummary() {
        const data = await api("/summary");
        state.summary = data.summary;
        applySummary();
      }

      async function loadWallets() {
        renderSkeleton("wallet-list");
        const data = await api("/wallets");
        state.wallets = data.items;
        renderWallets();
        await loadSummary();
      }

      function renderWallets() {
        const root = document.getElementById("wallet-list");
        root.innerHTML = "";
        const filtered = searchable(
          state.wallets,
          (x) => x.network + " " + x.address,
          document.getElementById("wallet-search").value
        );
        if (filtered.length === 0) {
          root.appendChild(emptyNode());
          return;
        }

        filtered.forEach((item) => {
          const row = document.createElement("div");
          row.className = "list-item";
          row.innerHTML =
            '<div class="list-item-top"><div class="list-item-title">' +
            item.network.toUpperCase() +
            "</div></div>" +
            '<div class="list-item-sub">' +
            item.address +
            "</div>";
          const actions = document.createElement("div");
          actions.className = "list-actions";
          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = t("delete");
          del.addEventListener("click", async () => {
            await api("/wallets/" + item.id, "DELETE");
            showToast(t("deleted"));
            await loadWallets();
          });
          actions.appendChild(del);
          row.appendChild(actions);
          root.appendChild(row);
        });
      }

      async function loadContacts() {
        renderSkeleton("contact-list");
        const data = await api("/contacts");
        state.contacts = data.items;
        renderContacts();
        await loadSummary();
      }

      function renderContacts() {
        const root = document.getElementById("contact-list");
        root.innerHTML = "";
        const filtered = searchable(
          state.contacts,
          (x) => x.label + " " + x.address + " " + x.network,
          document.getElementById("contact-search").value
        );
        if (filtered.length === 0) {
          root.appendChild(emptyNode());
          return;
        }

        filtered.forEach((item) => {
          const row = document.createElement("div");
          row.className = "list-item";
          row.innerHTML =
            '<div class="list-item-top"><div class="list-item-title">' +
            item.label +
            " · " +
            item.network.toUpperCase() +
            "</div></div>" +
            '<div class="list-item-sub">' +
            item.address +
            "</div>";

          const actions = document.createElement("div");
          actions.className = "list-actions";

          const edit = document.createElement("button");
          edit.className = "btn ghost";
          edit.textContent = t("edit");
          edit.addEventListener("click", () => {
            const wrap = document.createElement("div");
            wrap.className = "edit-wrap";
            const input = document.createElement("input");
            input.value = item.label;
            const save = document.createElement("button");
            save.className = "btn primary";
            save.textContent = t("save");
            save.addEventListener("click", async () => {
              await api("/contacts/" + item.id, "PATCH", { label: input.value.trim() });
              showToast(t("updated"));
              await loadContacts();
            });
            const cancel = document.createElement("button");
            cancel.className = "btn ghost";
            cancel.textContent = t("cancel");
            cancel.addEventListener("click", renderContacts);
            wrap.appendChild(input);
            wrap.appendChild(save);
            wrap.appendChild(cancel);
            row.appendChild(wrap);
          });

          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = t("delete");
          del.addEventListener("click", async () => {
            await api("/contacts/" + item.id, "DELETE");
            showToast(t("deleted"));
            await loadContacts();
          });

          actions.appendChild(edit);
          actions.appendChild(del);
          row.appendChild(actions);
          root.appendChild(row);
        });
      }

      async function loadSettings() {
        const data = await api("/settings");
        const s = data.settings;
        state.lang = s.language;
        document.getElementById("lang").value = s.language;
        document.getElementById("btc-th").value = s.btcThreshold;
        document.getElementById("eth-th").value = s.ethThreshold;
        document.getElementById("usdt-th").value = s.usdtThreshold;
        document.getElementById("usd-toggle").checked = s.showUsdEstimate;
        document.getElementById("chain-toggle").checked = s.blockchainNotificationsEnabled;
        document.getElementById("service-toggle").checked = s.serviceNotificationsEnabled;
        setText();
      }

      document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => activatePanel(tab.dataset.tab));
      });

      document.getElementById("wallet-add").addEventListener("click", async () => {
        try {
          await api("/wallets", "POST", {
            network: document.getElementById("wallet-network").value,
            address: document.getElementById("wallet-address").value.trim()
          });
          document.getElementById("wallet-address").value = "";
          showToast(t("addedWallet"));
          await loadWallets();
        } catch (error) {
          showToast(error.message, true);
        }
      });

      document.getElementById("contact-add").addEventListener("click", async () => {
        try {
          await api("/contacts", "POST", {
            network: document.getElementById("contact-network").value,
            address: document.getElementById("contact-address").value.trim(),
            label: document.getElementById("contact-label").value.trim()
          });
          document.getElementById("contact-address").value = "";
          document.getElementById("contact-label").value = "";
          showToast(t("addedContact"));
          await loadContacts();
        } catch (error) {
          showToast(error.message, true);
        }
      });

      document.getElementById("settings-save").addEventListener("click", async () => {
        try {
          await api("/settings", "PUT", {
            language: document.getElementById("lang").value,
            btcThreshold: document.getElementById("btc-th").value.trim(),
            ethThreshold: document.getElementById("eth-th").value.trim(),
            usdtThreshold: document.getElementById("usdt-th").value.trim(),
            showUsdEstimate: document.getElementById("usd-toggle").checked,
            blockchainNotificationsEnabled: document.getElementById("chain-toggle").checked,
            serviceNotificationsEnabled: document.getElementById("service-toggle").checked
          });
          state.lang = document.getElementById("lang").value;
          setText();
          showToast(t("saved"));
        } catch (error) {
          showToast(error.message, true);
        }
      });

      ["wallet-search", "contact-search"].forEach((id) => {
        let timer = null;
        document.getElementById(id).addEventListener("input", () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            if (id === "wallet-search") renderWallets();
            if (id === "contact-search") renderContacts();
          }, 140);
        });
      });

      (async function init() {
        if (!initData) {
          showToast("Open from Telegram to authorize", true);
        }
        try {
          await Promise.all([loadSettings(), loadWallets(), loadContacts(), loadSummary()]);
        } catch (error) {
          showToast(error.message, true);
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
