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
  username: string | null;
  displayName: string | null;
  score: number;
  updatedAt: string;
};

export type StoppedWallet = {
  id: string;
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  addedByUserId: string;
  addedByUsername: string | null;
  addedByDisplayName: string | null;
  createdAt: string;
};

export type LinkAuditEntry = {
  id: string;
  actorUserId: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
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
  direction: "incoming" | "outgoing";
  asset: "BTC" | "ETH" | "USDT";
  txid: string;
  fromAddress: string | null;
  counterpartyAddress: string | null;
  amount: string;
  createdAt: string;
};

export type SubscriptionInfo = {
  planCode: string;
  status: "inactive" | "active";
  expiresAt: string | null;
  promoActivations: number;
};

export type WalletReputationEntry = {
  network: "btc" | "eth" | "bsc" | "trc20";
  address: string;
  score: number;
  likesCount: number;
  dislikesCount: number;
  updatedAt: string;
};

export type SubscriptionPaymentRequest = {
  id: string;
  userId: string;
  network: "bsc" | "trc20";
  asset: "USDT";
  payAddress: string;
  amountText: string;
  status: "pending" | "paid" | "expired";
  durationDays: number;
  txid: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  updatedAt: string;
};

function formatTrackedNetwork(network: "btc" | "eth" | "bsc" | "trc20"): "BTC" | "ETH" | "BEP20" | "TRC20" {
  if (network === "bsc") {
    return "BEP20";
  }
  return network.toUpperCase() as "BTC" | "ETH" | "TRC20";
}

function shortTrackedAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

