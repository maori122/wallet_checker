import { formatUnits, getAddress, isAddress } from "viem";
import { TronWeb, utils as tronUtils } from "tronweb";
import type { Env } from "../types/env";
import {
  appendTransferHistory,
  getSettings,
  isStoppedWallet,
  listWalletsForMonitoring,
  reserveNotificationDedup,
  resolveContactLabel
} from "./db";

const ETHERSCAN_BASE = "https://api.etherscan.io/api";
const BSCSCAN_BASE = "https://api.bscscan.com/api";
const USDT_ETH_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

type Asset = "BTC" | "ETH" | "USDT";
type Network = "btc" | "eth" | "bsc" | "trc20";

type TransferEvent = {
  txid: string;
  from: string | null;
  to: string | null;
  direction: "incoming" | "outgoing";
  amount: number;
  asset: Asset;
  network: Network;
};

let priceCache:
  | {
      timestamp: number;
      btc: number;
      eth: number;
      usdt: number;
    }
  | null = null;

function maskAddress(value: string): string {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function toFixedTrimmed(value: number, decimals = 8): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

async function sendTelegramMessage(env: Env, chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchBtcTransfers(address: string): Promise<TransferEvent[]> {
  type BlockstreamTx = {
    txid: string;
    vin: Array<{ prevout?: { scriptpubkey_address?: string } }>;
    vout: Array<{ scriptpubkey_address?: string; value: number }>;
  };
  const rows = await fetchJson<BlockstreamTx[]>(
    `https://blockstream.info/api/address/${encodeURIComponent(address)}/txs`
  );

  const normalizedAddress = address.toLowerCase();
  const items: TransferEvent[] = [];
  for (const row of rows) {
    let incomingSats = 0;
    let outgoingSats = 0;
    let outgoingTo: string | null = null;
    const sentFromWallet = row.vin.some(
      (input) => input.prevout?.scriptpubkey_address?.toLowerCase() === normalizedAddress
    );

    for (const output of row.vout) {
      if (output.scriptpubkey_address?.toLowerCase() === normalizedAddress) {
        incomingSats += output.value;
      } else if (sentFromWallet) {
        outgoingSats += output.value;
        if (!outgoingTo && output.scriptpubkey_address) {
          outgoingTo = output.scriptpubkey_address;
        }
      }
    }
    if (incomingSats > 0) {
      const from = row.vin[0]?.prevout?.scriptpubkey_address ?? null;
      items.push({
        txid: row.txid,
        from,
        to: address,
        direction: "incoming",
        amount: incomingSats / 100_000_000,
        asset: "BTC",
        network: "btc"
      });
    }
    if (outgoingSats > 0) {
      items.push({
        txid: row.txid,
        from: address,
        to: outgoingTo,
        direction: "outgoing",
        amount: outgoingSats / 100_000_000,
        asset: "BTC",
        network: "btc"
      });
    }
  }
  return items;
}

async function fetchEthTransfers(address: string, apiKey: string): Promise<TransferEvent[]> {
  type EtherscanResponse = {
    status: string;
    result: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      isError: string;
    }>;
  };
  const response = await fetchJson<EtherscanResponse>(
    `${ETHERSCAN_BASE}?module=account&action=txlist&address=${encodeURIComponent(address)}&page=1&offset=30&sort=desc&apikey=${encodeURIComponent(apiKey)}`
  );
  const normalized = address.toLowerCase();
  const items: TransferEvent[] = [];

  for (const row of response.result ?? []) {
    if (row.isError !== "0") {
      continue;
    }
    const toMatches = (row.to ?? "").toLowerCase() === normalized;
    const fromMatches = (row.from ?? "").toLowerCase() === normalized;
    if (!toMatches && !fromMatches) {
      continue;
    }
    const valueWei = BigInt(row.value);
    if (valueWei <= 0n) {
      continue;
    }
    items.push({
      txid: row.hash,
      from: row.from ?? null,
      to: row.to ?? null,
      direction: toMatches ? "incoming" : "outgoing",
      amount: Number(formatUnits(valueWei, 18)),
      asset: "ETH",
      network: "eth"
    });
  }
  return items;
}

async function fetchUsdtTransfers(address: string, apiKey: string): Promise<TransferEvent[]> {
  type EtherscanTokenResponse = {
    status: string;
    result: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      tokenDecimal: string;
      contractAddress: string;
    }>;
  };
  const response = await fetchJson<EtherscanTokenResponse>(
    `${ETHERSCAN_BASE}?module=account&action=tokentx&contractaddress=${USDT_ETH_CONTRACT}&address=${encodeURIComponent(address)}&page=1&offset=40&sort=desc&apikey=${encodeURIComponent(apiKey)}`
  );
  const normalized = address.toLowerCase();
  const items: TransferEvent[] = [];

  for (const row of response.result ?? []) {
    const toMatches = (row.to ?? "").toLowerCase() === normalized;
    const fromMatches = (row.from ?? "").toLowerCase() === normalized;
    if (!toMatches && !fromMatches) {
      continue;
    }
    if ((row.contractAddress ?? "").toLowerCase() !== USDT_ETH_CONTRACT.toLowerCase()) {
      continue;
    }
    const decimals = Number.parseInt(row.tokenDecimal, 10) || 6;
    const value = BigInt(row.value);
    if (value <= 0n) {
      continue;
    }
    items.push({
      txid: row.hash,
      from: row.from ?? null,
      to: row.to ?? null,
      direction: toMatches ? "incoming" : "outgoing",
      amount: Number(formatUnits(value, decimals)),
      asset: "USDT",
      network: "eth"
    });
  }
  return items;
}

