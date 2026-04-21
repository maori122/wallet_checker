import { Hono } from "hono";
import type { Env } from "../types/env";

const miniapp = new Hono<{ Bindings: Env }>();

function pageHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Wallet Mini App</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
      :root {
        --bg: radial-gradient(1200px 600px at -20% -30%, #8ed1fc33, transparent 60%),
              radial-gradient(1000px 600px at 120% -10%, #d4a5ff30, transparent 55%),
              linear-gradient(180deg, #0b0f19, #121828 45%, #0b101b);
        --card: rgba(255, 255, 255, 0.08);
        --card-strong: rgba(255, 255, 255, 0.14);
        --text: #f3f7ff;
        --muted: #a7b3c9;
        --border: rgba(255, 255, 255, 0.18);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: Inter, Segoe UI, Arial, sans-serif; }
      body { padding: 16px 12px 24px; }
      .shell { max-width: 920px; margin: 0 auto; display: grid; gap: 12px; }
      .glass { border: 1px solid var(--border); border-radius: 18px; background: linear-gradient(140deg, rgba(255,255,255,.16), rgba(255,255,255,.04)); box-shadow: 0 8px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.3); backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); transition: all .24s ease; }
      .glass:hover { transform: translateY(-1px); }
      .hero { padding: 14px; }
      .title { font-size: 21px; font-weight: 700; }
      .subtitle { margin-top: 5px; color: var(--muted); font-size: 13px; }
      .stats { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-top: 10px; }
      .stat { border: 1px solid var(--border); border-radius: 12px; background: var(--card); padding: 10px; }
      .stat-label { color: var(--muted); font-size: 11px; }
      .stat-value { font-weight: 700; margin-top: 4px; }
      .tabs { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; padding: 8px; }
      .tab { border: 1px solid transparent; border-radius: 12px; padding: 9px 6px; text-align: center; font-size: 13px; cursor: pointer; transition: all .2s ease; }
      .tab.active { border-color: var(--border); background: var(--card-strong); font-weight: 600; transform: translateY(-1px); }
      .panel { display: none; opacity: 0; transform: translateY(6px) scale(.995); padding: 12px; gap: 10px; }
      .panel.active { display: grid; }
      .panel.entered { opacity: 1; transform: translateY(0) scale(1); transition: all .26s cubic-bezier(.2,.9,.2,1); }
      .row { display: flex; gap: 8px; flex-wrap: wrap; }
      .field { display: grid; gap: 6px; flex: 1; min-width: 160px; }
      label { font-size: 12px; color: var(--muted); }
      input, select { width: 100%; border: 1px solid var(--border); border-radius: 10px; background: var(--card); color: var(--text); padding: 10px 12px; outline: none; }
      .btn { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--card); color: var(--text); cursor: pointer; font-weight: 600; transition: all .18s ease; }
      .btn.primary { background: linear-gradient(140deg, #74d4ffcc, #8ea7ffb3); color: #061426; border-color: #b9e6ff88; }
      .btn.danger { border-color: #ff90a555; color: #ffd4dc; }
      .btn.ghost { color: var(--muted); }
      .btn:active { transform: scale(.98); }
      .list { display: grid; gap: 8px; }
      .item { border: 1px solid var(--border); border-radius: 12px; background: var(--card); padding: 10px; display: grid; gap: 7px; animation: pop .2s ease; }
      .item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .item-title { font-size: 14px; font-weight: 600; }
      .item-sub { color: var(--muted); font-size: 12px; word-break: break-all; }
      .item-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .empty { color: var(--muted); text-align: center; padding: 16px 10px; }
      .skeleton-item { border: 1px solid var(--border); border-radius: 12px; background: var(--card); padding: 12px; }
      .skeleton-line { height: 10px; border-radius: 999px; background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.20), rgba(255,255,255,.06)); background-size: 220% 100%; animation: shimmer 1.2s linear infinite; }
      .skeleton-line + .skeleton-line { margin-top: 10px; }
      .toast { position: sticky; top: 8px; z-index: 10; border: 1px solid var(--border); border-radius: 10px; background: var(--card-strong); padding: 10px 12px; display: none; }
      .switch { display: flex; justify-content: space-between; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--card); padding: 10px; }
      .switch small { color: var(--muted); }
      .footer { text-align: center; color: var(--muted); font-size: 11px; }
      @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -20% 0; } }
      @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @media (max-width: 520px) { .tabs { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    </style>
  </head>
  <body>
    <div class="shell">
      <div id="toast" class="toast"></div>
      <section class="hero glass">
        <div class="title" data-i18n="title">Wallet Mini App</div>
        <div class="subtitle" data-i18n="subtitle">Private tracking with encrypted storage and Telegram alerts.</div>
        <div class="stats">
          <div class="stat">
            <div class="stat-label" data-i18n="walletUsage">Wallet usage</div>
            <div class="stat-value" id="wallet-usage">0 / 10</div>
          </div>
          <div class="stat">
            <div class="stat-label" data-i18n="contactUsage">Contacts usage</div>
            <div class="stat-value" id="contact-usage">0 / 50</div>
          </div>
        </div>
      </section>

      <section class="glass tabs">
        <div class="tab active" data-tab="wallets" data-i18n="tabWallets">Wallets</div>
        <div class="tab" data-tab="contacts" data-i18n="tabContacts">Contacts</div>
        <div class="tab" data-tab="settings" data-i18n="tabSettings">Settings</div>
      </section>

      <section id="wallets" class="glass panel active">
        <div class="row">
          <div class="field"><label data-i18n="network">Network</label><select id="wallet-network"><option value="btc">BTC</option><option value="eth">ETH</option></select></div>
          <div class="field"><label data-i18n="address">Address</label><input id="wallet-address" /></div>
        </div>
        <div class="field"><label data-i18n="searchWallets">Search wallets</label><input id="wallet-search" /></div>
        <button class="btn primary" id="wallet-add" data-i18n="addWallet">Add wallet</button>
        <div id="wallet-list" class="list"></div>
      </section>

      <section id="contacts" class="glass panel">
        <div class="row">
          <div class="field"><label data-i18n="network">Network</label><select id="contact-network"><option value="btc">BTC</option><option value="eth">ETH</option></select></div>
          <div class="field"><label data-i18n="address">Address</label><input id="contact-address" /></div>
          <div class="field"><label data-i18n="label">Label</label><input id="contact-label" /></div>
        </div>
        <div class="field"><label data-i18n="searchContacts">Search contacts</label><input id="contact-search" /></div>
        <button class="btn primary" id="contact-add" data-i18n="addContact">Add contact</button>
        <div id="contact-list" class="list"></div>
      </section>

      <section id="settings" class="glass panel">
        <div class="row">
          <div class="field"><label data-i18n="language">Language</label><select id="lang"><option value="ru">RU</option><option value="en">EN</option></select></div>
          <div class="field"><label data-i18n="btcThreshold">BTC threshold</label><input id="btc-th" /></div>
          <div class="field"><label data-i18n="ethThreshold">ETH threshold</label><input id="eth-th" /></div>
          <div class="field"><label data-i18n="usdtThreshold">USDT threshold</label><input id="usdt-th" /></div>
        </div>
        <div class="switch"><div><strong data-i18n="showUsd">Show USD estimate</strong><br/><small data-i18n="showUsdHelp">Display approximate fiat value.</small></div><input type="checkbox" id="usd-toggle" /></div>
        <div class="switch"><div><strong data-i18n="chainNotif">Blockchain notifications</strong><br/><small data-i18n="chainNotifHelp">Incoming tx alerts from monitor.</small></div><input type="checkbox" id="chain-toggle" /></div>
        <div class="switch"><div><strong data-i18n="serviceNotif">Service notifications</strong><br/><small data-i18n="serviceNotifHelp">Bot service confirmations.</small></div><input type="checkbox" id="service-toggle" /></div>
        <button class="btn primary" id="settings-save" data-i18n="saveSettings">Save settings</button>
      </section>

      <div class="footer" data-i18n="footer">Liquid glass UI style for Telegram Mini App</div>
    </div>

    <script>
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const initData = tg?.initData || "";
      const root = document.documentElement;
      const state = { lang: "en", wallets: [], contacts: [], summary: null };

      const I18N = {
        en: {
          title: "Wallet Mini App", subtitle: "Private tracking with encrypted storage and Telegram alerts.",
          tabWallets: "Wallets", tabContacts: "Contacts", tabSettings: "Settings",
          network: "Network", address: "Address", label: "Label",
          addWallet: "Add wallet", addContact: "Add contact", saveSettings: "Save settings",
          language: "Language", btcThreshold: "BTC threshold", ethThreshold: "ETH threshold", usdtThreshold: "USDT threshold",
          walletUsage: "Wallet usage", contactUsage: "Contacts usage",
          showUsd: "Show USD estimate", showUsdHelp: "Display approximate fiat value.",
          chainNotif: "Blockchain notifications", chainNotifHelp: "Incoming tx alerts from monitor.",
          serviceNotif: "Service notifications", serviceNotifHelp: "Bot service confirmations.",
          searchWallets: "Search wallets", searchContacts: "Search contacts",
          footer: "Liquid glass UI style for Telegram Mini App", empty: "No items yet",
          deleted: "Deleted", updated: "Updated", addedWallet: "Wallet added", addedContact: "Contact added",
          saved: "Settings saved", edit: "Edit", save: "Save", cancel: "Cancel", delete: "Delete"
        },
        ru: {
          title: "Wallet Mini App", subtitle: "Приватный трекинг с шифрованием и Telegram-уведомлениями.",
          tabWallets: "Кошельки", tabContacts: "Контакты", tabSettings: "Настройки",
          network: "Сеть", address: "Адрес", label: "Подпись",
          addWallet: "Добавить кошелек", addContact: "Добавить контакт", saveSettings: "Сохранить настройки",
          language: "Язык", btcThreshold: "Порог BTC", ethThreshold: "Порог ETH", usdtThreshold: "Порог USDT",
          walletUsage: "Лимит кошельков", contactUsage: "Лимит знакомых",
          showUsd: "Показывать USD оценку", showUsdHelp: "Показывать примерную фиатную стоимость.",
          chainNotif: "Уведомления блокчейна", chainNotifHelp: "Оповещения о входящих транзакциях.",
          serviceNotif: "Сервисные уведомления", serviceNotifHelp: "Подтверждения от бота.",
          searchWallets: "Поиск кошельков", searchContacts: "Поиск контактов",
          footer: "Liquid glass UI для Telegram Mini App", empty: "Пока пусто",
          deleted: "Удалено", updated: "Обновлено", addedWallet: "Кошелек добавлен", addedContact: "Контакт добавлен",
          saved: "Настройки сохранены", edit: "Изменить", save: "Сохранить", cancel: "Отмена", delete: "Удалить"
        }
      };

      function t(key) { return (I18N[state.lang] || I18N.en)[key] || key; }
      function applySummary() {
        if (!state.summary) return;
        document.getElementById("wallet-usage").textContent = state.summary.walletCount + " / " + state.summary.walletLimit;
        document.getElementById("contact-usage").textContent = state.summary.contactCount + " / " + state.summary.contactLimit;
      }
      function setText() {
        document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
        document.getElementById("wallet-address").placeholder = state.lang === "ru" ? "Вставьте адрес кошелька" : "Paste wallet address";
        document.getElementById("contact-address").placeholder = state.lang === "ru" ? "Адрес отправителя" : "Known sender address";
        document.getElementById("contact-label").placeholder = state.lang === "ru" ? "Паша" : "Pasha";
        applySummary();
      }

      function normalizeHex(value) { return value && value.startsWith("#") ? value : null; }
      function isLight(hex) { if (!hex || hex.length !== 7) return false; const r = parseInt(hex.slice(1,3),16); const g = parseInt(hex.slice(3,5),16); const b = parseInt(hex.slice(5,7),16); return ((0.299*r + 0.587*g + 0.114*b) / 255) > 0.65; }
      function applyTelegramTheme() {
        const tp = tg?.themeParams || {};
        const bg = normalizeHex(tp.bg_color);
        const text = normalizeHex(tp.text_color);
        const hint = normalizeHex(tp.hint_color);
        const light = isLight(bg || "#0b0f19");
        if (bg) root.style.setProperty("--bg", light ? "linear-gradient(180deg," + bg + ",#edf2fb)" : "radial-gradient(1200px 600px at -20% -30%, #8ed1fc33, transparent 60%),radial-gradient(1000px 600px at 120% -10%, #d4a5ff30, transparent 55%),linear-gradient(180deg," + bg + ",#111827)");
        if (text) root.style.setProperty("--text", text);
        if (hint) root.style.setProperty("--muted", hint);
        root.style.setProperty("--card", light ? "rgba(255,255,255,.62)" : "rgba(255,255,255,.08)");
        root.style.setProperty("--card-strong", light ? "rgba(255,255,255,.82)" : "rgba(255,255,255,.14)");
        root.style.setProperty("--border", light ? "rgba(15,23,42,.13)" : "rgba(255,255,255,.18)");
      }
      applyTelegramTheme();
      tg?.onEvent?.("themeChanged", applyTelegramTheme);

      const tabs = document.querySelectorAll(".tab");
      const panels = document.querySelectorAll(".panel");
      function activatePanel(name) {
        tabs.forEach((x) => x.classList.remove("active"));
        panels.forEach((x) => { x.classList.remove("active"); x.classList.remove("entered"); });
        document.querySelector('.tab[data-tab="' + name + '"]').classList.add("active");
        const panel = document.getElementById(name);
        panel.classList.add("active");
        requestAnimationFrame(() => panel.classList.add("entered"));
      }
      tabs.forEach((tab) => tab.addEventListener("click", () => activatePanel(tab.dataset.tab)));
      activatePanel("wallets");

      const toast = document.getElementById("toast");
      function showToast(text, isError = false) {
        toast.textContent = text;
        toast.style.display = "block";
        toast.style.borderColor = isError ? "#ff9eb188" : "#88f0c488";
        setTimeout(() => { toast.style.display = "none"; }, 2400);
      }

      async function api(path, method = "GET", body = null) {
        const res = await fetch("/api" + path, {
          method,
          headers: { "content-type": "application/json", "authorization": "tma " + initData },
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
        return data;
      }

      function renderSkeleton(containerId, rows = 3) {
        const rootEl = document.getElementById(containerId);
        rootEl.innerHTML = "";
        for (let i = 0; i < rows; i += 1) {
          const box = document.createElement("div");
          box.className = "skeleton-item";
          box.innerHTML = '<div class="skeleton-line" style="width:45%"></div><div class="skeleton-line"></div>';
          rootEl.appendChild(box);
        }
      }

      function searchable(items, getter, query) {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => getter(item).toLowerCase().includes(q));
      }

      function emptyView() { const div = document.createElement("div"); div.className = "empty"; div.textContent = t("empty"); return div; }

      async function loadWallets() {
        renderSkeleton("wallet-list");
        const data = await api("/wallets");
        state.wallets = data.items;
        renderWallets();
        await loadSummary();
      }
      function renderWallets() {
        const list = document.getElementById("wallet-list");
        const filtered = searchable(state.wallets, (x) => x.network + " " + x.address, document.getElementById("wallet-search").value);
        list.innerHTML = "";
        if (!filtered.length) return list.appendChild(emptyView());
        filtered.forEach((item) => {
          const card = document.createElement("div");
          card.className = "item";
          card.innerHTML = '<div class="item-top"><div class="item-title">' + item.network.toUpperCase() + '</div></div><div class="item-sub">' + item.address + '</div>';
          const actions = document.createElement("div");
          actions.className = "item-actions";
          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = t("delete");
          del.addEventListener("click", async () => { await api("/wallets/" + item.id, "DELETE"); showToast(t("deleted")); await loadWallets(); });
          actions.appendChild(del);
          card.appendChild(actions);
          list.appendChild(card);
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
        const list = document.getElementById("contact-list");
        const filtered = searchable(state.contacts, (x) => x.label + " " + x.address + " " + x.network, document.getElementById("contact-search").value);
        list.innerHTML = "";
        if (!filtered.length) return list.appendChild(emptyView());
        filtered.forEach((item) => {
          const card = document.createElement("div");
          card.className = "item";
          card.innerHTML = '<div class="item-top"><div class="item-title">' + item.label + " · " + item.network.toUpperCase() + '</div></div><div class="item-sub">' + item.address + "</div>";
          const actions = document.createElement("div");
          actions.className = "item-actions";
          const edit = document.createElement("button");
          edit.className = "btn ghost";
          edit.textContent = t("edit");
          edit.addEventListener("click", () => {
            const wrap = document.createElement("div");
            wrap.className = "field";
            const input = document.createElement("input");
            input.value = item.label;
            const save = document.createElement("button");
            save.className = "btn primary";
            save.textContent = t("save");
            save.addEventListener("click", async () => { await api("/contacts/" + item.id, "PATCH", { label: input.value.trim() }); showToast(t("updated")); await loadContacts(); });
            const cancel = document.createElement("button");
            cancel.className = "btn ghost";
            cancel.textContent = t("cancel");
            cancel.addEventListener("click", renderContacts);
            wrap.appendChild(input); wrap.appendChild(save); wrap.appendChild(cancel);
            card.appendChild(wrap);
          });
          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = t("delete");
          del.addEventListener("click", async () => { await api("/contacts/" + item.id, "DELETE"); showToast(t("deleted")); await loadContacts(); });
          actions.appendChild(edit); actions.appendChild(del);
          card.appendChild(actions);
          list.appendChild(card);
        });
      }

      async function loadSummary() {
        const data = await api("/summary");
        state.summary = data.summary;
        applySummary();
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

      document.getElementById("wallet-add").addEventListener("click", async () => {
        try {
          await api("/wallets", "POST", { network: document.getElementById("wallet-network").value, address: document.getElementById("wallet-address").value.trim() });
          document.getElementById("wallet-address").value = "";
          showToast(t("addedWallet"));
          await loadWallets();
        } catch (error) { showToast(error.message, true); }
      });

      document.getElementById("contact-add").addEventListener("click", async () => {
        try {
          await api("/contacts", "POST", { network: document.getElementById("contact-network").value, address: document.getElementById("contact-address").value.trim(), label: document.getElementById("contact-label").value.trim() });
          document.getElementById("contact-address").value = "";
          document.getElementById("contact-label").value = "";
          showToast(t("addedContact"));
          await loadContacts();
        } catch (error) { showToast(error.message, true); }
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
        } catch (error) { showToast(error.message, true); }
      });

      ["wallet-search", "contact-search"].forEach((id) => {
        let timer = null;
        document.getElementById(id).addEventListener("input", () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            if (id === "wallet-search") renderWallets();
            if (id === "contact-search") renderContacts();
          }, 160);
        });
      });

      (async function init() {
        if (!initData) showToast("Open from Telegram to authorize", true);
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