async function mirrorWalletToContacts(
  env: Env,
  userId: string,
  network: "btc" | "eth" | "bsc" | "trc20",
  normalizedAddress: string
): Promise<void> {
  const hashed = await addressHash(normalizedAddress.toLowerCase());
  const existing = await env.DB.prepare("SELECT id FROM contacts WHERE user_id = ? AND network = ? AND address_hash = ? LIMIT 1")
    .bind(userId, network, hashed)
    .first<{ id: string }>();
  if (existing?.id) {
    return;
  }

  const countRow = await env.DB.prepare("SELECT COUNT(1) AS count FROM contacts WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();
  if ((countRow?.count ?? 0) >= MAX_CONTACTS) {
    return;
  }

  const autoLabel = `Tracked ${formatTrackedNetwork(network)} ${shortTrackedAddress(normalizedAddress)}`;
  const addressCiphertext = await encryptForUser(normalizedAddress, userId, env.ENCRYPTION_MASTER_KEY);
  const labelCiphertext = await encryptForUser(autoLabel, userId, env.ENCRYPTION_MASTER_KEY);
  try {
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
      .bind(userId, network, addressCiphertext, hashed, labelCiphertext)
      .run();
  } catch {
    // Best-effort mirror. Wallet creation should not fail due to contact sync.
  }
}

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

export async function upsertUserProfile(
  env: Env,
  payload: { userId: string; username?: string | null; displayName?: string | null }
): Promise<void> {
  await ensureUserRow(env, payload.userId);
  await env.DB.prepare(
    `INSERT INTO user_profiles (user_id, username, display_name, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       display_name = excluded.display_name,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(
      payload.userId,
      payload.username?.trim() ? payload.username.trim() : null,
      payload.displayName?.trim() ? payload.displayName.trim() : null
    )
    .run();
}

async function ensureSubscriptionRow(env: Env, userId: string): Promise<void> {
  await ensureUserRow(env, userId);
  await env.DB.prepare(
    `INSERT INTO user_subscriptions (user_id, plan_code, status, expires_at, updated_at)
     VALUES (?, 'free', 'inactive', NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO NOTHING`
  )
    .bind(userId)
    .run();
}

export async function upsertWalletReputationTarget(
  env: Env,
  network: "btc" | "eth" | "bsc" | "trc20",
  address: string
): Promise<void> {
  const normalized = normalizeAddress(network, address);
  const hashed = await addressHash(normalized.toLowerCase());
  await env.DB.prepare(
    `INSERT INTO wallet_reputation (
      id,
      network,
      address_plaintext,
      address_hash,
      score,
      likes_count,
      dislikes_count,
      updated_at
    ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 0, 0, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(network, address_hash) DO UPDATE SET
      address_plaintext = excluded.address_plaintext,
      updated_at = CURRENT_TIMESTAMP`
  )
    .bind(network, normalized, hashed)
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

  try {
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
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (message.includes("wallets.user_id, wallets.network, wallets.address_hash")) {
      throw new Error("WALLET_ALREADY_EXISTS");
    }
    throw error;
  }

  await appendLinkAudit(env, {
    actorUserId: userId,
    entityType: "wallet",
    network: payload.network,
    address: normalized
  });
  await mirrorWalletToContacts(env, userId, payload.network, normalized);
  await upsertWalletReputationTarget(env, payload.network, normalized);
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

  try {
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
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (message.includes("contacts.user_id, contacts.network, contacts.address_hash")) {
      throw new Error("CONTACT_ALREADY_EXISTS");
    }
    throw error;
  }

  await appendLinkAudit(env, {
    actorUserId: userId,
    entityType: "contact",
    network: payload.network,
    address: normalized,
    label: payload.label.trim()
  });
  await upsertWalletReputationTarget(env, payload.network, normalized);
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
    `SELECT ur.user_id, ur.score, ur.updated_at, up.username, up.display_name
     FROM user_reputation ur
     LEFT JOIN user_profiles up ON up.user_id = ur.user_id
     WHERE ur.user_id != '' AND ur.user_id NOT GLOB '*[^0-9]*'
     ORDER BY ur.score DESC, ur.updated_at DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all<{
      user_id: string;
      username: string | null;
      display_name: string | null;
      score: number;
      updated_at: string;
    }>();

  return result.results.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    score: row.score,
    updatedAt: row.updated_at
  }));
}

export async function listTopWalletReputations(
  env: Env,
  limit = 20
): Promise<WalletReputationEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await env.DB.prepare(
    `SELECT network, address_plaintext, score, likes_count, dislikes_count, updated_at
     FROM wallet_reputation
     ORDER BY score DESC, likes_count DESC, updated_at DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all<{
      network: "btc" | "eth" | "bsc" | "trc20";
      address_plaintext: string;
      score: number;
      likes_count: number;
      dislikes_count: number;
      updated_at: string;
    }>();

  return result.results.map((row) => ({
    network: row.network,
    address: row.address_plaintext,
    score: row.score,
    likesCount: row.likes_count,
    dislikesCount: row.dislikes_count,
    updatedAt: row.updated_at
  }));
}

export async function getWalletReputationByAddress(
  env: Env,
  network: "btc" | "eth" | "bsc" | "trc20",
  address: string
): Promise<WalletReputationEntry | null> {
  const normalized = normalizeAddress(network, address);
  const hashed = await addressHash(normalized.toLowerCase());
  const row = await env.DB.prepare(
    `SELECT network, address_plaintext, score, likes_count, dislikes_count, updated_at
     FROM wallet_reputation
     WHERE network = ? AND address_hash = ?
     LIMIT 1`
  )
    .bind(network, hashed)
    .first<{
      network: "btc" | "eth" | "bsc" | "trc20";
      address_plaintext: string;
      score: number;
      likes_count: number;
      dislikes_count: number;
      updated_at: string;
    }>();

  if (!row) {
    return null;
  }
  return {
    network: row.network,
    address: row.address_plaintext,
    score: row.score,
    likesCount: row.likes_count,
    dislikesCount: row.dislikes_count,
    updatedAt: row.updated_at
  };
}

export async function resetUserReputation(env: Env, userId: string): Promise<void> {
  await ensureReputationRow(env, userId);
  await env.DB.prepare(
    "UPDATE user_reputation SET score = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  )
    .bind(userId)
    .run();
}

export async function rateTransferCounterparty(
  env: Env,
  voterUserId: string,
  transferId: string,
  vote: -1 | 1
): Promise<WalletReputationEntry> {
  await ensureUserRow(env, voterUserId);

  const transfer = await env.DB.prepare(
    `SELECT network, counterparty_address
     FROM transfer_history
     WHERE id = ? AND user_id = ?
     LIMIT 1`
  )
    .bind(transferId, voterUserId)
    .first<{
      network: "btc" | "eth" | "bsc" | "trc20";
      counterparty_address: string | null;
    }>();

  if (!transfer?.counterparty_address) {
    throw new Error("TRANSFER_COUNTERPARTY_NOT_FOUND");
  }

  const network = transfer.network;
  const counterparty = normalizeAddress(network, transfer.counterparty_address);
  const hashed = await addressHash(counterparty.toLowerCase());

  await upsertWalletReputationTarget(env, network, counterparty);

  const existingVote = await env.DB.prepare(
    `SELECT vote
     FROM transfer_rating_votes
     WHERE transfer_history_id = ? AND voter_user_id = ?
     LIMIT 1`
  )
    .bind(transferId, voterUserId)
    .first<{ vote: -1 | 1 }>();

  let scoreDelta = vote;
  let likesDelta = vote === 1 ? 1 : 0;
  let dislikesDelta = vote === -1 ? 1 : 0;

  if (existingVote) {
    if (existingVote.vote === vote) {
      const current = await getWalletReputationByAddress(env, network, counterparty);
      if (!current) {
        throw new Error("REPUTATION_NOT_FOUND");
      }
      return current;
    }
    scoreDelta = vote - existingVote.vote;
    likesDelta = (vote === 1 ? 1 : 0) - (existingVote.vote === 1 ? 1 : 0);
    dislikesDelta = (vote === -1 ? 1 : 0) - (existingVote.vote === -1 ? 1 : 0);

    await env.DB.prepare(
      `UPDATE transfer_rating_votes
       SET vote = ?, updated_at = CURRENT_TIMESTAMP
       WHERE transfer_history_id = ? AND voter_user_id = ?`
    )
      .bind(vote, transferId, voterUserId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO transfer_rating_votes (
        id,
        transfer_history_id,
        voter_user_id,
        vote,
        created_at,
        updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(transferId, voterUserId, vote)
      .run();
  }

  await env.DB.prepare(
    `UPDATE wallet_reputation
     SET score = score + ?,
         likes_count = likes_count + ?,
         dislikes_count = dislikes_count + ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE network = ? AND address_hash = ?`
  )
    .bind(scoreDelta, likesDelta, dislikesDelta, network, hashed)
    .run();

  const updated = await getWalletReputationByAddress(env, network, counterparty);
  if (!updated) {
    throw new Error("REPUTATION_NOT_FOUND");
  }
  return updated;
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
    `SELECT sw.id, sw.network, sw.address_plaintext, sw.added_by_user_id, sw.created_at, up.username, up.display_name
     FROM stopped_wallets sw
     LEFT JOIN user_profiles up ON up.user_id = sw.added_by_user_id
     ORDER BY sw.created_at DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all<{
      id: string;
      network: "btc" | "eth" | "bsc" | "trc20";
      address_plaintext: string;
      added_by_user_id: string;
      username: string | null;
      display_name: string | null;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    network: row.network,
    address: row.address_plaintext,
    addedByUserId: row.added_by_user_id,
    addedByUsername: row.username,
    addedByDisplayName: row.display_name,
    createdAt: row.created_at
  }));
}

