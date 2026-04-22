import { createPublicClient, formatUnits, http } from "viem";
import type { Env } from "../types/env";
import type { WalletItem } from "./db";

const ETHERSCAN_BASE = "https://api.etherscan.io/api";
const BSCSCAN_BASE = "https://api.bscscan.com/api";
const ETH_RPC_URLS = ["https://eth.llamarpc.com", "https://ethereum.publicnode.com"] as const;
const BSC_RPC_URLS = ["https://bsc-dataseed.binance.org", "https://bsc.publicnode.com"] as const;
const USDT_ETH_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const MAX_RETRIES = 3;
const BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

type BalanceEntry = {
  asset: string;
  amount: string;
};

export type WalletBalanceResult = {
  entries: BalanceEntry[];
  source: "live" | "cache";
  fetchedAt: string;
};

function toFixedTrimmed(value: number, decimals = 8): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function nowIso(): string {
  return new Date().toISOString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(task: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await sleep(250 * 2 ** i);
      }
    }
  }
  throw lastError ?? new Error("Request failed after retries.");
}

function parseExplorerBigInt(result: string | undefined, source: string): bigint {
  if (!result || !/^\d+$/.test(result)) {
    throw new Error(`${source} returned invalid numeric result.`);
  }
  return BigInt(result);
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await withRetry(() => fetch(url, { headers }));
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchBtcBalance(address: string): Promise<BalanceEntry[]> {
  const row = await fetchJson<{
    chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
    mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
  }>(`https://blockstream.info/api/address/${encodeURIComponent(address)}`);
  const funded = (row.chain_stats?.funded_txo_sum ?? 0) + (row.mempool_stats?.funded_txo_sum ?? 0);
  const spent = (row.chain_stats?.spent_txo_sum ?? 0) + (row.mempool_stats?.spent_txo_sum ?? 0);
  const balance = (funded - spent) / 100_000_000;
  return [{ asset: "BTC", amount: toFixedTrimmed(balance, 8) }];
}

async function fetchEvmNativeBalance(
  address: string,
  baseUrl: string,
  apiKey: string,
  symbol: string
): Promise<BalanceEntry> {
  const result = await fetchJson<{ result?: string }>(
    `${baseUrl}?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest&apikey=${encodeURIComponent(apiKey)}`
  );
  const value = parseExplorerBigInt(result.result, symbol);
  return { asset: symbol, amount: toFixedTrimmed(Number(formatUnits(value, 18)), 8) };
}

async function fetchTokenBalance(
  address: string,
  contractAddress: string,
  decimals: number,
  baseUrl: string,
  apiKey: string,
  symbol: string
): Promise<BalanceEntry> {
  const result = await fetchJson<{ result?: string }>(
    `${baseUrl}?module=account&action=tokenbalance&contractaddress=${encodeURIComponent(contractAddress)}&address=${encodeURIComponent(address)}&tag=latest&apikey=${encodeURIComponent(apiKey)}`
  );
  const value = parseExplorerBigInt(result.result, symbol);
  return { asset: symbol, amount: toFixedTrimmed(Number(formatUnits(value, decimals)), 6) };
}

async function fetchBscBalancesViaRpc(wallet: WalletItem): Promise<BalanceEntry[]> {
  const address = wallet.address as `0x${string}`;
  let lastError: unknown = null;
  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const client = createPublicClient({
        transport: http(rpcUrl)
      });
      const values: BalanceEntry[] = [];
      const native = await withRetry(() => client.getBalance({ address }));
      values.push({ asset: "BNB", amount: toFixedTrimmed(Number(formatUnits(native, 18)), 8) });
      if (wallet.monitorUsdtBep20) {
        const usdt = (await withRetry(
          () =>
            client.readContract({
              address: USDT_BSC_CONTRACT as `0x${string}`,
              abi: BALANCE_OF_ABI,
              functionName: "balanceOf",
              args: [address]
            }),
          2
        )) as bigint;
        values.push({ asset: "USDT BEP-20", amount: toFixedTrimmed(Number(formatUnits(usdt, 18)), 6) });
      }
      return values;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Unable to fetch BSC balances from RPC providers.");
}

async function fetchEthBalancesViaRpc(wallet: WalletItem): Promise<BalanceEntry[]> {
  const address = wallet.address as `0x${string}`;
  let lastError: unknown = null;
  for (const rpcUrl of ETH_RPC_URLS) {
    try {
      const client = createPublicClient({
        transport: http(rpcUrl)
      });
      const values: BalanceEntry[] = [];
      if (wallet.monitorEthNative) {
        const native = await withRetry(() => client.getBalance({ address }));
        values.push({ asset: "ETH", amount: toFixedTrimmed(Number(formatUnits(native, 18)), 8) });
      }
      if (wallet.monitorUsdtErc20) {
        const usdt = (await withRetry(
          () =>
            client.readContract({
              address: USDT_ETH_CONTRACT as `0x${string}`,
              abi: BALANCE_OF_ABI,
              functionName: "balanceOf",
              args: [address]
            }),
          2
        )) as bigint;
        values.push({ asset: "USDT ERC-20", amount: toFixedTrimmed(Number(formatUnits(usdt, 6)), 6) });
      }
      return values;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Unable to fetch ETH balances from RPC providers.");
}

async function fetchTrc20UsdtBalance(address: string, apiKey?: string): Promise<BalanceEntry[]> {
  const payload = await fetchJson<{
    data?: Array<{
      trc20?: Record<string, string>[];
    }>;
  }>(
    `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`,
    apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined
  );

  const tokens = payload.data?.[0]?.trc20 ?? [];
  let amount = 0n;
  for (const token of tokens) {
    const value = token[USDT_TRC20_CONTRACT];
    if (value) {
      amount = BigInt(value);
      break;
    }
  }

  return [{ asset: "USDT TRC-20", amount: toFixedTrimmed(Number(formatUnits(amount, 6)), 6) }];
}

async function loadCachedBalances(env: Env, walletId: string): Promise<WalletBalanceResult | null> {
  try {
    const row = await env.DB.prepare(
      "SELECT balances_json, fetched_at FROM wallet_balance_cache WHERE wallet_id = ? LIMIT 1"
    )
      .bind(walletId)
      .first<{ balances_json: string; fetched_at: string }>();
    if (!row?.balances_json) {
      return null;
    }
    const parsed = JSON.parse(row.balances_json) as Array<{ asset?: string; amount?: string }>;
    const entries: BalanceEntry[] = Array.isArray(parsed)
      ? parsed
          .filter((item) => typeof item?.asset === "string" && typeof item?.amount === "string")
          .map((item) => ({ asset: item.asset as string, amount: item.amount as string }))
      : [];
    if (!entries.length) {
      return null;
    }
    return {
      entries,
      source: "cache",
      fetchedAt: row.fetched_at || nowIso()
    };
  } catch {
    return null;
  }
}

async function saveCachedBalances(env: Env, walletId: string, entries: BalanceEntry[], fetchedAt: string): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO wallet_balance_cache (wallet_id, balances_json, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(wallet_id) DO UPDATE SET
         balances_json = excluded.balances_json,
         fetched_at = excluded.fetched_at`
    )
      .bind(walletId, JSON.stringify(entries), fetchedAt)
      .run();
  } catch {
    // Cache writes are best-effort and should not break balance responses.
  }
}

async function fetchLiveWalletBalances(env: Env, wallet: WalletItem): Promise<BalanceEntry[]> {
  if (wallet.network === "btc") {
    return fetchBtcBalance(wallet.address);
  }

  if (wallet.network === "eth") {
    const apiKey = env.ETHERSCAN_API_KEY?.trim();
    if (!apiKey) {
      return fetchEthBalancesViaRpc(wallet);
    }
    try {
      const values: BalanceEntry[] = [];
      if (wallet.monitorEthNative) {
        values.push(await fetchEvmNativeBalance(wallet.address, ETHERSCAN_BASE, apiKey, "ETH"));
      }
      if (wallet.monitorUsdtErc20) {
        values.push(await fetchTokenBalance(wallet.address, USDT_ETH_CONTRACT, 6, ETHERSCAN_BASE, apiKey, "USDT ERC-20"));
      }
      return values;
    } catch {
      return fetchEthBalancesViaRpc(wallet);
    }
  }

  if (wallet.network === "bsc") {
    const apiKey = env.BSCSCAN_API_KEY?.trim();
    if (!apiKey) {
      return fetchBscBalancesViaRpc(wallet);
    }
    try {
      const values: BalanceEntry[] = [];
      values.push(await fetchEvmNativeBalance(wallet.address, BSCSCAN_BASE, apiKey, "BNB"));
      if (wallet.monitorUsdtBep20) {
        values.push(await fetchTokenBalance(wallet.address, USDT_BSC_CONTRACT, 18, BSCSCAN_BASE, apiKey, "USDT BEP-20"));
      }
      return values;
    } catch {
      return fetchBscBalancesViaRpc(wallet);
    }
  }

  return fetchTrc20UsdtBalance(wallet.address, env.TRONGRID_API_KEY);
}

export async function getWalletBalances(env: Env, wallet: WalletItem): Promise<WalletBalanceResult> {
  try {
    const entries = await fetchLiveWalletBalances(env, wallet);
    const fetchedAt = nowIso();
    await saveCachedBalances(env, wallet.id, entries, fetchedAt);
    return {
      entries,
      source: "live",
      fetchedAt
    };
  } catch (liveError) {
    const cached = await loadCachedBalances(env, wallet.id);
    if (cached) {
      return cached;
    }
    throw liveError;
  }
}
