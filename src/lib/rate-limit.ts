import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";
import { getUserId } from "./auth";

type Variables = {
  userId: string;
};

const WINDOW_MS = 60_000;
const LIMIT = 30;

const requestWindows = new Map<string, { count: number; start: number }>();

export const mutationRateLimit: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next
) => {
  const method = c.req.method.toUpperCase();
  if (method === "GET") {
    await next();
    return;
  }

  const userId = getUserId(c);
  const now = Date.now();
  const current = requestWindows.get(userId);

  if (!current || now - current.start > WINDOW_MS) {
    requestWindows.set(userId, { count: 1, start: now });
    await next();
    return;
  }

  if (current.count >= LIMIT) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  current.count += 1;
  requestWindows.set(userId, current);
  await next();
};
