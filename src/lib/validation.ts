import validateBitcoinAddress from "bitcoin-address-validation";
import { getAddress, isAddress } from "viem";
import { TronWeb, utils as tronUtils } from "tronweb";
import { z } from "zod";
import { MAX_LABEL_LENGTH } from "./constants";

export const walletNetworkSchema = z.enum(["btc", "eth", "bsc", "trc20"]);

export function normalizeAddress(network: "btc" | "eth" | "bsc" | "trc20", address: string): string {
  const trimmed = address.trim();
  if (network === "btc") {
    const valid = validateBitcoinAddress(trimmed);
    if (!valid) {
      throw new Error("Invalid Bitcoin address");
    }
    return trimmed;
  }

  if (network === "trc20") {
    if (!TronWeb.isAddress(trimmed)) {
      throw new Error("Invalid TRON address");
    }
    const hex = tronUtils.address.toHex(trimmed);
    return tronUtils.address.fromHex(hex);
  }

  if (!isAddress(trimmed)) {
    throw new Error("Invalid EVM address");
  }

  return getAddress(trimmed);
}

export const createWalletSchema = z.object({
  network: walletNetworkSchema,
  address: z.string().min(14).max(120),
  monitorEthNative: z.boolean().optional(),
  monitorUsdtErc20: z.boolean().optional(),
  monitorUsdtBep20: z.boolean().optional(),
  monitorUsdtTrc20: z.boolean().optional()
});

export const createContactSchema = z.object({
  network: walletNetworkSchema,
  address: z.string().min(14).max(120),
  label: z.string().trim().min(1).max(MAX_LABEL_LENGTH)
});

export const updateContactSchema = z.object({
  label: z.string().trim().min(1).max(MAX_LABEL_LENGTH)
});

export const updateSettingsSchema = z.object({
  language: z.enum(["ru", "en"]).optional(),
  btcThreshold: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  ethThreshold: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  usdtThreshold: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  showUsdEstimate: z.boolean().optional(),
  blockchainNotificationsEnabled: z.boolean().optional(),
  serviceNotificationsEnabled: z.boolean().optional()
});
