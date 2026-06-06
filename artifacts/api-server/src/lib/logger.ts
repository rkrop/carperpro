import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "req.body.phone",
      "req.body.buyerPhone",
      "req.body.shippingAddress",
      "req.body.guestToken",
      "req.body.pushToken",
      "req.body.token",
      "phone",
      "buyerPhone",
      "shippingAddress",
      "guestToken",
      "pushToken",
      "token",
    ],
    censor: "[Redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
