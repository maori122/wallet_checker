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
  getActiveSlotPackPaymentRequest,
  getActiveSubscriptionPaymentRequest,
  addExtraContactSlots,
  addExtraWalletSlots,
  getSettings,
  getSubscriptionInfo,
  getUsageSummary,
  listContacts,
  listLinkAuditEntries,
  listPendingSubscriptionPayments,
  listPromoActivationDetails,
  deletePromoCode,
  listPromoCodeEntries,
  listStoppedWallets,
  listTopWalletReputations,
  getPaymentPricingUsdt,
  listTransferHistory,
  listWallets,
  removeStoppedWallet,
  setPromoCodeActiveState,
  updateContactLabel,
  updateSettings,
  upsertPaymentPricing
} from "../lib/db";
import { getWalletBalances } from "../lib/wallet-insights";
import {
  createSlotPackPaymentInvoice,
  createSubscriptionPaymentInvoice,
  processSubscriptionPayments
} from "../lib/subscription-payments";
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

function hasActiveSubscription(subscription: { status: "inactive" | "active"; expiresAt: string | null }): boolean {
  if (subscription.status !== "active") {
    return false;
  }
  if (!subscription.expiresAt) {
    return false;
  }
  const expiresMs = Date.parse(subscription.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs > Date.now();
}

async function hasFullAccess(env: Env, userId: string): Promise<boolean> {
  if (isAdminUser(env, userId)) {
    return true;
  }
  const subscription = await getSubscriptionInfo(env, userId);
  return hasActiveSubscription(subscription);
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
    const m = message.match(/Wallet limit reached:\s*(\d+)/);
    return m ? `Wallet limit reached (${m[1]}).` : "Wallet limit reached.";
  }
  if (message.startsWith("Contact limit reached")) {
    const m = message.match(/Contact limit reached:\s*(\d+)/);
    return m ? `Known wallet limit reached (${m[1]}).` : "Known wallet limit reached.";
  }
  if (message === "FORBIDDEN_ADMIN_ONLY") {
    return "Admin access required.";
  }
  if (message === "FORBIDDEN_SUBSCRIPTION_REQUIRED") {
    return "Subscription required. Pay subscription first.";
  }
  if (message === "INVALID_PRICING_AMOUNT") {
    return "Invalid USDT amount (use positive number, for example 15 or 9.99).";
  }
  return message;
}

function isSubscriptionPublicRoute(path: string): boolean {
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;
  return (
    normalized === "/me" ||
    normalized === "/subscription" ||
    normalized === "/subscription/invoice" ||
    normalized === "/subscription/check" ||
    normalized === "/subscription/slots/invoice" ||
    normalized === "/promo/activate" ||
    normalized.startsWith("/admin/")
  );
}

api.use("*", async (c, next) => {
  const path = c.req.path;
  if (isSubscriptionPublicRoute(path)) {
    await next();
    return;
  }

  const userId = getUserId(c);
  const allowed = await hasFullAccess(c.env, userId);
  if (!allowed) {
    return c.json({ error: mapApiError(new Error("FORBIDDEN_SUBSCRIPTION_REQUIRED")) }, 403);
  }
  await next();
});

