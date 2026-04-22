import { DEFAULT_SETTINGS, MAX_CONTACTS, MAX_WALLETS } from "./constants";
import { addressHash, decryptForUser, encryptForUser } from "./crypto";
import { normalizeAddress } from "./validation";
import type { Env, Language } from "../types/env";

export type WalletItem = {
  id: string;
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  monitorEthNative: boolean;
  monitorUsdtErc20: boolean;
  monitorUsdtBep20: boolean;
  monitorUsdtTrc20: boolean;
  createdAt: string;
};

export type ContactItem = {
  id: string;
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  label: string;
  createdAt: string;
};

export type UserSettings = {
  language: Language;
  btcThreshold: string;
  ethThreshold: string;
  usdtThreshold: string;
  showUsdEstimate: boolean;
  blockchainNotificationsEnabled: boolean;
  serviceNotificationsEnabled: boolean;
};

export type StoredBotSession = {
  flow: string;
  payload?: Record<string, unknown>;
};

export type MonitoredWallet = {
  id: string;
  userId: string;
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  monitorEthNative: boolean;
  monitorUsdtErc20: boolean;
  monitorUsdtBep20: boolean;
  monitorUsdtTrc20: boolean;
};

export type UsageSummary = {
  walletCount: number;
  walletLimit: number;
  contactCount: number;
  contactLimit: number;
};

export type ReputationEntry = {
  userId: string;
  score: number;
  updatedAt: string;
};

export type StoppedWallet = {
  id: string;
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  addedByUserId: string;
  createdAt: string;
};

export type LinkAuditEntry = {
  id: string;
  actorUserId: string;
  entityType: "wallet" | "contact";
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  label: string | null;
  createdAt: string;
};

export type TransferHistoryItem = {
  id: string;
  walletId: string;
  network: "btc" | "eth" | "bsc" | "trc20";
  asset: "BTC" | "ETH" | "USDT";
  txid: string;
  fromAddress: string | null;
  amount: string;
  createdAt: string;
};

async function ensureUserRow(env: Env, userId: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, created_at) VALUES (?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING"
  )
    .bind(userId)
    .run();
}

