import { formatUnits, getAddress, isAddress } from "viem";
import { TronWeb, utils as tronUtils } from "tronweb";
import type { Env } from "../types/env";
import { DEFAULT_SETTINGS } from "./constants";
import {
  appendTransferHistory,
  getSettings,
  isStoppedWallet,
  listWalletsForMonitoring,
  reserveNotificationDedup,
  resolveContactLabel
} from "./db";

const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";
const BSC_RPC_URLS = ["https://bsc-dataseed.binance.org", "https://bsc.publicnode.com"] as const;
const USDT_ETH_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000;

function maskAddress(value: string): string {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function toFixedTrimmed(value: number, decimals = 8): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function getThresholdForEvent(
  event: TransferEvent,
  settings: { btcThreshold: string; ethThreshold: string; usdtThreshold: string }
): number {
  const raw =
    event.asset === "BTC"
      ? settings.btcThreshold
      : event.asset === "ETH"
        ? settings.ethThreshold
        : settings.usdtThreshold;
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  const fallback =
    event.asset === "BTC"
      ? Number.parseFloat(DEFAULT_SETTINGS.btcThreshold)
      : event.asset === "ETH"
        ? Number.parseFloat(DEFAULT_SETTINGS.ethThreshold)
        : Number.parseFloat(DEFAULT_SETTINGS.usdtThreshold);
  return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
}

async function sendTelegramMessage(env: Env, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error("Telegram sendMessage failed", { status: response.status, body });
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, suppressErrorLog = false): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const safeUrl = url.replace(/([?&]apikey=)[^&]+/i, "$1***");
    if (!suppressErrorLog) {
      // eslint-disable-next-line no-console
      console.error("HTTP request failed", {
        url: safeUrl,
        status: response.status,
        body: body.slice(0, 600)
      });
    }
    throw new Error(`Request failed with status ${response.status} for ${safeUrl}`);
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
    message?: string;
    result:
      | Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      isError: string;
    }>
      | string;
  };
  const response = await fetchJson<EtherscanResponse>(
    `${ETHERSCAN_V2_BASE}?chainid=1&module=account&action=txlist&address=${encodeURIComponent(address)}&page=1&offset=30&sort=desc&apikey=${encodeURIComponent(apiKey)}`
  );
  if (response.status !== "1" || !Array.isArray(response.result)) {
    // eslint-disable-next-line no-console
    console.warn("Etherscan txlist not ok", {
      status: response.status,
      message: response.message,
      result: typeof response.result === "string" ? response.result : "non-array"
    });
    return [];
  }
  const normalized = address.toLowerCase();
  const items: TransferEvent[] = [];

  for (const row of response.result) {
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
    message?: string;
    result:
      | Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      tokenDecimal: string;
      contractAddress: string;
    }>
      | string;
  };
  const response = await fetchJson<EtherscanTokenResponse>(
    `${ETHERSCAN_V2_BASE}?chainid=1&module=account&action=tokentx&contractaddress=${USDT_ETH_CONTRACT}&address=${encodeURIComponent(address)}&page=1&offset=40&sort=desc&apikey=${encodeURIComponent(apiKey)}`
  );
  if (response.status !== "1" || !Array.isArray(response.result)) {
    // eslint-disable-next-line no-console
    console.warn("Etherscan tokentx not ok", {
      status: response.status,
      message: response.message,
      result: typeof response.result === "string" ? response.result : "non-array"
    });
    return [];
  }
  const normalized = address.toLowerCase();
  const items: TransferEvent[] = [];

  for (const row of response.result) {
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

async function fetchUsdtBscTransfers(address: string): Promise<TransferEvent[]> {
  type JsonRpcResult<T> = {
    result?: T;
    error?: { message?: string };
  };
  type RpcLog = {
    address: string;
    topics: string[];
    data: string;
    transactionHash: string;
    logIndex?: string;
  };

  const toTopic = `0x${"0".repeat(24)}${address.toLowerCase().replace(/^0x/, "")}`;
  let lastError: unknown = null;

  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const blockNumberPayload = (await fetchJson<JsonRpcResult<string>>(
        rpcUrl,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
          })
        }
      )) as JsonRpcResult<string>;

      const latestHex = blockNumberPayload.result;
      if (!latestHex) {
        throw new Error("BSC RPC eth_blockNumber missing result");
      }
      const latest = BigInt(latestHex);
      const fromBlockFloor = latest > 50_000n ? latest - 50_000n : 0n;
      const logs: RpcLog[] = [];
      let chunkSize = 5_000n;
      let cursor = fromBlockFloor;

      while (cursor <= latest) {
        const toBlock = cursor + chunkSize - 1n > latest ? latest : cursor + chunkSize - 1n;
        const logsPayload = await fetchJson<JsonRpcResult<RpcLog[]>>(rpcUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "eth_getLogs",
            params: [
              {
                address: USDT_BSC_CONTRACT,
                fromBlock: `0x${cursor.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
                topics: [ERC20_TRANSFER_TOPIC, null, toTopic]
              }
            ]
          })
        });

        if (!Array.isArray(logsPayload.result)) {
          if (logsPayload.error?.message) {
            const message = logsPayload.error.message.toLowerCase();
            if ((message.includes("limit exceeded") || message.includes("invalid block range")) && chunkSize > 200n) {
              chunkSize = chunkSize / 2n;
              continue;
            }
            if (message.includes("invalid block range")) {
              // Skip a problematic range from unstable RPC providers instead of failing whole wallet.
              cursor = toBlock + 1n;
              continue;
            }
            throw new Error(`BSC RPC eth_getLogs error: ${logsPayload.error.message}`);
          }
          cursor = toBlock + 1n;
          continue;
        }

        logs.push(...logsPayload.result);
        cursor = toBlock + 1n;
      }

      const items: TransferEvent[] = [];
      const seen = new Set<string>();
      for (const row of logs) {
        if (!row.transactionHash || !row.data || !Array.isArray(row.topics) || row.topics.length < 3) {
          continue;
        }
        const dedup = `${row.transactionHash}:${row.logIndex ?? ""}:${row.topics[2]}`;
        if (seen.has(dedup)) {
          continue;
        }
        seen.add(dedup);
        const from = `0x${row.topics[1].slice(-40)}`;
        const to = `0x${row.topics[2].slice(-40)}`;
        const value = BigInt(row.data);
        if (value <= 0n) {
          continue;
        }
        items.push({
          txid: row.transactionHash,
          from,
          to,
          direction: "incoming",
          amount: Number(formatUnits(value, 18)),
          asset: "USDT",
          network: "bsc"
        });
      }
      return items;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
  return [];
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
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL_MS) {
    return {
      btc: priceCache.btc,
      eth: priceCache.eth,
      usdt: priceCache.usdt
    }
  }

  type PriceResponse = {
    bitcoin?: { usd?: number };
    ethereum?: { usd?: number };
    tether?: { usd?: number };
  };
  type CryptoCompareResponse = {
    BTC?: { USD?: number };
    ETH?: { USD?: number };
    USDT?: { USD?: number };
  };
  type CoinbasePriceResponse = {
    data?: { amount?: string };
  };
  try {
    const result = await fetchJson<PriceResponse>(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd",
      {
        headers: {
          accept: "application/json",
          "user-agent": "wallet-worker/1.0 (+cloudflare-worker)"
        }
      },
      true
    );
    const btc = result.bitcoin?.usd ?? 0;
    const eth = result.ethereum?.usd ?? 0;
    const usdt = result.tether?.usd ?? 1;
    if (btc <= 0 || eth <= 0) {
      throw new Error("CoinGecko returned incomplete prices");
    }

    priceCache = {
      timestamp: now,
      btc,
      eth,
      usdt
    };
  } catch (error) {
    // If CoinGecko blocks Cloudflare (403/rate limit), fall back to another source.
    // eslint-disable-next-line no-console
    console.warn("CoinGecko price fetch failed; trying fallback provider", {
      error: (error as Error)?.message ?? String(error)
    });
    try {
      const alt = await fetchJson<CryptoCompareResponse>(
        "https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH,USDT&tsyms=USD",
        {
          headers: {
            accept: "application/json",
            "user-agent": "wallet-worker/1.0 (+cloudflare-worker)"
          }
        },
        true
      );
      const btc = alt.BTC?.USD ?? 0;
      const eth = alt.ETH?.USD ?? 0;
      const usdt = alt.USDT?.USD ?? 1;
      if (btc <= 0 || eth <= 0) {
        throw new Error("Fallback provider returned incomplete prices");
      }
      priceCache = {
        timestamp: now,
        btc,
        eth,
        usdt
      };
    } catch (fallbackError) {
      try {
        const [btcSpot, ethSpot] = await Promise.all([
          fetchJson<CoinbasePriceResponse>("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
            headers: {
              accept: "application/json",
              "user-agent": "wallet-worker/1.0 (+cloudflare-worker)"
            }
          }, true),
          fetchJson<CoinbasePriceResponse>("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
            headers: {
              accept: "application/json",
              "user-agent": "wallet-worker/1.0 (+cloudflare-worker)"
            }
          }, true)
        ]);
        const btc = Number.parseFloat(btcSpot.data?.amount ?? "");
        const eth = Number.parseFloat(ethSpot.data?.amount ?? "");
        if (!Number.isFinite(btc) || !Number.isFinite(eth) || btc <= 0 || eth <= 0) {
          throw new Error("Coinbase fallback returned invalid prices");
        }
        priceCache = {
          timestamp: now,
          btc,
          eth,
          usdt: 1
        };
      } catch (lastError) {
        // If all providers fail, keep monitoring transfers and just skip USD estimates.
        // eslint-disable-next-line no-console
        console.warn("All price providers failed; USD estimates disabled temporarily", {
          error: (lastError as Error)?.message ?? String(lastError),
          previous: (fallbackError as Error)?.message ?? String(fallbackError)
        });
        const fallback = priceCache ?? { timestamp: now, btc: 0, eth: 0, usdt: 1 };
        priceCache = {
          timestamp: now,
          btc: fallback.btc,
          eth: fallback.eth,
          usdt: fallback.usdt
        };
      }
    };
  }

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

  let prices = { btc: 0, eth: 0, usdt: 1 };
  try {
    prices = await getPricesUsd();
  } catch (error) {
    // Hard safety net: monitoring must continue even if pricing layer breaks unexpectedly.
    // eslint-disable-next-line no-console
    console.warn("Unexpected price layer failure; proceeding without USD estimates", {
      error: (error as Error)?.message ?? String(error)
    });
  }
  const etherscanKey = env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
  const trongridKey = env.TRONGRID_API_KEY;

  for (const wallet of wallets) {
    try {
      const settings = await getSettings(env, wallet.userId);
      if (!settings.blockchainNotificationsEnabled) {
        continue;
      }

      let events: TransferEvent[] = [];
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
            events = await fetchUsdtBscTransfers(wallet.address);
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
      for (const event of events) {
        try {
          const threshold = getThresholdForEvent(event, settings);
          if (event.amount < threshold) {
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

          const usdRate =
            event.asset === "BTC" ? prices.btc : event.asset === "ETH" ? prices.eth : prices.usdt;
          const usdEstimate =
            settings.showUsdEstimate && Number.isFinite(usdRate) && usdRate > 0
              ? event.amount * usdRate
              : null;

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
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Monitoring event processing failed", {
            walletId: wallet.id,
            userId: wallet.userId,
            txid: event.txid,
            asset: event.asset,
            network: event.network,
            error: (error as Error)?.message ?? String(error)
          });
          continue;
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Monitoring wallet iteration failed", {
        walletId: wallet.id,
        userId: wallet.userId,
        network: wallet.network,
        error: (error as Error)?.message ?? String(error)
      });
      continue;
    }
  }
}