async function fetchUsdtBscTransfers(address: string, apiKey: string): Promise<TransferEvent[]> {
  type BscscanTokenResponse = {
    status: string;
    result: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      tokenDecimal: string;
      contractAddress: string;
    }>;
  };
  const response = await fetchJson<BscscanTokenResponse>(
    `${BSCSCAN_BASE}?module=account&action=tokentx&contractaddress=${USDT_BSC_CONTRACT}&address=${encodeURIComponent(address)}&page=1&offset=40&sort=desc&apikey=${encodeURIComponent(apiKey)}`
  );
  const normalized = address.toLowerCase();
  const items: TransferEvent[] = [];

  for (const row of response.result ?? []) {
    const toMatches = (row.to ?? "").toLowerCase() === normalized;
    const fromMatches = (row.from ?? "").toLowerCase() === normalized;
    if (!toMatches && !fromMatches) {
      continue;
    }
    if ((row.contractAddress ?? "").toLowerCase() !== USDT_BSC_CONTRACT.toLowerCase()) {
      continue;
    }
    const decimals = Number.parseInt(row.tokenDecimal, 10) || 18;
    const value = BigInt(row.value);
    if (value <= 0n) {
      continue;
    }
    items.push({
      txid: row.hash,
      from: row.from ?? null,
      to: row.to ?? null,
      direction: toMatches ? "incoming" : "outgoing",
      amount: Number(formatUnits(value, decimals)),
      asset: "USDT",
      network: "bsc"
    });
  }
  return items;
}

