import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";
import { getUserId } from "../lib/auth";
import {
  createContact,
  createWallet,
  deleteContact,
  deleteWallet,
  getSettings,
  getUsageSummary,
  listContacts,
  listWallets,
  updateContactLabel,
  updateSettings
} from "../lib/db";
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

function mapApiError(error: unknown): string {
  const message = (error as Error).message ?? "";
  if (message === "WALLET_ALREADY_EXISTS") {
    return "This wallet is already added in this network.";
  }
  if (message === "CONTACT_ALREADY_EXISTS") {
    return "This known wallet is already added in this network.";
  }
  if (message.startsWith("Wallet limit reached")) {
    return "Wallet limit reached (10).";
  }
  if (message.startsWith("Contact limit reached")) {
    return "Known wallet limit reached (50).";
  }
  return message;
}

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

api.patch("/contacts/:id", async (c) => {
  try {
    const body = parseBody(updateContactSchema, await c.req.json());
    const updated = await updateContactLabel(c.env, getUserId(c), c.req.param("id"), body.label);
    return c.json({ ok: updated }, updated ? 200 : 404);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

api.delete("/contacts/:id", async (c) => {
  const deleted = await deleteContact(c.env, getUserId(c), c.req.param("id"));
  return c.json({ ok: deleted }, deleted ? 200 : 404);
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
    return c.json({ error: (error as Error).message }, 400);
  }
});

export default api;
