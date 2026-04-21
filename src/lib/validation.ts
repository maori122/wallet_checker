import validateBitcoinAddress from "bitcoin-address-validation";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { MAX_LABEL_LENGTH, MAX_TITLE_LENGTH } from "./constants";

export const walletNetworkSchema = z.enum(["btc", "eth"]);

export function normalizeAddress(network: "btc" | "eth", address: string): string {
  const trimmed = address.trim();
  if (network === "btc") {
    const valid = validateBitcoinAddress(trimmed);
    if (!valid) {
      throw new Error("Invalid Bitcoin address");
    }
    return trimmed;
  }

  if (!isAddress(trimmed)) {
    throw new Error("Invalid EVM address");
  }

  return getAddress(trimmed);
}

export const createWalletSchema = z.object({
  network: walletNetworkSchema,
  address: z.string().min(14).max(120)
});

export const createContactSchema = z.object({
  network: walletNetworkSchema,
  address: z.string().min(14).max(120),
  label: z.string().trim().min(1).max(MAX_LABEL_LENGTH)
});

export const updateContactSchema = z.object({
  label: z.string().trim().min(1).max(MAX_LABEL_LENGTH)
});

export const createLinkSchema = z.object({
  url: z.url().max(1024),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH)
});

export const updateLinkSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH)
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