api.get("/me", async (c) => {
  const userId = getUserId(c);
  const subscription = await getSubscriptionInfo(c.env, userId);
  const isAdmin = isAdminUser(c.env, userId);
  return c.json({
    me: {
      userId,
      isAdmin,
      hasFullAccess: isAdmin || hasActiveSubscription(subscription)
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
  const [subscription, activePayment, activeSlotPack, pricing] = await Promise.all([
    getSubscriptionInfo(c.env, userId),
    getActiveSubscriptionPaymentRequest(c.env, userId),
    getActiveSlotPackPaymentRequest(c.env, userId),
    getPaymentPricingUsdt(c.env)
  ]);
  return c.json({
    subscription,
    activePayment,
    activeSlotPack,
    pricing: {
      subscriptionUsdt: pricing.subscriptionUsdtText,
      slotPackUsdt: pricing.slotPackUsdtText
    }
  });
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
    const [subscription, activePayment, activeSlotPack] = await Promise.all([
      getSubscriptionInfo(c.env, userId),
      getActiveSubscriptionPaymentRequest(c.env, userId),
      getActiveSlotPackPaymentRequest(c.env, userId)
    ]);
    return c.json({ result, subscription, activePayment, activeSlotPack });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.post("/subscription/slots/invoice", async (c) => {
  try {
    const userId = getUserId(c);
    const body = parseBody(
      z.object({
        network: z.enum(["bsc", "trc20"])
      }),
      await c.req.json()
    );
    const invoice = await createSlotPackPaymentInvoice(c.env, userId, body.network);
    return c.json({ invoice }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.post("/promo/activate", async (c) => {
  try {
    const userId = getUserId(c);
    const body = parseBody(
      z.object({
        code: z.string().trim().min(1).max(128)
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
    const botUsername = c.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
    const withLinks = items.map((p) => ({
      ...p,
      deepLink: botUsername ? `https://t.me/${botUsername}?start=p_${p.id}` : null
    }));
    return c.json({ items: withLinks });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 403);
  }
});

api.get("/admin/promo-codes/:id/activations", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const items = await listPromoActivationDetails(c.env, c.req.param("id"), 500);
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
        code: z.string().trim().min(4).max(128),
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
    const botUsername = c.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
    const deepLink =
      botUsername?.length ?
        `https://t.me/${botUsername}?start=p_${item.id}`
      : null;
    return c.json({ item: { ...item, deepLink } }, 201);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.patch("/admin/promo-codes/:id", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const body = parseBody(
      z.object({
        isActive: z.boolean()
      }),
      await c.req.json()
    );
    const updated = await setPromoCodeActiveState(c.env, c.req.param("id"), body.isActive);
    return c.json({ ok: updated }, updated ? 200 : 404);
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.delete("/admin/promo-codes/:id", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const deleted = await deletePromoCode(c.env, c.req.param("id"));
    return deleted ? c.json({ ok: true }) : c.json({ error: "Promo code not found." }, 404);
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

api.patch("/admin/pricing", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const body = parseBody(
      z
        .object({
          subscriptionUsdt: z.string().trim().min(1).max(32).optional(),
          slotPackUsdt: z.string().trim().min(1).max(32).optional()
        })
        .refine((d) => d.subscriptionUsdt !== undefined || d.slotPackUsdt !== undefined, {
          message: "At least one price field is required"
        }),
      await c.req.json()
    );
    let pricing;
    try {
      pricing = await upsertPaymentPricing(c.env, {
        subscriptionUsdtText: body.subscriptionUsdt,
        slotPackUsdtText: body.slotPackUsdt
      });
    } catch (e) {
      if ((e as Error).message === "INVALID_PRICING_AMOUNT") {
        throw new Error("INVALID_PRICING_AMOUNT");
      }
      throw e;
    }
    return c.json({
      pricing: {
        subscriptionUsdt: pricing.subscriptionUsdtText,
        slotPackUsdt: pricing.slotPackUsdtText
      }
    });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
  }
});

api.post("/admin/slot-bonuses", async (c) => {
  try {
    requireAdmin(c.env, getUserId(c));
    const body = parseBody(
      z.object({
        targetUserId: z.string().regex(/^\d+$/),
        extraWalletSlots: z.coerce.number().int().min(0).max(100_000),
        extraContactSlots: z.coerce.number().int().min(0).max(100_000)
      }),
      await c.req.json()
    );
    const [totalExtraWallets, totalExtraContacts] = await Promise.all([
      addExtraWalletSlots(c.env, body.targetUserId, body.extraWalletSlots),
      addExtraContactSlots(c.env, body.targetUserId, body.extraContactSlots)
    ]);
    return c.json({ ok: true, totalExtraWallets, totalExtraContacts });
  } catch (error) {
    return c.json({ error: mapApiError(error) }, 400);
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
