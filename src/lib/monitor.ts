import { formatUnits, getAddress, isAddress } from "viem";
import type { Env } from "../types/env";
import {
  getSettings,
  listWalletsForMonitoring,
  reserveNotificationDedup,
  resolveContactLabel
} from "./db";

const ETHERSCAN_BASE = "https://api.etherscan.io/api";
const BSCSCAN_BASE = "https://api.bscscan.com/api";
const USDT_ETH_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

type Asset = "BTC" | "ETH" | "USDT";
type Network = "btc" | "eth" | "bsc";

type IncomingEvent = {
  txid: string;
  from: string | null;
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

async function fetchBtcIncoming(address: string): Promise<IncomingEvent[]> {
  type BlockstreamTx = {
    txid: string;
    vin: Array<{ prevout?: { scriptpubkey_address?: string } }>;
    vout: Array<{ scriptpubkey_address?: string; value: number }>;
  };
  const rows = await fetchJson<BlockstreamTx[]>(
    `https://blockstream.info/api/address/${encodeURIComponent(address)}/txs`
  );

  const normalizedAddress = address.toLowerCase();
  const items: IncomingEvent[] = [];
  for (const row of rows) {
    let sats = 0;
    for (const output of row.vout) {
      if (output.scriptpubkey_address?.toLowerCase() === normalizedAddress) {
        sats += output.value;
      }
    }
    if (sats <= 0) {
      continue;
    }
    const from = row.vin[0]?.prevout?.scriptpubkey_address ?? null;
    items.push({
      txid: row.txid,
      from,
      amount: sats / 100_000_000,
      asset: "BTC",
      network: "btc"
    });
  }
  return items;
}

async function fetchEthIncoming(address: string, apiKey: string): Promise<IncomingEvent[]> {
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
  const items: IncomingEvent[] = [];

  for (const row of response.result ?? []) {
    if (row.isError !== "0") {
      continue;
    }
    if ((row.to ?? "").toLowerCase() !== normalized) {
      continue;
    }
    const valueWei = BigInt(row.value);
    if (valueWei <= 0n) {
      continue;
    }
    items.push({
      txid: row.hash,
      from: row.from ?? null,
      amount: Number(formatUnits(valueWei, 18)),
      asset: "ETH",
      network: "eth"
    });
  }
  return items;
}

async function fetchUsdtIncoming(address: string, apiKey: string): Promise<IncomingEvent[]> {
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
  const items: IncomingEvent[] = [];

  for (const row of response.result ?? []) {
    if ((row.to ?? "").toLowerCase() !== normalized) {
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
      amount: Number(formatUnits(value, decimals)),
      asset: "USDT",
      network: "eth"
    });
  }
  return items;
}

async function fetchUsdtBscIncoming(address: string, apiKey: string): Promise<IncomingEvent[]> {
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
  const items: IncomingEvent[] = [];

  for (const row of response.result ?? []) {
    if ((row.to ?? "").toLowerCase() !== normalized) {
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
      amount: Number(formatUnits(value, decimals)),
      asset: "USDT",
      network: "bsc"
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

function normalizeSenderAddress(network: Network, sender: string | null): string | null {
  if (!sender) {
    return null;
  }

  if (network === "eth" || network === "bsc") {
    if (!isAddress(sender)) {
      return null;
    }
    return getAddress(sender);
  }

  return sender;
}

export async function runWalletMonitoring(env: Env): Promise<void> {
  const wallets = await listWalletsForMonitoring(env);
  if (wallets.length === 0) {
    return;
  }

  const prices = await getPricesUsd();
  const etherscanKey = env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
  const bscscanKey = env.BSCSCAN_API_KEY ?? "YourApiKeyToken";

  for (const wallet of wallets) {
    const settings = await getSettings(env, wallet.userId);
    if (!settings.blockchainNotificationsEnabled) {
      continue;
    }

    let events: IncomingEvent[] = [];
    try {
      if (wallet.network === "btc") {
        events = await fetchBtcIncoming(wallet.address);
      } else if (wallet.network === "eth") {
        const tasks: Promise<IncomingEvent[]>[] = [];
        if (wallet.monitorEthNative) {
          tasks.push(fetchEthIncoming(wallet.address, etherscanKey));
        }
        if (wallet.monitorUsdtErc20) {
          tasks.push(fetchUsdtIncoming(wallet.address, etherscanKey));
        }
        const results = await Promise.all(tasks);
        events = results.flat();
      } else {
        if (wallet.monitorUsdtBep20) {
          events = await fetchUsdtBscIncoming(wallet.address, bscscanKey);
        } else {
          events = [];
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

      const dedupKey = `${wallet.id}:${event.network}:${event.asset}:${event.txid}`;
      const reserved = await reserveNotificationDedup(env, wallet.userId, dedupKey);
      if (!reserved) {
        continue;
      }

      const normalizedFrom = normalizeSenderAddress(event.network, event.from);
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
