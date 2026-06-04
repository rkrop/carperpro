import { Router, type IRouter, type Request, type Response } from "express";
import { writeLimiter } from "../middlewares/rateLimit";
import { getOptionalUserId } from "../middlewares/requireAuth";
import { registerPushToken } from "../lib/push/notify";
import { isExpoPushToken } from "../lib/push/expoPush";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Register (upsert) the device's Expo push token. Called by the app on launch
// and whenever auth changes, so the token stays fresh and linked to the account
// when signed in. Guests register too (userId null) so order/back-in-stock
// pushes still reach them.
router.post(
  "/push/register",
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!isExpoPushToken(token)) {
      res.status(400).json({ error: "Token de notificaciones inválido" });
      return;
    }
    const platform = typeof body.platform === "string" ? body.platform : null;
    const userId = getOptionalUserId(req);
    try {
      await registerPushToken(token, userId, platform);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Push: error al registrar token");
      res.status(500).json({ error: "No se pudo registrar el token" });
    }
  },
);

export default router;