export async function listLinkAuditEntries(env: Env, limit = 30): Promise<LinkAuditEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await env.DB.prepare(
    `SELECT la.id, la.actor_user_id, la.entity_type, la.network, la.address_plaintext, la.label_plaintext, la.created_at,
            up.username, up.display_name
     FROM link_audit_log la
     LEFT JOIN user_profiles up ON up.user_id = la.actor_user_id
     ORDER BY la.created_at DESC
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
      username: string | null;
      display_name: string | null;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorUsername: row.username,
    actorDisplayName: row.display_name,
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
    direction: "incoming" | "outgoing";
    asset: "BTC" | "ETH" | "USDT";
    txid: string;
    fromAddress: string | null;
    counterpartyAddress: string | null;
    amount: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO transfer_history (
      id,
      user_id,
      wallet_id,
      network,
      direction,
      asset,
      txid,
      from_address,
      counterparty_address,
      amount_text,
      created_at
    ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, wallet_id, txid, asset, network, direction) DO NOTHING`
  )
    .bind(
      payload.userId,
      payload.walletId,
      payload.network,
      payload.direction,
      payload.asset,
      payload.txid,
      payload.fromAddress,
      payload.counterpartyAddress,
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
    `SELECT id, wallet_id, network, direction, asset, txid, from_address, counterparty_address, amount_text, created_at
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
      direction: "incoming" | "outgoing";
      asset: "BTC" | "ETH" | "USDT";
      txid: string;
      from_address: string | null;
      counterparty_address: string | null;
      amount_text: string;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    walletId: row.wallet_id,
    network: row.network,
    direction: row.direction,
    asset: row.asset,
    txid: row.txid,
    fromAddress: row.from_address,
    counterpartyAddress: row.counterparty_address,
    amount: row.amount_text,
    createdAt: row.created_at
  }));
}

export async function getSubscriptionInfo(env: Env, userId: string): Promise<SubscriptionInfo> {
  await ensureSubscriptionRow(env, userId);
  const [row, promoCountRow] = await Promise.all([
    env.DB.prepare(
      `SELECT plan_code, status, expires_at
       FROM user_subscriptions
       WHERE user_id = ?`
    )
      .bind(userId)
      .first<{
        plan_code: string;
        status: "inactive" | "active";
        expires_at: string | null;
      }>(),
    env.DB.prepare(
      "SELECT COUNT(1) AS count FROM promo_code_activations WHERE user_id = ?"
    )
      .bind(userId)
      .first<{ count: number }>()
  ]);

  return {
    planCode: row?.plan_code ?? "free",
    status: row?.status ?? "inactive",
    expiresAt: row?.expires_at ?? null,
    promoActivations: promoCountRow?.count ?? 0
  };
}

export async function createSubscriptionPaymentRequest(
  env: Env,
  payload: {
    userId: string;
    network: "bsc" | "trc20";
    asset: "USDT";
    payAddress: string;
    amountText: string;
    durationDays: number;
    expiresAt: string;
  }
): Promise<SubscriptionPaymentRequest> {
  await ensureSubscriptionRow(env, payload.userId);
  await env.DB.prepare(
    `INSERT INTO subscription_payments (
      id,
      user_id,
      network,
      asset,
      pay_address,
      amount_text,
      status,
      duration_days,
      txid,
      created_at,
      expires_at,
      paid_at,
      updated_at
    ) VALUES (
      lower(hex(randomblob(16))),
      ?, ?, ?, ?, ?, 'pending', ?, NULL, CURRENT_TIMESTAMP, ?, NULL, CURRENT_TIMESTAMP
    )`
  )
    .bind(
      payload.userId,
      payload.network,
      payload.asset,
      payload.payAddress,
      payload.amountText,
      payload.durationDays,
      payload.expiresAt
    )
    .run();

  const created = await env.DB.prepare(
    `SELECT id, user_id, network, asset, pay_address, amount_text, status, duration_days, txid,
            created_at, expires_at, paid_at, updated_at
     FROM subscription_payments
     WHERE user_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(payload.userId)
    .first<{
      id: string;
      user_id: string;
      network: "bsc" | "trc20";
      asset: "USDT";
      pay_address: string;
      amount_text: string;
      status: "pending" | "paid" | "expired";
      duration_days: number;
      txid: string | null;
      created_at: string;
      expires_at: string;
      paid_at: string | null;
      updated_at: string;
    }>();

  if (!created) {
    throw new Error("PAYMENT_REQUEST_CREATE_FAILED");
  }
  return {
    id: created.id,
    userId: created.user_id,
    network: created.network,
    asset: created.asset,
    payAddress: created.pay_address,
    amountText: created.amount_text,
    status: created.status,
    durationDays: created.duration_days,
    txid: created.txid,
    createdAt: created.created_at,
    expiresAt: created.expires_at,
    paidAt: created.paid_at,
    updatedAt: created.updated_at
  };
}

