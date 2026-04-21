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
        --accent: #72d0ff;
        --danger: #ff7d93;
        --ok: #78f5bb;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; font-family: Inter, Segoe UI, Arial, sans-serif; color: var(--text); background: var(--bg); min-height: 100%; }
      body { padding: 16px 12px 24px; }
      .shell { max-width: 920px; margin: 0 auto; display: grid; gap: 12px; }
      .glass {
        background: linear-gradient(140deg, rgba(255,255,255,.16), rgba(255,255,255,.04));
        border: 1px solid var(--border);
        box-shadow: 0 8px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.3);
        backdrop-filter: blur(16px) saturate(150%);
        -webkit-backdrop-filter: blur(16px) saturate(150%);
        border-radius: 18px;
        transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
      }
      .glass:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 35px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.28);
      }
      .hero { padding: 14px; display: grid; gap: 10px; }
      .title { font-size: 21px; font-weight: 700; letter-spacing: .2px; }
      .subtitle { font-size: 13px; color: var(--muted); }
      .tabs { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; padding: 8px; }
      .tab {
        border: 1px solid transparent; border-radius: 12px; padding: 9px 6px;
        text-align: center; font-size: 13px; color: #dce7ff; cursor: pointer; user-select: none;
        transition: all .22s ease;
      }
      .tab.active { background: var(--card-strong); border-color: var(--border); font-weight: 600; transform: translateY(-1px); }
      .panel { padding: 12px; display: none; gap: 10px; opacity: 0; transform: translateY(6px) scale(.995); }
      .panel.active { display: grid; }
      .panel.entered { opacity: 1; transform: translateY(0) scale(1); transition: all .26s cubic-bezier(.2,.9,.2,1); }
      .row { display: flex; gap: 8px; flex-wrap: wrap; }
      .field { display: grid; gap: 6px; flex: 1; min-width: 160px; }
      label { font-size: 12px; color: var(--muted); }
      input, select {
        width: 100%; border-radius: 10px; border: 1px solid var(--border); background: var(--card);
        color: var(--text); outline: none; padding: 10px 12px; font-size: 14px;
      }
      input::placeholder { color: #b4c1d8aa; }
      .btn {
        border: 1px solid var(--border); background: var(--card); color: var(--text);
        border-radius: 12px; padding: 10px 12px; cursor: pointer; font-weight: 600;
        transition: transform .18s ease, filter .18s ease, background .18s ease;
      }
      .btn:active { transform: scale(.98); }
      .btn:hover { filter: brightness(1.05); }
      .btn.primary { background: linear-gradient(140deg, #74d4ffcc, #8ea7ffb3); color: #061426; border-color: #b9e6ff88; }
      .btn.danger { border-color: #ff90a555; color: #ffd4dc; }
      .btn.ghost { border-color: var(--border); color: var(--muted); }
      .list { display: grid; gap: 8px; }
      .item {
        border: 1px solid var(--border); background: var(--card); border-radius: 12px;
        padding: 10px; display: grid; gap: 7px;
        animation: pop .22s cubic-bezier(.2,.9,.2,1);
      }
      .item-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
      .item-title { font-size: 14px; font-weight: 600; }
      .item-sub { font-size: 12px; color: var(--muted); word-break: break-all; }
      .empty { color: var(--muted); font-size: 13px; text-align: center; padding: 18px 10px; }
      .skeleton-item {
        border: 1px solid var(--border); background: var(--card); border-radius: 12px; padding: 12px;
      }
      .skeleton-line {
        height: 10px; border-radius: 999px;
        background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.20), rgba(255,255,255,.06));
        background-size: 220% 100%;
        animation: shimmer 1.2s infinite linear;
      }
      .skeleton-line + .skeleton-line { margin-top: 10px; }
      .toast {
        position: sticky; top: 8px; z-index: 10; padding: 10px 12px; border-radius: 10px;
        border: 1px solid var(--border); background: var(--card-strong); display: none;
      }
      .toast.ok { border-color: #88f0c488; }
      .toast.err { border-color: #ff9eb188; }
      .switch { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); }
      .switch small { color: var(--muted); }
      .footer { font-size: 11px; color: var(--muted); text-align: center; opacity: .9; padding-top: 2px; }
      .item-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .edit-wrap { display: grid; gap: 8px; }
      @keyframes pop {
        from { opacity: 0; transform: translateY(8px) scale(.99); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes shimmer {
        from { background-position: 200% 0; }
        to { background-position: -20% 0; }
      }
      @media (max-width: 520px) { .tabs { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    </style>
  </head>
  <body>
    <div class="shell">
      <div id="toast" class="toast"></div>
      <section class="hero glass">
        <div class="title">Wallet Mini App</div>
        <div class="subtitle">Private tracking with encrypted storage and Telegram alerts.</div>
      </section>

      <section class="glass tabs">
        <div class="tab active" data-tab="wallets">Wallets</div>
        <div class="tab" data-tab="contacts">Contacts</div>
        <div class="tab" data-tab="links">Links</div>
        <div class="tab" data-tab="settings">Settings</div>
      </section>

      <section id="wallets" class="glass panel active">
        <div class="row">
          <div class="field">
            <label>Network</label>
            <select id="wallet-network"><option value="btc">BTC</option><option value="eth">ETH</option></select>
          </div>
          <div class="field">
            <label>Address</label>
            <input id="wallet-address" placeholder="Paste wallet address" />
          </div>
        </div>
        <button class="btn primary" id="wallet-add">Add wallet</button>
        <div id="wallet-list" class="list"></div>
      </section>

      <section id="contacts" class="glass panel">
        <div class="row">
          <div class="field">
            <label>Network</label>
            <select id="contact-network"><option value="btc">BTC</option><option value="eth">ETH</option></select>
          </div>
          <div class="field">
            <label>Address</label>
            <input id="contact-address" placeholder="Known sender address" />
          </div>
          <div class="field">
            <label>Label</label>
            <input id="contact-label" placeholder="Pasha" />
          </div>
        </div>
        <button class="btn primary" id="contact-add">Add contact</button>
        <div id="contact-list" class="list"></div>
      </section>

      <section id="links" class="glass panel">
        <div class="row">
          <div class="field">
            <label>URL</label>
            <input id="link-url" placeholder="https://..." />
          </div>
          <div class="field">
            <label>Title</label>
            <input id="link-title" placeholder="Useful dashboard" />
          </div>
        </div>
        <button class="btn primary" id="link-add">Add link</button>
        <div id="link-list" class="list"></div>
      </section>

      <section id="settings" class="glass panel">
        <div class="row">
          <div class="field"><label>Language</label><select id="lang"><option value="ru">RU</option><option value="en">EN</option></select></div>
          <div class="field"><label>BTC threshold</label><input id="btc-th" placeholder="0.001" /></div>
          <div class="field"><label>ETH threshold</label><input id="eth-th" placeholder="0.01" /></div>
          <div class="field"><label>USDT threshold</label><input id="usdt-th" placeholder="50" /></div>
        </div>
        <div class="switch"><div><strong>Show USD estimate</strong><br/><small>Display approximate fiat value.</small></div><input type="checkbox" id="usd-toggle" /></div>
        <div class="switch"><div><strong>Blockchain notifications</strong><br/><small>Incoming tx alerts from monitor.</small></div><input type="checkbox" id="chain-toggle" /></div>
        <div class="switch"><div><strong>Service notifications</strong><br/><small>Bot service confirmations.</small></div><input type="checkbox" id="service-toggle" /></div>
        <button class="btn primary" id="settings-save">Save settings</button>
      </section>

      <div class="footer">Liquid glass UI style for Telegram Mini App</div>
    </div>

    <script>
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const initData = tg?.initData || "";
      const root = document.documentElement;

      function normalizeHex(value) {
        if (!value || typeof value !== "string") return null;
        if (value.startsWith("#")) return value;
        return null;
      }

      function isLight(hex) {
        if (!hex || hex.length !== 7) return false;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luma > 0.65;
      }

      function applyTelegramTheme() {
        const tp = tg?.themeParams || {};
        const bg = normalizeHex(tp.bg_color);
        const text = normalizeHex(tp.text_color);
        const hint = normalizeHex(tp.hint_color);
        const button = normalizeHex(tp.button_color);
        const isLightTheme = isLight(bg || "#0b0f19");

        if (bg) {
          root.style.setProperty("--bg", isLightTheme
            ? "linear-gradient(180deg, " + bg + ", #edf2fb)"
            : "radial-gradient(1200px 600px at -20% -30%, #8ed1fc33, transparent 60%), radial-gradient(1000px 600px at 120% -10%, #d4a5ff30, transparent 55%), linear-gradient(180deg, " + bg + ", #111827)");
        }
        if (text) root.style.setProperty("--text", text);
        if (hint) root.style.setProperty("--muted", hint);
        if (button) root.style.setProperty("--accent", button);

        if (isLightTheme) {
          root.style.setProperty("--card", "rgba(255,255,255,.62)");
          root.style.setProperty("--card-strong", "rgba(255,255,255,.82)");
          root.style.setProperty("--border", "rgba(15,23,42,.13)");
        } else {
          root.style.setProperty("--card", "rgba(255,255,255,.08)");
          root.style.setProperty("--card-strong", "rgba(255,255,255,.14)");
          root.style.setProperty("--border", "rgba(255,255,255,.18)");
        }
      }
      applyTelegramTheme();
      tg?.onEvent?.("themeChanged", applyTelegramTheme);

      const tabs = document.querySelectorAll(".tab");
      const panels = document.querySelectorAll(".panel");
      function activatePanel(name) {
        tabs.forEach((x) => x.classList.remove("active"));
        panels.forEach((x) => {
          x.classList.remove("active");
          x.classList.remove("entered");
        });
        document.querySelector('.tab[data-tab="' + name + '"]').classList.add("active");
        const panel = document.getElementById(name);
        panel.classList.add("active");
        requestAnimationFrame(() => panel.classList.add("entered"));
      }
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const name = tab.dataset.tab;
          activatePanel(name);
        });
      });
      activatePanel("wallets");

      const toast = document.getElementById("toast");
      function showToast(text, isError = false) {
        toast.textContent = text;
        toast.className = "toast " + (isError ? "err" : "ok");
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 2500);
      }

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
        if (!response.ok) throw new Error(data.error || ("HTTP " + response.status));
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

      function renderList(containerId, items, renderItemBuilder) {
        const root = document.getElementById(containerId);
        if (!items.length) {
          root.innerHTML = '<div class="empty">No items yet</div>';
          return;
        }
        root.innerHTML = "";
        for (const item of items) {
          root.appendChild(renderItemBuilder(item));
        }
      }

      async function loadWallets() {
        renderSkeleton("wallet-list");
        const data = await api("/wallets");
        renderList("wallet-list", data.items, (item) => {
          const card = document.createElement("div");
          card.className = "item";
          card.innerHTML = '<div class="item-top"><div class="item-title">' + item.network.toUpperCase() + '</div></div><div class="item-sub">' + item.address + '</div>';
          const actions = document.createElement("div");
          actions.className = "item-actions";
          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = "Delete";
          del.addEventListener("click", async () => {
            await api("/wallets/" + item.id, "DELETE");
            showToast("Deleted");
            await loadWallets();
          });
          actions.appendChild(del);
          card.appendChild(actions);
          return card;
        });
      }

      async function loadContacts() {
        renderSkeleton("contact-list");
        const data = await api("/contacts");
        renderList("contact-list", data.items, (item) => {
          const card = document.createElement("div");
          card.className = "item";
          card.innerHTML = '<div class="item-top"><div class="item-title">' + item.label + ' · ' + item.network.toUpperCase() + '</div></div><div class="item-sub">' + item.address + '</div>';
          const actions = document.createElement("div");
          actions.className = "item-actions";

          const edit = document.createElement("button");
          edit.className = "btn ghost";
          edit.textContent = "Edit";
          edit.addEventListener("click", () => {
            const wrap = document.createElement("div");
            wrap.className = "edit-wrap";
            const input = document.createElement("input");
            input.value = item.label;
            const save = document.createElement("button");
            save.className = "btn primary";
            save.textContent = "Save";
            save.addEventListener("click", async () => {
              await api("/contacts/" + item.id, "PATCH", { label: input.value.trim() });
              showToast("Updated");
              await loadContacts();
            });
            const cancel = document.createElement("button");
            cancel.className = "btn ghost";
            cancel.textContent = "Cancel";
            cancel.addEventListener("click", () => loadContacts());
            wrap.appendChild(input);
            wrap.appendChild(save);
            wrap.appendChild(cancel);
            card.appendChild(wrap);
          });

          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = "Delete";
          del.addEventListener("click", async () => {
            await api("/contacts/" + item.id, "DELETE");
            showToast("Deleted");
            await loadContacts();
          });

          actions.appendChild(edit);
          actions.appendChild(del);
          card.appendChild(actions);
          return card;
        });
      }

      async function loadLinks() {
        renderSkeleton("link-list");
        const data = await api("/links");
        renderList("link-list", data.items, (item) => {
          const card = document.createElement("div");
          card.className = "item";
          card.innerHTML = '<div class="item-top"><div class="item-title">' + item.title + '</div></div><div class="item-sub">' + item.url + '</div>';
          const actions = document.createElement("div");
          actions.className = "item-actions";

          const edit = document.createElement("button");
          edit.className = "btn ghost";
          edit.textContent = "Edit title";
          edit.addEventListener("click", () => {
            const wrap = document.createElement("div");
            wrap.className = "edit-wrap";
            const input = document.createElement("input");
            input.value = item.title;
            const save = document.createElement("button");
            save.className = "btn primary";
            save.textContent = "Save";
            save.addEventListener("click", async () => {
              await api("/links/" + item.id, "PATCH", { title: input.value.trim() });
              showToast("Updated");
              await loadLinks();
            });
            const cancel = document.createElement("button");
            cancel.className = "btn ghost";
            cancel.textContent = "Cancel";
            cancel.addEventListener("click", () => loadLinks());
            wrap.appendChild(input);
            wrap.appendChild(save);
            wrap.appendChild(cancel);
            card.appendChild(wrap);
          });

          const del = document.createElement("button");
          del.className = "btn danger";
          del.textContent = "Delete";
          del.addEventListener("click", async () => {
            await api("/links/" + item.id, "DELETE");
            showToast("Deleted");
            await loadLinks();
          });

          actions.appendChild(edit);
          actions.appendChild(del);
          card.appendChild(actions);
          return card;
        });
      }

      async function loadSettings() {
        const data = await api("/settings");
        const s = data.settings;
        document.getElementById("lang").value = s.language;
        document.getElementById("btc-th").value = s.btcThreshold;
        document.getElementById("eth-th").value = s.ethThreshold;
        document.getElementById("usdt-th").value = s.usdtThreshold;
        document.getElementById("usd-toggle").checked = s.showUsdEstimate;
        document.getElementById("chain-toggle").checked = s.blockchainNotificationsEnabled;
        document.getElementById("service-toggle").checked = s.serviceNotificationsEnabled;
      }

      document.getElementById("wallet-add").addEventListener("click", async () => {
        try {
          await api("/wallets", "POST", {
            network: document.getElementById("wallet-network").value,
            address: document.getElementById("wallet-address").value.trim()
          });
          document.getElementById("wallet-address").value = "";
          showToast("Wallet added");
          await loadWallets();
        } catch (error) { showToast(error.message, true); }
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
          showToast("Contact added");
          await loadContacts();
        } catch (error) { showToast(error.message, true); }
      });

      document.getElementById("link-add").addEventListener("click", async () => {
        try {
          await api("/links", "POST", {
            url: document.getElementById("link-url").value.trim(),
            title: document.getElementById("link-title").value.trim()
          });
          document.getElementById("link-url").value = "";
          document.getElementById("link-title").value = "";
          showToast("Link added");
          await loadLinks();
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
          showToast("Settings saved");
        } catch (error) { showToast(error.message, true); }
      });

      (async function init() {
        if (!initData) showToast("Open from Telegram to authorize", true);
        try {
          await Promise.all([loadWallets(), loadContacts(), loadLinks(), loadSettings()]);
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
