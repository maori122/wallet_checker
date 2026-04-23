import { formatUnits, getAddress } from "viem";
import type { Env, Language } from "../types/env";
import {
  activatePaidSubscription,
  createSubscriptionPaymentRequest,
  getActiveSubscriptionPaymentRequest,
  getSettings,
  listPendingSubscriptionPayments,
  markSubscriptionPaymentExpired,
  markSubscriptionPaymentPaid
} from "./db";

const PLAN_DURATION_DAYS = 30;
const SUBSCRIPTION_BASE_AMOUNT_USDT = 15;
const PAYMENT_REQUEST_TTL_MINUTES = 45;
const EVM_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const DEFAULT_EVM_PAY_ADDRESS = "0x12DDc62b62516aa44e2f292C38435f3e432414A8";
const DEFAULT_TRON_PAY_ADDRESS = "TEGVTMXvXr7e7idCCjHPMw78uZUU7QD7qY";
const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const BSC_RPC_URLS = ["https://bsc-dataseed.binance.org", "https://bsc.publicnode.com"] as const;
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type PaymentNetwork = "bsc" | "trc20";

type PaymentTx = {
  txid: string;
  amountUnits: bigint;
  timestampMs: number;
};

function getEvmPayAddress(env: Env): string {
  return env.SUBSCRIPTION_EVM_PAY_ADDRESS?.trim() || DEFAULT_EVM_PAY_ADDRESS;
}

function getTronPayAddress(env: Env): string {
  return env.SUBSCRIPTION_TRC20_PAY_ADDRESS?.trim() || DEFAULT_TRON_PAY_ADDRESS;
}

function parseDecimalToUnits(value: string, decimals: number): bigint {
  const clean = value.trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error("INVALID_AMOUNT");
  }
  const [whole, fraction = ""] = clean.split(".");
  const normalizedFraction = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(normalizedFraction || "0");
}