async function ensureSettingsRow(env: Env, userId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_settings (
      user_id,
      language,
      btc_threshold,
      eth_threshold,
      usdt_threshold,
      show_usd_estimate,
      blockchain_notifications_enabled,
      service_notifications_enabled,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO NOTHING`
  )
    .bind(
      userId,
      DEFAULT_SETTINGS.language,
      DEFAULT_SETTINGS.btcThreshold,
      DEFAULT_SETTINGS.ethThreshold,
      DEFAULT_SETTINGS.usdtThreshold
    )
    .run();
}

async function ensureReputationRow(env: Env, userId: string): Promise<void> {
  await ensureUserRow(env, userId);
  await env.DB.prepare(
    `INSERT INTO user_reputation (user_id, score, updated_at)
     VALUES (?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO NOTHING`
  )
    .bind(userId)
    .run();
}

async function appendLinkAudit(
  env: Env,
  payload: {
    actorUserId: string;
    entityType: "wallet" | "contact";
    network: "btc" | "eth" | "bsc" | "trc20";
    address: string;
    label?: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO link_audit_log (
      id,
      actor_user_id,
      entity_type,
      network,
      address_plaintext,
      label_plaintext,
      created_at
    ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(
      payload.actorUserId,
      payload.entityType,
      payload.network,
      payload.address,
      payload.label ?? null
    )
    .run();
}

export async function incrementUserReputation(
  env: Env,
  userId: string,
  delta: number
): Promise<number> {
  await ensureReputationRow(env, userId);
  await env.DB.prepare(
    `UPDATE user_reputation
     SET score = score + ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  )
    .bind(delta, userId)
    .run();

  const row = await env.DB.prepare(
    "SELECT score FROM user_reputation WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ score: number }>();
  return row?.score ?? 0;
}

export async function listWallets(env: Env, userId: string): Promise<WalletItem[]> {
  const result = await env.DB.prepare(
    "SELECT id, network, address_ciphertext, monitor_eth_native, monitor_usdt_erc20, monitor_usdt_bep20, monitor_usdt_trc20, created_at FROM wallets WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all<{
      id: string;
      network: "btc" | "eth" | "bsc" | "trc20";
      address_ciphertext: string;
      monitor_eth_native: number;
      monitor_usdt_erc20: number;
      monitor_usdt_bep20: number;
      monitor_usdt_trc20: number;
      created_at: string;
    }>();

  return Promise.all(
    result.results.map(async (row) => ({
      id: row.id,
      network: row.network,
      address: await decryptForUser(row.address_ciphertext, userId, env.ENCRYPTION_MASTER_KEY),
      monitorEthNative: row.monitor_eth_native === 1,
      monitorUsdtErc20: row.monitor_usdt_erc20 === 1,
      monitorUsdtBep20: row.monitor_usdt_bep20 === 1,
      monitorUsdtTrc20: row.monitor_usdt_trc20 === 1,
      createdAt: row.created_at
    }))
  );
}

export async function createWallet(
  env: Env,
  userId: string,
  payload: {
    network: "btc" | "eth" | "bsc" | "trc20";
    address: string;
    monitorEthNative?: boolean;
    monitorUsdtErc20?: boolean;
    monitorUsdtBep20?: boolean;
    monitorUsdtTrc20?: boolean;
  }
): Promise<void> {
  await ensureUserRow(env, userId);
  const countRow = await env.DB.prepare("SELECT COUNT(1) AS count FROM wallets WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();
  if ((countRow?.count ?? 0) >= MAX_WALLETS) {
    throw new Error(`Wallet limit reached: ${MAX_WALLETS}`);
  }

  const normalized = normalizeAddress(payload.network, payload.address);
  const ciphertext = await encryptForUser(normalized, userId, env.ENCRYPTION_MASTER_KEY);
  const hashed = await addressHash(normalized.toLowerCase());
  const monitorEthNative =
    payload.network === "eth" ? (payload.monitorEthNative ?? true) : false;
  const monitorUsdtErc20 =
    payload.network === "eth" ? (payload.monitorUsdtErc20 ?? true) : false;
  const monitorUsdtBep20 =
    payload.network === "bsc" ? (payload.monitorUsdtBep20 ?? true) : false;
  const monitorUsdtTrc20 =
    payload.network === "trc20" ? (payload.monitorUsdtTrc20 ?? true) : false;

  await env.DB.prepare(
    `INSERT INTO wallets (
      id,
      user_id,
      network,
      address_ciphertext,
      address_hash,
      monitor_eth_native,
      monitor_usdt_erc20,
      monitor_usdt_bep20,
      monitor_usdt_trc20,
      created_at
    )
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(
      userId,
      payload.network,
      ciphertext,
      hashed,
      monitorEthNative ? 1 : 0,
      monitorUsdtErc20 ? 1 : 0,
      monitorUsdtBep20 ? 1 : 0,
      monitorUsdtTrc20 ? 1 : 0
    )
    .run();

  await appendLinkAudit(env, {
    actorUserId: userId,
    entityType: "wallet",
    network: payload.network,
    address: normalized
  });
  await incrementUserReputation(env, userId, 1);
}

export async function deleteWallet(env: Env, userId: string, walletId: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM wallets WHERE id = ? AND user_id = ?")
    .bind(walletId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function listContacts(env: Env, userId: string): Promise<ContactItem[]> {
  const result = await env.DB.prepare(
    "SELECT id, network, address_ciphertext, label_ciphertext, created_at FROM contacts WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all<{
      id: string;
      network: "btc" | "eth" | "bsc" | "trc20";
      address_ciphertext: string;
      label_ciphertext: string;
      created_at: string;
    }>();

  return Promise.all(
    result.results.map(async (row) => ({
      id: row.id,
      network: row.network,
      address: await decryptForUser(row.address_ciphertext, userId, env.ENCRYPTION_MASTER_KEY),
      label: await decryptForUser(row.label_ciphertext, userId, env.ENCRYPTION_MASTER_KEY),
      createdAt: row.created_at
    }))
  );
}

export async function createContact(
  env: Env,
  userId: string,
  payload: { network: "btc" | "eth" | "bsc" | "trc20"; address: string; label: string }
): Promise<void> {
  await ensureUserRow(env, userId);
  const countRow = await env.DB.prepare("SELECT COUNT(1) AS count FROM contacts WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();
  if ((countRow?.count ?? 0) >= MAX_CONTACTS) {
    throw new Error(`Contact limit reached: ${MAX_CONTACTS}`);
  }

  const normalized = normalizeAddress(payload.network, payload.address);
  const addressCiphertext = await encryptForUser(normalized, userId, env.ENCRYPTION_MASTER_KEY);
  const labelCiphertext = await encryptForUser(payload.label.trim(), userId, env.ENCRYPTION_MASTER_KEY);
  const hashed = await addressHash(normalized.toLowerCase());

  await env.DB.prepare(
    `INSERT INTO contacts (
      id,
      user_id,
      network,
      address_ciphertext,
      address_hash,
      label_ciphertext,
      created_at,
      updated_at
    ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(userId, payload.network, addressCiphertext, hashed, labelCiphertext)
    .run();

  await appendLinkAudit(env, {
    actorUserId: userId,
    entityType: "contact",
    network: payload.network,
    address: normalized,
    label: payload.label.trim()
  });
  await incrementUserReputation(env, userId, 1);
}

export async function updateContactLabel(
  env: Env,
  userId: string,
  contactId: string,
  label: string
): Promise<boolean> {
  const labelCiphertext = await encryptForUser(label.trim(), userId, env.ENCRYPTION_MASTER_KEY);
  const result = await env.DB.prepare(
    "UPDATE contacts SET label_ciphertext = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
  )
    .bind(labelCiphertext, contactId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function deleteContact(env: Env, userId: string, contactId: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?")
    .bind(contactId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function getSettings(env: Env, userId: string): Promise<UserSettings> {
  await ensureUserRow(env, userId);
  await ensureSettingsRow(env, userId);

  const row = await env.DB.prepare(
    `SELECT language, btc_threshold, eth_threshold, usdt_threshold, show_usd_estimate,
            blockchain_notifications_enabled, service_notifications_enabled
     FROM user_settings WHERE user_id = ?`
  )
    .bind(userId)
    .first<{
      language: Language;
      btc_threshold: string;
      eth_threshold: string;
      usdt_threshold: string;
      show_usd_estimate: number;
      blockchain_notifications_enabled: number;
      service_notifications_enabled: number;
    }>();

  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    language: row.language,
    btcThreshold: row.btc_threshold,
    ethThreshold: row.eth_threshold,
    usdtThreshold: row.usdt_threshold,
    showUsdEstimate: row.show_usd_estimate === 1,
    blockchainNotificationsEnabled: row.blockchain_notifications_enabled === 1,
    serviceNotificationsEnabled: row.service_notifications_enabled === 1
  };
}

export async function updateSettings(
  env: Env,
  userId: string,
  partial: Partial<UserSettings>
): Promise<UserSettings> {
  const current = await getSettings(env, userId);
  const merged: UserSettings = {
    ...current,
    ...partial
  };

  await env.DB.prepare(
    `UPDATE user_settings
     SET language = ?,
         btc_threshold = ?,
         eth_threshold = ?,
         usdt_threshold = ?,
         show_usd_estimate = ?,
         blockchain_notifications_enabled = ?,
         service_notifications_enabled = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  )
    .bind(
      merged.language,
      merged.btcThreshold,
      merged.ethThreshold,
      merged.usdtThreshold,
      merged.showUsdEstimate ? 1 : 0,
      merged.blockchainNotificationsEnabled ? 1 : 0,
      merged.serviceNotificationsEnabled ? 1 : 0,
      userId
    )
    .run();

  return merged;
}

export async function getUsageSummary(env: Env, userId: string): Promise<UsageSummary> {
  await ensureUserRow(env, userId);
  const [walletCountRow, contactCountRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(1) AS count FROM wallets WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(1) AS count FROM contacts WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>()
  ]);

  return {
    walletCount: walletCountRow?.count ?? 0,
    walletLimit: MAX_WALLETS,
    contactCount: contactCountRow?.count ?? 0,
    contactLimit: MAX_CONTACTS
  };
}

export async function getUserReputation(env: Env, userId: string): Promise<number> {
  await ensureReputationRow(env, userId);
  const row = await env.DB.prepare("SELECT score FROM user_reputation WHERE user_id = ?")
    .bind(userId)
    .first<{ score: number }>();
  return row?.score ?? 0;
}

export async function listTopReputations(env: Env, limit = 20): Promise<ReputationEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await env.DB.prepare(
    `SELECT user_id, score, updated_at
     FROM user_reputation
     ORDER BY score DESC, updated_at DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all<{ user_id: string; score: number; updated_at: string }>();

  return result.results.map((row) => ({
    userId: row.user_id,
    score: row.score,
    updatedAt: row.updated_at
  }));
}

export async function resetUserReputation(env: Env, userId: string): Promise<void> {
  await ensureReputationRow(env, userId);
  await env.DB.prepare(
    "UPDATE user_reputation SET score = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  )
    .bind(userId)
    .run();
}

export async function addStoppedWallet(
  env: Env,
  adminUserId: string,
  network: "btc" | "eth" | "bsc" | "trc20",
  address: string
): Promise<void> {
  await ensureUserRow(env, adminUserId);
  const normalized = normalizeAddress(network, address);
  const hashed = await addressHash(normalized.toLowerCase());
  await env.DB.prepare(
    `INSERT INTO stopped_wallets (id, network, address_plaintext, address_hash, added_by_user_id, created_at)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(network, address_hash) DO NOTHING`
  )
    .bind(network, normalized, hashed, adminUserId)
    .run();
}

export async function removeStoppedWallet(
  env: Env,
  network: "btc" | "eth" | "bsc" | "trc20",
  address: string
): Promise<boolean> {
  const normalized = normalizeAddress(network, address);
  const hashed = await addressHash(normalized.toLowerCase());
  const result = await env.DB.prepare(
    "DELETE FROM stopped_wallets WHERE network = ? AND address_hash = ?"
  )
    .bind(network, hashed)
    .run();
  return result.meta.changes > 0;
}

export async function isStoppedWallet(
  env: Env,
  network: "btc" | "eth" | "bsc" | "trc20",
  address: string
): Promise<boolean> {
  const hashed = await addressHash(address.toLowerCase());
  const row = await env.DB.prepare(
    "SELECT id FROM stopped_wallets WHERE network = ? AND address_hash = ? LIMIT 1"
  )
    .bind(network, hashed)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

export async function listStoppedWallets(env: Env, limit = 50): Promise<StoppedWallet[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await env.DB.prepare(
    `SELECT id, network, address_plaintext, added_by_user_id, created_at
     FROM stopped_wallets
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all<{
      id: string;
      network: "btc" | "eth" | "bsc" | "trc20";
      address_plaintext: string;
      added_by_user_id: string;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    network: row.network,
    address: row.address_plaintext,
    addedByUserId: row.added_by_user_id,
    createdAt: row.created_at
  }));
}

export async function listLinkAuditEntries(env: Env, limit = 30): Promise<LinkAuditEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await env.DB.prepare(
    `SELECT id, actor_user_id, entity_type, network, address_plaintext, label_plaintext, created_at
     FROM link_audit_log
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all<{
      id: string;
      actor_user_id: string;
      entity_type: "wallet" | "contact";
      network: "btc" | "eth" | "bsc" | "trc20";
      address_plaintext: string;
      label_plaintext: string | null;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    entityType: row.entity_type,
    network: row.network,
    address: row.address_plaintext,
    label: row.label_plaintext,
    createdAt: row.created_at
  }));
}

export async function appendTransferHistory(
  env: Env,
  payload: {
    userId: string;
    walletId: string;
    network: "btc" | "eth" | "bsc" | "trc20";
    asset: "BTC" | "ETH" | "USDT";
    txid: string;
    fromAddress: string | null;
    amount: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO transfer_history (
      id,
      user_id,
      wallet_id,
      network,
      asset,
      txid,
      from_address,
      amount_text,
      created_at
    ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, wallet_id, txid, asset, network) DO NOTHING`
  )
    .bind(
      payload.userId,
      payload.walletId,
      payload.network,
      payload.asset,
      payload.txid,
      payload.fromAddress,
      payload.amount
    )
    .run();
}

export async function listTransferHistory(
  env: Env,
  userId: string,
  limit = 20
): Promise<TransferHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await env.DB.prepare(
    `SELECT id, wallet_id, network, asset, txid, from_address, amount_text, created_at
     FROM transfer_history
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(userId, safeLimit)
    .all<{
      id: string;
      wallet_id: string;
      network: "btc" | "eth" | "bsc" | "trc20";
      asset: "BTC" | "ETH" | "USDT";
      txid: string;
      from_address: string | null;
      amount_text: string;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    walletId: row.wallet_id,
    network: row.network,
    asset: row.asset,
    txid: row.txid,
    fromAddress: row.from_address,
    amount: row.amount_text,
    createdAt: row.created_at
  }));
}

export async function listWalletsForMonitoring(env: Env): Promise<MonitoredWallet[]> {
  const result = await env.DB.prepare(
    "SELECT id, user_id, network, address_ciphertext, monitor_eth_native, monitor_usdt_erc20, monitor_usdt_bep20, monitor_usdt_trc20 FROM wallets ORDER BY created_at DESC"
  ).all<{
    id: string;
    user_id: string;
    network: "btc" | "eth" | "bsc" | "trc20";
    address_ciphertext: string;
    monitor_eth_native: number;
    monitor_usdt_erc20: number;
    monitor_usdt_bep20: number;
    monitor_usdt_trc20: number;
  }>();

  return Promise.all(
    result.results.map(async (row) => ({
      id: row.id,
      userId: row.user_id,
      network: row.network,
      address: await decryptForUser(row.address_ciphertext, row.user_id, env.ENCRYPTION_MASTER_KEY),
      monitorEthNative: row.monitor_eth_native === 1,
      monitorUsdtErc20: row.monitor_usdt_erc20 === 1,
      monitorUsdtBep20: row.monitor_usdt_bep20 === 1,
      monitorUsdtTrc20: row.monitor_usdt_trc20 === 1
    }))
  );
}

export async function resolveContactLabel(
  env: Env,
  userId: string,
  network: "btc" | "eth" | "bsc" | "trc20",
  senderAddress: string
): Promise<string | null> {
  const hashed = await addressHash(senderAddress.toLowerCase());
  const row = await env.DB.prepare(
    "SELECT label_ciphertext FROM contacts WHERE user_id = ? AND network = ? AND address_hash = ? LIMIT 1"
  )
    .bind(userId, network, hashed)
    .first<{ label_ciphertext: string }>();
  if (!row?.label_ciphertext) {
    return null;
  }
  return decryptForUser(row.label_ciphertext, userId, env.ENCRYPTION_MASTER_KEY);
}

export async function reserveNotificationDedup(
  env: Env,
  userId: string,
  dedupKey: string
): Promise<boolean> {
  try {
    await env.DB.prepare(
      `INSERT INTO notification_dedup (id, user_id, dedup_key, created_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(userId, dedupKey)
      .run();
    return true;
  } catch {
    return false;
  }
}

export async function getBotSession(env: Env, userId: string): Promise<StoredBotSession | null> {
  const row = await env.DB.prepare("SELECT state_json FROM user_sessions WHERE user_id = ?")
    .bind(userId)
    .first<{ state_json: string }>();

  if (!row?.state_json) {
    return null;
  }

  try {
    return JSON.parse(row.state_json) as StoredBotSession;
  } catch {
    return null;
  }
}

export async function setBotSession(env: Env, userId: string, state: StoredBotSession): Promise<void> {
  await ensureUserRow(env, userId);
  await env.DB.prepare(
    `INSERT INTO user_sessions (user_id, state_json, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       state_json = excluded.state_json,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(userId, JSON.stringify(state))
    .run();
}

export async function clearBotSession(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId).run();
}
