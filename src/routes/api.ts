import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";
import { getUserId } from "../lib/auth";
import {
  activatePromoCode,
  addStoppedWallet,
  createContact,
  createPromoCodeEntry,
  createWallet,
  deleteContact,
  deleteWallet,
  getActiveSubscriptionPaymentRequest,
  getSettings,
  getSubscriptionInfo,
  getUsageSummary,
  listContacts,
  listLinkAuditEntries,
  listPendingSubscriptionPayments,
  listPromoCodeEntries,
  listStoppedWallets,
  listTopWalletReputations,
  listTransferHistory,
  listWallets,
  removeStoppedWallet,
  updateContactLabel,
  updateSettings
} from "../lib/db";
import { getWalletBalances } from "../lib/wallet-insights";
import { createSubscriptionPaymentInvoice, processSubscriptionPayments } from "../lib/subscription-payments";
import {
  createContactSchema,
  createWalletSchema,
  detectAddressNetworks,
  updateContactSchema,
  updateSettingsSchema
} from "../lib/validation";

type Variables = {
  userId: string;
};

const api = new Hono<{ Bindings: Env; Variables: Variables }>();

function parseBody<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Validation error");
  }
  return result.data;
}

function isAdminUser(env: Env, userId: string): boolean {
  const ids = (env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

function requireAdmin(env: Env, userId: string): string {
  if (!isAdminUser(env, userId)) {
    throw new Error("FORBIDDEN_ADMIN_ONLY");
  }
  return userId;
}

function mapApiError(error: unknown): string {
  const message = (error as Error).message ?? "";
  if (message === "WALLET_ALREADY_EXISTS") {
    return "This wallet is already added in this network.";
  }
  if (message === "CONTACT_ALREADY_EXISTS") {
    return "This known wallet is already added in this network.";
  }
  if (message === "PROMO_CODE_EXISTS") {
    return "Promo code already exists.";
  }
  if (message === "PROMO_CODE_BAD_FORMAT") {
    return "Promo code format is invalid.";
  }
  if (message.startsWith("Wallet limit reached")) {
    return "Wallet limit reached (10).";
  }
  if (message.startsWith("Contact limit reached")) {
    return "Known wallet limit reached (50).";
  }
  if (message === "FORBIDDEN_ADMIN_ONLY") {
    return "Admin access required.";
  }
  return message;
}

api.get("/me", async (c) => {
  const userId = getUserId(c);
  const subscription = await getSubscriptionInfo(c.env, userId);
  return c.json({
    me: {
      userId,
      isAdmin: isAdminUser(c.env, userId)
    },
    subscription
  });
});

api.get("/wallets", async (c) => {
  const items = await listWallets(c.env, getUserId(c));
  return c.json({ items });
});

api.post("/wallets", async (c) => {
  try {
    const body = parseBody(createWalletSchema, await c.req.json());
    await createWallet(c.env, getUserId(c), body);
    return c.json({ ok: true }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.get("/wallets/:id/balance", async (c) => {
  try {
    const userId = getUserId(c);
    const wallets = await listWallets(c.env, userId);
    const wallet = wallets.find((item) => item.id === c.req.param("id"));
    if (!wallet) {
      return c.json({ error: "Wallet not found." }, 404);
    }
    const balance = await getWalletBalances(c.env, wallet);
    return c.json({ wallet, balance });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.delete("/wallets/:id", async (c) => {
  const deleted = await deleteWallet(c.env, getUserId(c), c.req.param("id"));
  return c.json({ ok: deleted }, deleted ? 200 : 404);
});

api.get("/contacts", async (c) => {
  const items = await listContacts(c.env, getUserId(c));
  return c.json({ items });
});

api.post("/contacts", async (c) => {
  try {
    const body = parseBody(createContactSchema, await c.req.json());
    await createContact(c.env, getUserId(c), body);
    return c.json({ ok: true }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.patch("/contacts/:id", async (c) => {
  try {
    const body = parseBody(updateContactSchema, await c.req.json());
    const updated = await updateContactLabel(c.env, getUserId(c), c.req.param("id"), body.label);
    return c.json({ ok: updated }, updated ? 200 : 404);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.delete("/contacts/:id", async (c) => {
  const deleted = await deleteContact(c.env, getUserId(c), c.req.param("id"));
  return c.json({ ok: deleted }, deleted ? 200 : 404);
});

api.post("/detect-network", async (c) => {
  try {
    const body = parseBody(
      z.object({
        address: z.string().trim().min(14).max(120)
      }),
      await c.req.json()
    );
    const candidates = detectAddressNetworks(body.address);
    return c.json({ candidates });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

api.get("/transfer-history", async (c) => {
  const userId = getUserId(c);
  const limit = Number.parseInt(c.req.query("limit") ?? "50", 10);
  const items = await listTransferHistory(c.env, userId, Number.isFinite(limit) ? limit : 50);
  return c.json({ items });
});

api.get("/settings", async (c) => {
  const settings = await getSettings(c.env, getUserId(c));
  return c.json({ settings });
});

api.get("/summary", async (c) => {
  const summary = await getUsageSummary(c.env, getUserId(c));
  return c.json({ summary });
});

api.put("/settings", async (c) => {
  try {
    const body = parseBody(updateSettingsSchema, await c.req.json());
    const settings = await updateSettings(c.env, getUserId(c), body);
    return c.json({ settings });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.get("/subscription", async (c) => {
  const userId = getUserId(c);
  const [subscription, activePayment] = await Promise.all([
    getSubscriptionInfo(c.env, userId),
    getActiveSubscriptionPaymentRequest(c.env, userId)
  ]);
  return c.json({ subscription, activePayment });
});

api.post("/subscription/invoice", async (c) => {
  try {
    const userId = getUserId(c);
    const body = parseBody(
      z.object({
        network: z.enum(["bsc", "trc20"])
      }),
      await c.req.json()
    );
    const invoice = await createSubscriptionPaymentInvoice(c.env, userId, body.network);
    return c.json({ invoice }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.post("/subscription/check", async (c) => {
  try {
    const userId = getUserId(c);
    const result = await processSubscriptionPayments(c.env, { userId });
    const [subscription, activePayment] = await Promise.all([
      getSubscriptionInfo(c.env, userId),
      getActiveSubscriptionPaymentRequest(c.env, userId)
    ]);
    return c.json({ result, subscription, activePayment });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.post("/promo/activate", async (c) => {
  try {
    const userId = getUserId(c);
    const body = parseBody(
      z.object({
        code: z.string().trim().min(1).max(64)
      }),
      await c.req.json()
    );
    const subscription = await activatePromoCode(c.env, userId, body.code);
    return c.json({ subscription });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.get("/admin/promo-codes", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const items = await listPromoCodeEntries(c.env, 200);
    return c.json({ items });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 403);
  }
});

api.post("/admin/promo-codes", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const body = parseBody(
      z.object({
        code: z.string().trim().min(4).max(64),
        durationDays: z.coerce.number().int().min(1).max(3650),
        maxActivations: z.coerce.number().int().min(1).max(100000).nullable().optional(),
        bonusPercent: z.coerce.number().int().min(0).max(1000).optional(),
        isActive: z.boolean().optional()
      }),
      await c.req.json()
    );
    const item = await createPromoCodeEntry(c.env, {
      code: body.code,
      durationDays: body.durationDays,
      maxActivations: body.maxActivations ?? null,
      bonusPercent: body.bonusPercent ?? 0,
      isActive: body.isActive ?? true
    });
    return c.json({ item }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.get("/admin/stopped-wallets", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const items = await listStoppedWallets(c.env, 200);
    return c.json({ items });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 403);
  }
});

api.post("/admin/stopped-wallets", async (c) => {
  try {
    const adminUserId = requireAdmin(c.env, getUserId(c));
    const body = parseBody(
      z.object({
        network: z.enum(["btc", "eth", "bsc", "trc20"]),
        address: z.string().trim().min(14).max(120)
      }),
      await c.req.json()
    );
    await addStoppedWallet(c.env, adminUserId, body.network, body.address);
    return c.json({ ok: true }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.delete("/admin/stopped-wallets", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const body = parseBody(
      z.object({
        network: z.enum(["btc", "eth", "bsc", "trc20"]),
        address: z.string().trim().min(14).max(120)
      }),
      await c.req.json()
    );
    const removed = await removeStoppedWallet(c.env, body.network, body.address);
    return c.json({ ok: removed }, removed ? 200 : 404);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.get("/admin/link-audit", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const items = await listLinkAuditEntries(c.env, 200);
    return c.json({ items });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 403);
  }
});

api.get("/admin/wallet-reputation", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const items = await listTopWalletReputations(c.env, 200);
    return c.json({ items });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 403);
  }
});

api.get("/admin/subscription-payments", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const items = await listPendingSubscriptionPayments(c.env, undefined, 200);
    return c.json({ items });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 403);
  }
});

export default api;
