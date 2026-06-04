import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers } from "./lib/stripe/webhookHandlers";
import { reconcilePendingStripeOrders } from "./lib/stripe/service";
import { generalLimiter } from "./middlewares/rateLimit";
import { errorHandler } from "./middlewares/errorHandler";
import { attachPhoneAuth } from "./middlewares/phoneAuth";

const app: Express = express();

// Behind Replit's edge proxy, the real client IP arrives in X-Forwarded-For.
// Trust exactly one proxy hop so req.ip reflects the client (used for rate
// limiting) without trusting arbitrary client-supplied forwarding headers.
app.set("trust proxy", 1);

// Stripe webhook — MUST be registered BEFORE express.json() so the body stays a
// raw Buffer for signature verification.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
      // After syncing, reconcile any unpaid card orders (covers buyers who paid
      // but never returned to the app).
      reconcilePendingStripeOrders().catch((err) =>
        logger.warn({ err }, "Stripe: reconciliación post-webhook falló"),
      );
    } catch (err) {
      logger.error({ err }, "Stripe: error procesando webhook");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Clerk Frontend API proxy (production only — no-op in dev). Must be mounted
// before the body parsers because it streams raw bytes.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
// 8 MB accommodates base64 photo uploads for visual part scanning
// (/scan/identify); the scan route enforces a tighter per-image ceiling.
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));

// Resolve the publishable key from the request host so the same server can
// serve multiple Clerk custom domains; falls back to CLERK_PUBLISHABLE_KEY.
// This attaches auth context to every request — individual routes decide
// whether auth is required (guest checkout stays open).
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Phone (SMS-OTP) session resolver. Runs right after Clerk so it can defer to a
// Clerk session when present, and otherwise resolve our opaque `cps_` token.
// This makes both login methods transparent to every downstream route.
app.use(attachPhoneAuth);

// Anti-abuse rate limiting for all /api traffic. Verified webhooks (Admintotal
// token, Stripe signature) are exempted inside the limiter so legitimate
// integration traffic is never throttled. Mounted after the body parsers but
// before the routes so it guards every endpoint.
app.use(generalLimiter);

app.use("/api", router);

// Centralized error handler — Express 5 forwards rejected async handlers here.
// Logs the failure with request context (no secrets/PII) and returns a generic
// message so internals never leak to the client.
app.use(errorHandler);

export default app;