export async function getActiveSubscriptionPaymentRequest(
  env: Env,
  userId: string
): Promise<SubscriptionPaymentRequest | null> {
  const row = await env.DB.prepare(
    `SELECT id, user_id, network, asset, pay_address, amount_text, status, duration_days, txid,
            created_at, expires_at, paid_at, updated_at
     FROM subscription_payments
     WHERE user_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(userId)
    .first<{
      id: string;
      user_id: string;
      network: "bsc" | "trc20";
      asset: "USDT";
      pay_address: string;
      amount_text: string;
      status: "pending" | "paid" | "expired";
      duration_days: number;
      txid: string | null;
      created_at: string;
      expires_at: string;
      paid_at: string | null;
      updated_at: string;
    }>();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    network: row.network,
    asset: row.asset,
    payAddress: row.pay_address,
    amountText: row.amount_text,
    status: row.status,
    durationDays: row.duration_days,
    txid: row.txid,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    updatedAt: row.updated_at
  };
}

export async function listPendingSubscriptionPayments(
  env: Env,
  userId?: string,
  limit = 100
): Promise<SubscriptionPaymentRequest[]> {
  const query =
    typeof userId === "string"
      ? `SELECT id, user_id, network, asset, pay_address, amount_text, status, duration_days, txid,
                created_at, expires_at, paid_at, updated_at
         FROM subscription_payments
         WHERE status = 'pending' AND user_id = ?
         ORDER BY created_at ASC
         LIMIT ?`
      : `SELECT id, user_id, network, asset, pay_address, amount_text, status, duration_days, txid,
                created_at, expires_at, paid_at, updated_at
         FROM subscription_payments
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT ?`;

  const statement = env.DB.prepare(query);
  const result = typeof userId === "string" ? statement.bind(userId, limit) : statement.bind(limit);
  const rows = await result.all<{
    id: string;
    user_id: string;
    network: "bsc" | "trc20";
    asset: "USDT";
    pay_address: string;
    amount_text: string;
    status: "pending" | "paid" | "expired";
    duration_days: number;
    txid: string | null;
    created_at: string;
    expires_at: string;
    paid_at: string | null;
    updated_at: string;
  }>();

  return rows.results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    network: row.network,
    asset: row.asset,
    payAddress: row.pay_address,
    amountText: row.amount_text,
    status: row.status,
    durationDays: row.duration_days,
    txid: row.txid,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    updatedAt: row.updated_at
  }));
}

export async function markSubscriptionPaymentExpired(env: Env, paymentId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE subscription_payments
     SET status = 'expired',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`
  )
    .bind(paymentId)
    .run();
}

