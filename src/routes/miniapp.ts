import { Hono } from "hono";
import type { Env } from "../types/env";

const miniapp = new Hono<{ Bindings: Env }>();

function pageHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>VOROBEY: Check Mini App</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
      :root { --bg:#0f1116; --card:#171a23; --muted:#8f96a8; --text:#e8ecf7; --line:#2a3142; --btn:#4f7cff; --ok:#2ecc71; --bad:#ff5f7a; }
      * { box-sizing: border-box; }
      body { margin:0; padding:0; background:var(--bg); color:var(--text); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
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
      .card { background: var(--card); border:1px solid var(--line); border-radius: 14px; padding: 12px; margin-bottom: 10px; }
      .card h3 { margin: 0 0 10px; font-size: 15px; }
      .grid { display:grid; gap: 8px; }
      .row { display:grid; gap: 6px; }
      label { font-size: 12px; color: var(--muted); }
      input, select, textarea { width:100%; border:1px solid var(--line); background:#111521; color:var(--text); border-radius: 10px; min-height: 40px; padding: 9px 10px; font-size: 14px; }
      textarea { min-height: 78px; resize: vertical; }
      .btn { border:0; border-radius: 10px; min-height: 40px; padding: 8px 11px; font-size: 14px; font-weight: 700; cursor:pointer; }
      .btn.primary { background: var(--btn); color: white; }
      .btn.ghost { background: transparent; border:1px solid var(--line); color: var(--text); }
      .btn.bad { background: color-mix(in srgb, var(--bad) 20%, transparent); border:1px solid color-mix(in srgb, var(--bad) 45%, transparent); color: #ffb9c6; }
      .btn.ok { background: color-mix(in srgb, var(--ok) 20%, transparent); border:1px solid color-mix(in srgb, var(--ok) 45%, transparent); color: #b9f7d4; }
      .btns { display:flex; gap: 8px; flex-wrap: wrap; }
      .item { border-top: 1px solid var(--line); padding: 10px 0; }
      .item:first-child { border-top: 0; padding-top: 0; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
      .muted { color: var(--muted); font-size: 12px; }
      .toast { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: #131826; color: var(--text); border:1px solid var(--line); padding: 10px 12px; border-radius: 10px; display:none; z-index: 20; max-width: calc(100% - 20px); }
      .hidden { display:none !important; }
    </style>
  </head>
  <body>
    <div id="toast" class="toast"></div>
    <div class="wrap">
      <div class="head">
        <div class="title">VOROBEY: Check</div>
        <div class="sub">Mini App v2: bot parity + admin tools</div>
        <div class="stats">
          <div class="stat"><div class="k">Wallets</div><div id="stat-wallets" class="v">0 / 10</div></div>
          <div class="stat"><div class="k">Contacts</div><div id="stat-contacts" class="v">0 / 50</div></div>
          <div class="stat"><div class="k">Role</div><div id="stat-role" class="v">User</div></div>
        </div>
        <div class="tabs" id="tabs">
          <div class="tab active" data-tab="wallets">Wallets</div>
          <div class="tab" data-tab="contacts">Contacts</div>
          <div class="tab" data-tab="history">History</div>
          <div class="tab" data-tab="cabinet">Cabinet</div>
          <div class="tab" data-tab="settings">Settings</div>
          <div class="tab hidden" data-tab="admin" id="admin-tab">Admin</div>
        </div>
      </div>

      <section id="wallets" class="panel active">
        <div class="card">
          <h3>Add tracked wallet</h3>
          <div class="grid">
            <div class="row"><label>Address</label><input id="wallet-address" placeholder="0x... / bc1... / T..." /></div>
            <div class="btns"><button class="btn primary" id="wallet-add">Add wallet</button></div>
          </div>
        </div>
        <div class="card">
          <h3>Tracked wallets</h3>
          <div id="wallet-list"></div>
        </div>
      </section>

      <section id="contacts" class="panel">
        <div class="card">
          <h3>Add known wallet</h3>
          <div class="grid">
            <div class="row"><label>Address</label><input id="contact-address" placeholder="Address" /></div>
            <div class="row"><label>Label</label><input id="contact-label" placeholder="Label" /></div>
            <div class="btns"><button class="btn primary" id="contact-add">Add contact</button></div>
          </div>
        </div>
        <div class="card"><h3>Known wallets</h3><div id="contact-list"></div></div>
      </section>

      <section id="history" class="panel">
        <div class="card"><h3>Transfer history</h3><div id="history-list"></div></div>
      </section>

      <section id="cabinet" class="panel">
        <div class="card"><h3>Subscription</h3><div id="cabinet-subscription"></div></div>
        <div class="card">
          <h3>Payment</h3>
          <div class="grid">
            <div class="row"><label>Network</label><select id="pay-network"><option value="bsc">USDT BEP20</option><option value="trc20">USDT TRC20</option></select></div>
            <div class="btns">
              <button class="btn primary" id="pay-create">Create invoice</button>
              <button class="btn ok" id="pay-check">Check payment</button>
            </div>
            <div id="pay-info" class="muted"></div>
          </div>
        </div>
        <div class="card">
          <h3>Promo code</h3>
          <div class="grid">
            <div class="row"><label>Code</label><input id="promo-code" placeholder="PROMO2026" /></div>
            <div class="btns"><button class="btn primary" id="promo-activate">Activate promo</button></div>
          </div>
        </div>
      </section>

      <section id="settings" class="panel">
        <div class="card">
          <h3>Settings</h3>
          <div class="grid">
            <div class="row"><label>Language</label><select id="set-lang"><option value="ru">RU</option><option value="en">EN</option></select></div>
            <div class="row"><label>BTC threshold</label><input id="set-btc" /></div>
            <div class="row"><label>ETH threshold</label><input id="set-eth" /></div>
            <div class="row"><label>USDT threshold</label><input id="set-usdt" /></div>
            <div class="btns"><button class="btn primary" id="settings-save">Save settings</button></div>
          </div>
        </div>
      </section>

      <section id="admin" class="panel hidden">
        <div class="card">
          <h3>Generate promo code</h3>
          <div class="grid">
            <div class="row"><label>Code</label><input id="admin-promo-code" placeholder="SPRING2026" /></div>
            <div class="row"><label>Duration days</label><input id="admin-promo-days" type="number" value="30" /></div>
            <div class="row"><label>Max activations</label><input id="admin-promo-max" type="number" placeholder="Optional" /></div>
            <div class="row"><label>Bonus percent (e.g. 20 = +20% days)</label><input id="admin-promo-percent" type="number" value="0" /></div>
            <div class="btns"><button class="btn primary" id="admin-promo-create">Create promo</button></div>
          </div>
        </div>
        <div class="card"><h3>Promo codes</h3><div id="admin-promo-list"></div></div>
        <div class="card">
          <h3>Stop wallets</h3>
          <div class="grid">
            <div class="row"><label>Network</label><select id="admin-stop-network"><option value="btc">BTC</option><option value="eth">ETH</option><option value="bsc">BEP20</option><option value="trc20">TRC20</option></select></div>
            <div class="row"><label>Address</label><input id="admin-stop-address" placeholder="Address" /></div>
            <div class="btns">
              <button class="btn primary" id="admin-stop-add">Add to stop list</button>
              <button class="btn bad" id="admin-stop-remove-btn">Remove from stop list</button>
            </div>
          </div>
          <div id="admin-stop-list"></div>
        </div>
        <div class="card"><h3>Link audit</h3><div id="admin-link-list"></div></div>
        <div class="card"><h3>Wallet reputation</h3><div id="admin-reputation-list"></div></div>
      </section>
    </div>

    <script>
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const initData = tg?.initData || "";

      const state = { me: null, wallets: [], contacts: [], history: [], subscription: null, payment: null, summary: null, lang: "ru" };
      const $ = (id) => document.getElementById(id);
      function msg(ru, en) {
        return state.lang === "en" ? en : ru;
      }
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
        $("stat-role").textContent = state.me?.isAdmin ? "Admin" : "User";
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
          append("wallet-list", '<div class="muted">No wallets yet.</div>');
          return;
        }
        state.wallets.forEach((w) => {
          append(
            "wallet-list",
            '<div><b>[' + String(w.network).toUpperCase() + "]</b> <span class='mono'>" + w.address + "</span></div>" +
              "<div class='muted'>Assets: " +
              [w.monitorEthNative ? "ETH" : "", w.monitorUsdtErc20 ? "USDT ERC20" : "", w.monitorUsdtBep20 ? "USDT BEP20" : "", w.monitorUsdtTrc20 ? "USDT TRC20" : ""]
                .filter(Boolean)
                .join(", ") +
              "</div>" +
              "<div class='btns'><button class='btn ghost' data-bal='" +
              w.id +
              "'>Balance</button><button class='btn bad' data-del-wallet='" +
              w.id +
              "'>Delete</button></div><div id='bal-" +
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
          append("contact-list", '<div class="muted">No contacts yet.</div>');
          return;
        }
        state.contacts.forEach((it) => {
          append(
            "contact-list",
            "<div><b>" +
              it.label +
              "</b> [" +
              String(it.network).toUpperCase() +
              "]</div><div class='mono muted'>" +
              it.address +
              "</div><div class='btns'><button class='btn bad' data-del-contact='" +
              it.id +
              "'>Delete</button></div>"
          );
        });
      }
      async function loadHistory() {
        const data = await api("/transfer-history?limit=100");
        state.history = data.items || [];
        clearNode("history-list");
        if (!state.history.length) {
          append("history-list", '<div class="muted">No transfers yet.</div>');
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
        const lang = s.language === "en" ? "en" : "ru";
        state.lang = lang;
        document.documentElement.lang = lang;
        $("set-lang").value = lang;
        $("set-btc").value = s.btcThreshold;
        $("set-eth").value = s.ethThreshold;
        $("set-usdt").value = s.usdtThreshold;
      }
      async function loadSubscription() {
        const data = await api("/subscription");
        state.subscription = data.subscription;
        state.payment = data.activePayment;
        const s = data.subscription;
        $("cabinet-subscription").innerHTML =
          "<div><b>Plan:</b> <code>" +
          s.planCode +
          "</code></div><div><b>Status:</b> " +
          s.status +
          "</div><div><b>Valid until:</b> " +
          fmtDate(s.expiresAt) +
          "</div><div><b>Promo activations:</b> " +
          s.promoActivations +
          "</div>";
        if (data.activePayment) {
          $("pay-info").innerHTML =
            "Pending invoice: <b>" +
            data.activePayment.amountText +
            " " +
            data.activePayment.asset +
            "</b><br/>Address: <span class='mono'>" +
            data.activePayment.payAddress +
            "</span><br/>Expires: " +
            fmtDate(data.activePayment.expiresAt);
        } else {
          $("pay-info").textContent = "No active invoice.";
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
              (p.isActive ? "active" : "disabled") +
              "</div><div class='muted'>uses: " +
              p.activationsCount +
              " / " +
              (p.maxActivations ?? "∞") +
              "</div><div class='btns'><button class='btn ghost' data-promo-toggle='" +
              p.id +
              "' data-next-active='" +
              (p.isActive ? "0" : "1") +
              "'>" +
              (p.isActive ? "Disable" : "Enable") +
              "</button></div>"
          );
        });
        clearNode("admin-stop-list");
        (stop.items || []).forEach((s) =>
          append(
            "admin-stop-list",
            "<div>[" +
              String(s.network).toUpperCase() +
              "] <span class='mono'>" +
              s.address +
              "</span></div><div class='btns'><button class='btn bad' data-stop-remove='" +
              s.network +
              "' data-stop-address='" +
              s.address +
              "'>Remove</button></div>"
          )
        );
        if (!(stop.items || []).length) append("admin-stop-list", '<div class="muted">No stop wallets.</div>');
        clearNode("admin-link-list");
        (links.items || []).forEach((it) =>
          append("admin-link-list", "<div>" + it.entityType + " · [" + String(it.network).toUpperCase() + "] " + shortAddr(it.address) + "</div><div class='muted'>user " + it.actorUserId + " · " + fmtDate(it.createdAt) + "</div>")
        );
        if (!(links.items || []).length) append("admin-link-list", '<div class="muted">No link logs.</div>');
        clearNode("admin-reputation-list");
        (rep.items || []).forEach((it) =>
          append("admin-reputation-list", "<div>[" + String(it.network).toUpperCase() + "] " + shortAddr(it.address) + "</div><div class='muted'>score: " + it.score + " (👍 " + it.likesCount + " / 👎 " + it.dislikesCount + ")</div>")
        );
      }

      document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));

      $("wallet-add").addEventListener("click", async () => {
        try {
          const address = $("wallet-address").value.trim();
          const detected = await api("/detect-network", "POST", { address });
          const candidates = detected.candidates || [];
          if (!candidates.length) throw new Error("Could not detect network.");
          const network = candidates[0];
          await api("/wallets", "POST", { network, address, monitorEthNative: true, monitorUsdtErc20: true, monitorUsdtBep20: true, monitorUsdtTrc20: true });
          $("wallet-address").value = "";
          toast("Wallet added.");
          await Promise.all([loadWallets(), loadSummary()]);
          renderSummary();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("contact-add").addEventListener("click", async () => {
        try {
          const address = $("contact-address").value.trim();
          const label = $("contact-label").value.trim();
          const detected = await api("/detect-network", "POST", { address });
          const candidates = detected.candidates || [];
          if (!candidates.length) throw new Error("Could not detect network.");
          await api("/contacts", "POST", { network: candidates[0], address, label });
          $("contact-address").value = "";
          $("contact-label").value = "";
          toast("Contact added.");
          await Promise.all([loadContacts(), loadSummary()]);
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
          toast(msg("Настройки сохранены.", "Settings saved."));
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("pay-create").addEventListener("click", async () => {
        try {
          const data = await api("/subscription/invoice", "POST", { network: $("pay-network").value });
          const inv = data.invoice;
          $("pay-info").innerHTML =
            "Invoice: <b>" +
            inv.amountText +
            " " +
            inv.asset +
            "</b><br/>Address:<br/><span class='mono'>" +
            inv.payAddress +
            "</span><br/>Expires: " +
            fmtDate(inv.expiresAt);
          toast("Invoice created.");
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("pay-check").addEventListener("click", async () => {
        try {
          const data = await api("/subscription/check", "POST", {});
          if (data.result?.paid > 0) {
            toast("Payment confirmed.");
          } else {
            toast("Payment not found yet.");
          }
          await loadSubscription();
        } catch (e) { toast(e.message || "Error", true); }
      });

      $("promo-activate").addEventListener("click", async () => {
        try {
          const code = $("promo-code").value.trim();
          await api("/promo/activate", "POST", { code });
          $("promo-code").value = "";
          toast("Promo activated.");
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
          toast("Promo code created.");
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
          toast("Added to stop list.");
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
          toast("Removed from stop list.");
          await loadAdmin();
        } catch (e) { toast(e.message || "Error", true); }
      });

      document.body.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const delWallet = target.dataset.delWallet;
        if (delWallet) {
          try {
            await api("/wallets/" + delWallet, "DELETE");
            toast("Wallet deleted.");
            await Promise.all([loadWallets(), loadSummary()]);
            renderSummary();
          } catch (e) { toast(e.message || "Error", true); }
          return;
        }
        const delContact = target.dataset.delContact;
        if (delContact) {
          try {
            await api("/contacts/" + delContact, "DELETE");
            toast("Contact deleted.");
            await Promise.all([loadContacts(), loadSummary()]);
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
            toast("Promo state updated.");
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
            toast("Removed from stop list.");
            await loadAdmin();
          } catch (e) { toast(e.message || "Error", true); }
        }
      });

      (async function init() {
        if (!initData) toast(msg("Откройте Mini App из Telegram для авторизации.", "Open from Telegram to authorize."), true);
        try {
          await loadMe();
          applyAccessRestrictions();
          if (state.me?.isAdmin || state.me?.hasFullAccess) {
            await Promise.all([loadSummary(), loadWallets(), loadContacts(), loadHistory(), loadSettings(), loadSubscription()]);
            if (state.me?.isAdmin) {
              await loadAdmin();
            }
          } else {
            await loadSubscription();
            toast(
              msg(
                "Сначала оплатите подписку в разделе Cabinet, затем откроется весь функционал.",
                "Pay subscription in Cabinet first, then full functionality will unlock."
              ),
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