async function fetchUsdtTrc20Transfers(address: string, apiKey?: string): Promise<TransferEvent[]> {
  type TronGridResponse = {
    data?: Array<{
      transaction_id: string;
      from: string;
      to: string;
      value: string;
      token_info?: {
        symbol?: string;
        decimals?: string;
      };
    }>;
  };
  const response = await fetch(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?only_confirmed=true&limit=40`, {
    headers: apiKey
      ? {
          "TRON-PRO-API-KEY": apiKey
        }
      : undefined
  });
  if (!response.ok) {
    throw new Error(`Trongrid request failed with status ${response.status}`);
  }

  const result = (await response.json()) as TronGridResponse;
  const normalizedHex = tronUtils.address.toHex(address).toLowerCase();
  const items: TransferEvent[] = [];

  for (const row of result.data ?? []) {
    if ((!row.to || !TronWeb.isAddress(row.to)) && (!row.from || !TronWeb.isAddress(row.from))) {
      continue;
    }
    const toMatches =
      row.to && TronWeb.isAddress(row.to)
        ? tronUtils.address.toHex(row.to).toLowerCase() === normalizedHex
        : false;
    const fromMatches =
      row.from && TronWeb.isAddress(row.from)
        ? tronUtils.address.toHex(row.from).toLowerCase() === normalizedHex
        : false;
    if (!toMatches && !fromMatches) {
      continue;
    }
    if ((row.token_info?.symbol ?? "").toUpperCase() !== "USDT") {
      continue;
    }
    const decimals = Number.parseInt(row.token_info?.decimals ?? "6", 10) || 6;
    const value = BigInt(row.value);
    if (value <= 0n) {
      continue;
    }
    items.push({
      txid: row.transaction_id,
      from: row.from ?? null,
      to: row.to ?? null,
      direction: toMatches ? "incoming" : "outgoing",
      amount: Number(formatUnits(value, decimals)),
      asset: "USDT",
      network: "trc20"
    });
  }

  return items;
}

async function getPricesUsd(): Promise<{ btc: number; eth: number; usdt: number }> {
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < 60_000) {
    return {
      btc: priceCache.btc,
      eth: priceCache.eth,
      usdt: priceCache.usdt
    };
  }

  type PriceResponse = {
    bitcoin?: { usd?: number };
    ethereum?: { usd?: number };
    tether?: { usd?: number };
  };
  const result = await fetchJson<PriceResponse>(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd"
  );

  priceCache = {
    timestamp: now,
    btc: result.bitcoin?.usd ?? 0,
    eth: result.ethereum?.usd ?? 0,
    usdt: result.tether?.usd ?? 1
  };

  return {
    btc: priceCache.btc,
    eth: priceCache.eth,
    usdt: priceCache.usdt
  };
}

function formatNotification(params: {
  language: "ru" | "en";
  label: string | null;
  from: string | null;
  toAddress: string;
  amount: number;
  asset: Asset;
  usdEstimate: number | null;
}): string {
  const sender =
    params.label ??
    (params.language === "ru"
      ? `Неизвестный отправитель (${params.from ? maskAddress(params.from) : "n/a"})`
      : `Unknown sender (${params.from ? maskAddress(params.from) : "n/a"})`);

  if (params.language === "ru") {
    return [
      `Входящий перевод: ${toFixedTrimmed(params.amount)} ${params.asset}`,
      `Отправитель: ${sender}`,
      `Мой адрес: ${maskAddress(params.toAddress)}`,
      params.usdEstimate !== null ? `Оценка: ≈ $${toFixedTrimmed(params.usdEstimate, 2)}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Incoming transfer: ${toFixedTrimmed(params.amount)} ${params.asset}`,
    `Sender: ${sender}`,
    `My address: ${maskAddress(params.toAddress)}`,
    params.usdEstimate !== null ? `Estimate: ≈ $${toFixedTrimmed(params.usdEstimate, 2)}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeNetworkAddress(network: Network, address: string | null): string | null {
  if (!address) {
    return null;
  }

  if (network === "eth" || network === "bsc") {
    if (!isAddress(address)) {
      return null;
    }
    return getAddress(address);
  }

  if (network === "trc20") {
    if (!TronWeb.isAddress(address)) {
      return null;
    }
    const hex = tronUtils.address.toHex(address);
    return tronUtils.address.fromHex(hex);
  }

  return address;
}

export async function runWalletMonitoring(env: Env): Promise<void> {
  const wallets = await listWalletsForMonitoring(env);
  if (wallets.length === 0) {
    return;
  }

  const prices = await getPricesUsd();
  const etherscanKey = env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
  const bscscanKey = env.BSCSCAN_API_KEY ?? "YourApiKeyToken";
  const trongridKey = env.TRONGRID_API_KEY;

  for (const wallet of wallets) {
    const settings = await getSettings(env, wallet.userId);
    if (!settings.blockchainNotificationsEnabled) {
      continue;
    }

    let events: TransferEvent[] = [];
    try {
      if (wallet.network === "btc") {
        events = await fetchBtcTransfers(wallet.address);
      } else if (wallet.network === "eth") {
        const tasks: Promise<TransferEvent[]>[] = [];
        if (wallet.monitorEthNative) {
          tasks.push(fetchEthTransfers(wallet.address, etherscanKey));
        }
        if (wallet.monitorUsdtErc20) {
          tasks.push(fetchUsdtTransfers(wallet.address, etherscanKey));
        }
        const results = await Promise.all(tasks);
        events = results.flat();
      } else {
        if (wallet.network === "bsc") {
          if (wallet.monitorUsdtBep20) {
            events = await fetchUsdtBscTransfers(wallet.address, bscscanKey);
          } else {
            events = [];
          }
        } else {
          if (wallet.monitorUsdtTrc20) {
            events = await fetchUsdtTrc20Transfers(wallet.address, trongridKey);
          } else {
            events = [];
          }
        }
      }
    } catch {
      continue;
    }

    for (const event of events) {
      const threshold =
        event.asset === "BTC"
          ? Number.parseFloat(settings.btcThreshold)
          : event.asset === "ETH"
            ? Number.parseFloat(settings.ethThreshold)
            : Number.parseFloat(settings.usdtThreshold);

      if (!Number.isFinite(threshold) || event.amount < threshold) {
        continue;
      }

      const normalizedFrom = normalizeNetworkAddress(event.network, event.from);
      const normalizedTo = normalizeNetworkAddress(event.network, event.to);
      const counterpartyAddress =
        event.direction === "incoming"
          ? normalizedFrom ?? event.from
          : normalizedTo ?? event.to;

      await appendTransferHistory(env, {
        userId: wallet.userId,
        walletId: wallet.id,
        network: event.network,
        direction: event.direction,
        asset: event.asset,
        txid: event.txid,
        fromAddress: normalizedFrom ?? event.from,
        counterpartyAddress,
        amount: toFixedTrimmed(event.amount)
      });

      if (event.direction !== "incoming") {
        continue;
      }

      const monitoredWalletAddress =
        normalizeNetworkAddress(event.network, wallet.address) ?? wallet.address;
      if (normalizedFrom) {
        const senderStopped = await isStoppedWallet(env, event.network, normalizedFrom);
        if (senderStopped) {
          continue;
        }
      }
      const receiverStopped = await isStoppedWallet(env, event.network, monitoredWalletAddress);
      if (receiverStopped) {
        continue;
      }

      const dedupKey = `${wallet.id}:${event.direction}:${event.network}:${event.asset}:${event.txid}`;
      const reserved = await reserveNotificationDedup(env, wallet.userId, dedupKey);
      if (!reserved) {
        continue;
      }
      const label = normalizedFrom
        ? await resolveContactLabel(env, wallet.userId, event.network, normalizedFrom)
        : null;

      const usdRate = event.asset === "BTC" ? prices.btc : event.asset === "ETH" ? prices.eth : prices.usdt;
      const usdEstimate = settings.showUsdEstimate ? event.amount * usdRate : null;

      const text = formatNotification({
        language: settings.language,
        label,
        from: normalizedFrom ?? event.from,
        toAddress: wallet.address,
        amount: event.amount,
        asset: event.asset,
        usdEstimate
      });

      await sendTelegramMessage(env, wallet.userId, text);
    }
  }
}
