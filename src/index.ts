import { Hono } from "hono";
import api from "./routes/api";
import bot from "./routes/bot";
import miniapp from "./routes/miniapp";
import { authMiddleware } from "./lib/auth";
import { mutationRateLimit } from "./lib/rate-limit";
import type { Env } from "./types/env";
import { runWalletMonitoring } from "./lib/monitor";

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/health", (c) =>
  c.json({
    status: "ok"
  })
);

app.route("/webhook", bot);
app.route("/", miniapp);

app.use("/api/*", authMiddleware, mutationRateLimit);
app.route("/api", api);

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runWalletMonitoring(env));
  }
};
