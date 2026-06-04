import { Router, type IRouter, type Request, type Response } from "express";
import { writeLimiter } from "../middlewares/rateLimit";
import { getOptionalUserId } from "../middlewares/requireAuth";
import { subscribeRestock, productExists } from "../lib/push/notify";
import { isExpoPushToken } from "../lib/push/expoPush";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// "Avísame cuando vuelva a haber": subscribe this device (by push token) to a
// product's back-in-stock notification. When the product's stock transitions
// from 0/unknown to positive, every pending subscriber gets one push.
router.post(
  "/products/:id/restock-subscribe",
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const productId = typeof req.params.id === "string" ? req.params.id : "";
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!isExpoPushToken(token)) {
      res.status(400).json({ error: "Token de notificaciones inválido" });
      return;
    }
    if (!productId) {
      res.status(400).json({ error: "Falta el producto" });
      return;
    }
    try {
      if (!(await productExists(productId))) {
        res.status(404).json({ error: "Producto no encontrado" });
        return;
      }
      await subscribeRestock(productId, token, getOptionalUserId(req));
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Restock: error al suscribir");
      res.status(500).json({ error: "No se pudo registrar el aviso" });
    }
  },
);

export default router;
