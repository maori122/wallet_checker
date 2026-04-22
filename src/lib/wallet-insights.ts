import { formatUnits } from "viem";
import type { Env } from "../types/env";
import type { WalletItem } from "./db";

const ETHERSCAN_BASE = "https://api.etherscan.io/api";
const BSCSCAN_BASE = "https://api.bscscan.com/api";
const USDT_ETH_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type BalanceEntry = {
  asset: string;
  amount: string;
};

function toFixedTrimmed(value: number, decimals = 8): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers });
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
  const value = BigInt(result.result ?? "0");
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
  const value = BigInt(result.result ?? "0");
  return { asset: symbol, amount: toFixedTrimmed(Number(formatUnits(value, decimals)), 6) };
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

export async function getWalletBalances(env: Env, wallet: WalletItem): Promise<BalanceEntry[]> {
  if (wallet.network === "btc") {
    return fetchBtcBalance(wallet.address);
  }

  if (wallet.network === "eth") {
    const apiKey = env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
    const values: BalanceEntry[] = [];
    if (wallet.monitorEthNative) {
      values.push(await fetchEvmNativeBalance(wallet.address, ETHERSCAN_BASE, apiKey, "ETH"));
    }
    if (wallet.monitorUsdtErc20) {
      values.push(await fetchTokenBalance(wallet.address, USDT_ETH_CONTRACT, 6, ETHERSCAN_BASE, apiKey, "USDT ERC-20"));
    }
    return values;
  }

  if (wallet.network === "bsc") {
    const apiKey = env.BSCSCAN_API_KEY ?? "YourApiKeyToken";
    const values: BalanceEntry[] = [];
    values.push(await fetchEvmNativeBalance(wallet.address, BSCSCAN_BASE, apiKey, "BNB"));
    if (wallet.monitorUsdtBep20) {
      values.push(await fetchTokenBalance(wallet.address, USDT_BSC_CONTRACT, 18, BSCSCAN_BASE, apiKey, "USDT BEP-20"));
    }
    return values;
  }

  return fetchTrc20UsdtBalance(wallet.address, env.TRONGRID_API_KEY);
}