function formatIsoForLanguage(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function makeAmountText(): string {
  return String(SUBSCRIPTION_BASE_AMOUNT_USDT);
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

async function fetchBscIncomingUsdt(env: Env): Promise<PaymentTx[]> {
  const toAddress = getAddress(getEvmPayAddress(env));
  const toTopic = `0x${"0".repeat(24)}${toAddress.toLowerCase().replace(/^0x/, "")}`;
  type JsonRpcResult<T> = {
    result?: T;
    error?: { message?: string };
  };
  type RpcLog = {
    transactionHash: string;
    data: string;
    blockNumber: string;
    logIndex?: string;
  };

  let lastError: unknown = null;
  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const latestResp = await fetch(rpcUrl, {
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
      });
      if (!latestResp.ok) {
        throw new Error(`BSC_RPC_STATUS_${latestResp.status}`);
      }
      const latestPayload = (await latestResp.json()) as JsonRpcResult<string>;
      if (!latestPayload.result) {
        throw new Error(`BSC_RPC_BLOCKNUMBER_ERROR_${latestPayload.error?.message ?? "NO_RESULT"}`);
      }
      const latest = BigInt(latestPayload.result);
      const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
      const logs: RpcLog[] = [];
      let chunkSize = 5_000n;
      let cursor = fromBlock;

      while (cursor <= latest) {
        const toBlock = cursor + chunkSize - 1n > latest ? latest : cursor + chunkSize - 1n;
        const logsResp = await fetch(rpcUrl, {
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
                address: EVM_USDT_CONTRACT,
                fromBlock: `0x${cursor.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
                topics: [ERC20_TRANSFER_TOPIC, null, toTopic]
              }
            ]
          })
        });
        if (!logsResp.ok) {
          throw new Error(`BSC_RPC_LOGS_STATUS_${logsResp.status}`);
        }
        const logsPayload = (await logsResp.json()) as JsonRpcResult<RpcLog[]>;
        if (!Array.isArray(logsPayload.result)) {
          const message = logsPayload.error?.message?.toLowerCase() ?? "NO_RESULT";
          if ((message.includes("limit exceeded") || message.includes("invalid block range")) && chunkSize > 200n) {
            chunkSize = chunkSize / 2n;
            continue;
          }
          if (message.includes("invalid block range")) {
            cursor = toBlock + 1n;
            continue;
          }
          throw new Error(`BSC_RPC_LOGS_ERROR_${logsPayload.error?.message ?? "NO_RESULT"}`);
        }
        logs.push(...logsPayload.result);
        cursor = toBlock + 1n;
      }

      const txs: PaymentTx[] = [];
      const timestampsByBlock = new Map<string, number>();
      const seen = new Set<string>();
      for (const row of logs) {
        if (!row?.transactionHash || !row?.data || !row?.blockNumber) {
          continue;
        }
        const dedup = `${row.transactionHash}:${row.logIndex ?? ""}`;
        if (seen.has(dedup)) {
          continue;
        }
        seen.add(dedup);
        let blockTimestampMs = timestampsByBlock.get(row.blockNumber);
        if (!Number.isFinite(blockTimestampMs)) {
          const blockResp = await fetch(rpcUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 3,
              method: "eth_getBlockByNumber",
              params: [row.blockNumber, false]
            })
          });
          if (!blockResp.ok) {
            continue;
          }
          const blockPayload = (await blockResp.json()) as JsonRpcResult<{ timestamp?: string }>;
          const tsHex = blockPayload.result?.timestamp ?? "0x0";
          blockTimestampMs = Number.parseInt(tsHex, 16) * 1000;
          timestampsByBlock.set(row.blockNumber, blockTimestampMs);
        }

        txs.push({
          txid: row.transactionHash,
          amountUnits: BigInt(row.data),
          timestampMs: blockTimestampMs ?? 0
        });
      }
      return txs;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  return [];
}

async function fetchTrc20IncomingUsdt(env: Env): Promise<PaymentTx[]> {
  const tronPayAddress = getTronPayAddress(env);
  const url = `https://api.trongrid.io/v1/accounts/${encodeURIComponent(
    tronPayAddress
  )}/transactions/trc20?limit=200&only_to=true&contract_address=${encodeURIComponent(TRON_USDT_CONTRACT)}`;
  const headers = env.TRONGRID_API_KEY
    ? {
        "TRON-PRO-API-KEY": env.TRONGRID_API_KEY
      }
    : undefined;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`TRONGRID_STATUS_${response.status}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{
      transaction_id?: string;
      value?: string;
      block_timestamp?: number;
      token_info?: { address?: string };
      to?: string;
    }>;
  };
  const txs: PaymentTx[] = [];
  for (const row of payload.data ?? []) {
    if ((row.token_info?.address ?? "").toLowerCase() !== TRON_USDT_CONTRACT.toLowerCase()) {
      continue;
    }
    if ((row.to ?? "").toLowerCase() !== tronPayAddress.toLowerCase()) {
      continue;
    }
    if (!row.transaction_id || !row.value) {
      continue;
    }
    txs.push({
      txid: row.transaction_id,
      amountUnits: BigInt(row.value),
      timestampMs: row.block_timestamp ?? 0
    });
  }
  return txs;
}

function matchTxByAmountAndTime(
  txs: PaymentTx[],
  requestedAmount: string,
  decimals: number,
  createdAtIso: string,
  usedTxids: Set<string>
): PaymentTx | null {
  const requestUnits = parseDecimalToUnits(requestedAmount, decimals);
  const createdAt = Date.parse(createdAtIso);
  for (const tx of txs) {
    if (usedTxids.has(tx.txid)) {
      continue;
    }
    if (tx.amountUnits !== requestUnits) {
      continue;
    }
    if (Number.isFinite(createdAt) && tx.timestampMs + 5 * 60 * 1000 < createdAt) {
      continue;
    }
    return tx;
  }
  return null;
}

export async function createSubscriptionPaymentInvoice(
  env: Env,
  userId: string,
  network: PaymentNetwork
): Promise<{
  id: string;
  network: PaymentNetwork;
  asset: "USDT";
  payAddress: string;
  amountText: string;
  expiresAt: string;
  durationDays: number;
}> {
  const existing = await getActiveSubscriptionPaymentRequest(env, userId);
  const expectedAmount = makeAmountText();
  const expectedAddress = network === "bsc" ? getEvmPayAddress(env) : getTronPayAddress(env);
  if (
    existing &&
    Date.parse(existing.expiresAt) > Date.now() &&
    existing.network === network &&
    existing.amountText === expectedAmount &&
    existing.payAddress.toLowerCase() === expectedAddress.toLowerCase()
  ) {
    return {
      id: existing.id,
      network: existing.network,
      asset: existing.asset,
      payAddress: existing.payAddress,
      amountText: existing.amountText,
      expiresAt: existing.expiresAt,
      durationDays: existing.durationDays
    };
  }
  if (existing) {
    await markSubscriptionPaymentExpired(env, existing.id);
  }
  const expiresAt = new Date(Date.now() + PAYMENT_REQUEST_TTL_MINUTES * 60 * 1000).toISOString();
  const created = await createSubscriptionPaymentRequest(env, {
    userId,
    network,
    asset: "USDT",
    payAddress: expectedAddress,
    amountText: expectedAmount,
    durationDays: PLAN_DURATION_DAYS,
    expiresAt
  });
  return {
    id: created.id,
    network: created.network,
    asset: created.asset,
    payAddress: created.payAddress,
    amountText: created.amountText,
    expiresAt: created.expiresAt,
    durationDays: created.durationDays
  };
}

export async function processSubscriptionPayments(
  env: Env,
  options?: { userId?: string }
): Promise<{ checked: number; paid: number; expired: number }> {
  const pending = await listPendingSubscriptionPayments(env, options?.userId, options?.userId ? 20 : 200);
  if (!pending.length) {
    return { checked: 0, paid: 0, expired: 0 };
  }

  const hasBsc = pending.some((item) => item.network === "bsc");
  const hasTrc20 = pending.some((item) => item.network === "trc20");
  let bscTxs: PaymentTx[] = [];
  let trc20Txs: PaymentTx[] = [];
  if (hasBsc) {
    try {
      bscTxs = await fetchBscIncomingUsdt(env);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Subscription BSC payment scan failed", {
        error: (error as Error)?.message ?? String(error)
      });
    }
  }
  if (hasTrc20) {
    try {
      trc20Txs = await fetchTrc20IncomingUsdt(env);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Subscription TRC20 payment scan failed", {
        error: (error as Error)?.message ?? String(error)
      });
    }
  }
  const usedTxids = new Set<string>();
  let paid = 0;
  let expired = 0;

  for (const request of pending) {
    if (Date.parse(request.expiresAt) <= Date.now()) {
      await markSubscriptionPaymentExpired(env, request.id);
      expired += 1;
      continue;
    }

    const match =
      request.network === "bsc"
        ? matchTxByAmountAndTime(bscTxs, request.amountText, 18, request.createdAt, usedTxids)
        : matchTxByAmountAndTime(trc20Txs, request.amountText, 6, request.createdAt, usedTxids);
    if (!match) {
      continue;
    }

    usedTxids.add(match.txid);
    await markSubscriptionPaymentPaid(env, request.id, match.txid, new Date(match.timestampMs).toISOString());
    const subscription = await activatePaidSubscription(env, request.userId, request.durationDays);
    const settings = await getSettings(env, request.userId);
    const language = settings.language;
    const status = language === "ru" ? "активна" : "active";
    const successText =
      language === "ru"
        ? `✅ Оплата подтверждена.\nПодписка активирована на ${request.durationDays} дней.\n\nТариф: ${subscription.planCode}\nСтатус: ${status}\nДействует до: ${formatIsoForLanguage(
            subscription.expiresAt ?? "",
            language
          )}`
        : `✅ Payment confirmed.\nSubscription activated for ${request.durationDays} days.\n\nPlan: ${subscription.planCode}\nStatus: ${status}\nValid until: ${formatIsoForLanguage(
            subscription.expiresAt ?? "",
            language
          )}`;
    await sendTelegramMessage(env, request.userId, successText);
    paid += 1;
  }

  return {
    checked: pending.length,
    paid,
    expired
  };
}

export function subscriptionPaymentWallets(env: Env): { evm: string; trc20: string } {
  return {
    evm: getEvmPayAddress(env),
    trc20: getTronPayAddress(env)
  };
}