export async function markSubscriptionPaymentPaid(
  env: Env,
  paymentId: string,
  txid: string,
  paidAt: string
): Promise<void> {
  await env.DB.prepare(
    `UPDATE subscription_payments
     SET status = 'paid',
         txid = ?,
         paid_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`
  )
    .bind(txid, paidAt, paymentId)
    .run();
}

export async function activatePaidSubscription(
  env: Env,
  userId: string,
  durationDays: number
): Promise<SubscriptionInfo> {
  await ensureSubscriptionRow(env, userId);
  const current = await getSubscriptionInfo(env, userId);
  const nowMs = Date.now();
  const currentExpiresMs = current.expiresAt ? Date.parse(current.expiresAt) : Number.NaN;
  const baseMs = Number.isFinite(currentExpiresMs) && currentExpiresMs > nowMs ? currentExpiresMs : nowMs;
  const nextExpiresAt = new Date(baseMs + durationDays * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE user_subscriptions
     SET plan_code = 'paid',
         status = 'active',
         expires_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  )
    .bind(nextExpiresAt, userId)
    .run();
  return getSubscriptionInfo(env, userId);
}

export async function activatePromoCode(
  env: Env,
  userId: string,
  rawCode: string
): Promise<SubscriptionInfo> {
  await ensureSubscriptionRow(env, userId);
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new Error("PROMO_CODE_EMPTY");
  }

  const promo = await env.DB.prepare(
    `SELECT id, duration_days, max_activations, activations_count, is_active
     FROM promo_codes
     WHERE code = ?
     LIMIT 1`
  )
    .bind(code)
    .first<{
      id: string;
      duration_days: number;
      max_activations: number | null;
      activations_count: number;
      is_active: number;
    }>();

  if (!promo || promo.is_active !== 1) {
    throw new Error("PROMO_CODE_INVALID");
  }
  if (promo.max_activations !== null && promo.activations_count >= promo.max_activations) {
    throw new Error("PROMO_CODE_EXHAUSTED");
  }

  const alreadyUsed = await env.DB.prepare(
    "SELECT id FROM promo_code_activations WHERE promo_code_id = ? AND user_id = ? LIMIT 1"
  )
    .bind(promo.id, userId)
    .first<{ id: string }>();
  if (alreadyUsed?.id) {
    throw new Error("PROMO_CODE_ALREADY_USED");
  }

  const current = await getSubscriptionInfo(env, userId);
  const nowMs = Date.now();
  const currentExpiresMs = current.expiresAt ? Date.parse(current.expiresAt) : Number.NaN;
  const baseMs = Number.isFinite(currentExpiresMs) && currentExpiresMs > nowMs ? currentExpiresMs : nowMs;
  const nextExpiresAt = new Date(baseMs + promo.duration_days * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `UPDATE user_subscriptions
     SET plan_code = 'promo',
         status = 'active',
         expires_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  )
    .bind(nextExpiresAt, userId)
    .run();

  await env.DB.prepare(
    `INSERT INTO promo_code_activations (
      id,
      promo_code_id,
      user_id,
      code,
      duration_days,
      activated_at
    ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(promo.id, userId, code, promo.duration_days)
    .run();

  await env.DB.prepare(
    "UPDATE promo_codes SET activations_count = activations_count + 1 WHERE id = ?"
  )
    .bind(promo.id)
    .run();

  return getSubscriptionInfo(env, userId);
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
