import type { ErrorRequestHandler, Request } from "express";
import { logger } from "../lib/logger";

// Express attaches a per-request id via pino-http; surface it so a logged error
// can be correlated with the request line in the logs.
function requestId(req: Request): string | undefined {
  const id = (req as Request & { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}

// Centralized error handler. In Express 5 a rejected promise from an async route
// is forwarded here automatically, so any unhandled failure in a handler lands
// in one place: it gets logged with request context and the client receives a
// generic message (internals/secrets never leak in the HTTP response).
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  logger.error(
    {
      err,
      requestId: requestId(req),
      method: req.method,
      // Strip the query string so any tokens/PII in the URL aren't logged.
      path: req.path,
    },
    "Error no controlado en la API",
  );

  // If the response already started streaming, defer to Express's default
  // handler which will close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({ error: "Error interno del servidor" });
};
