import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

type Variables = {
  userId: string;
};

const encoder = new TextEncoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(secret: BufferSource, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

async function verifyTelegramInitData(initData: string, botToken: string): Promise<string | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return null;
  }

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const calculated = bytesToHex(await hmacSha256(toArrayBuffer(secret), dataCheckString));
  if (!timingSafeEqual(calculated, hash)) {
    return null;
  }

  const userJson = params.get("user");
  if (!userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson) as { id?: number };
    return user.id ? String(user.id) : null;
  } catch {
    return null;
  }
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next
) => {
  const bypassEnabled = c.env.DEV_AUTH_BYPASS === "true";
  const headerUserId = c.req.header("x-telegram-user-id");
  if (bypassEnabled && headerUserId) {
    c.set("userId", headerUserId);
    await next();
    return;
  }

  const authHeader = c.req.header("authorization");
  const initData = authHeader?.startsWith("tma ") ? authHeader.slice(4) : null;
  if (!initData) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = await verifyTelegramInitData(initData, c.env.TELEGRAM_BOT_TOKEN);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", userId);
  await next();
};

export function getUserId(c: Context<{ Bindings: Env; Variables: Variables }>): string {
  return c.get("userId");
}
