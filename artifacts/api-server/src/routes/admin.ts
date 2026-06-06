import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger";
import { getWebhookToken } from "../lib/admintotal/config";
import { runAttributeExtractionPilot } from "../lib/attribute-extraction";
import {
  runEnrichmentBatch,
  runFullEnrichmentSweep,
  getSweepStatus,
  isSweepRunning,
  writesEnabled,
  EnrichmentWritesDisabledError,
} from "../lib/enrichment-runner";

// Operaciones administrativas internas (no expuestas a la app/tienda). Hoy aloja
// el PILOTO de extracción de atributos desde nuestros propios nombres. Reusa el
// token de webhooks de Admintotal como secreto de acceso. En desarrollo solo se
// permite sin token cuando la petición viene de localhost; los previews públicos
// de Replit deben autenticarse igual que producción.

const router: IRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isLoopbackHost(value: string | undefined): boolean {
  const raw = value?.trim();
  if (raw === "::1" || raw === "[::1]") return true;
  const host = raw?.replace(/^\[/, "").replace(/\]$/, "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLocalDevRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const ip = req.ip || req.socket.remoteAddress || "";
  return (
    isLoopbackHost(req.hostname) ||
    isLoopbackHost(req.headers.host) ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1"
  );
}

function authAdmin(req: Request, res: Response, next: NextFunction): void {
  // En desarrollo local se permite sin token para poder correr el piloto con
  // curl. Un preview remoto de Replit no es localhost y debe traer Api-key.
  if (isLocalDevRequest(req)) {
    next();
    return;
  }
  const expected = getWebhookToken();
  if (!expected) {
    logger.error("admin: ADMINTOTAL_WEBHOOK_TOKEN ausente; acceso rechazado");
    res.status(503).json({ error: "admin no configurado" });
    return;
  }
  // Solo header (NUNCA query string): un token en la URL se filtra en logs de
  // proxy, historial y enlaces copiados.
  const provided = req.header("Api-key")?.trim() ?? "";
  if (provided && safeEqual(provided, expected)) {
    next();
    return;
  }
  res.status(401).json({ error: "no autorizado" });
}

// POST /api/admin/attributes/pilot
//   ?limit=N      cuántas filas analizar (default 40, máx 1000)
//   ?write=1      aplicar escrituras ADITIVAS (default 0 = dry-run, no escribe)
//   ?sample=N     cuántas filas incluir en el reporte de muestra
router.post(
  "/admin/attributes/pilot",
  authAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const limit = Number.parseInt(String(req.query["limit"] ?? "40"), 10) || 40;
    const write = req.query["write"] === "1" || req.query["write"] === "true";
    const sampleRaw = Number.parseInt(String(req.query["sample"] ?? ""), 10);
    const sampleSize = Number.isFinite(sampleRaw) ? sampleRaw : undefined;

    try {
      const result = await runAttributeExtractionPilot({
        limit,
        write,
        sampleSize,
      });
      res.json({ mode: write ? "write" : "dry-run", ...result });
    } catch (err) {
      logger.error({ err }, "admin: piloto de atributos falló");
      res.status(500).json({ error: "piloto falló" });
    }
  },
);

// POST /api/admin/enrichment/run
//   ?limit=N      cuántos productos analizar (default 40, máx 1000)
//   ?write=1      aplicar escrituras (default 0 = dry-run → solo enrichment_staging).
//                 BLOQUEADO hasta implementar validateGrounding + ENRICHMENT_WRITES_ENABLED=1.
//   ?sample=N     cuántas filas incluir en el reporte de muestra
router.post(
  "/admin/enrichment/run",
  authAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const write = req.query["write"] === "1" || req.query["write"] === "true";

    // ?sweep=1 → barrido completo del catálogo en el proceso del server
    // (fire-and-forget): procesa lotes hasta agotar el pool y sobrevive a la
    // desconexión del cliente. Responde 202 de inmediato; el progreso se sigue
    // por logs o GET /api/admin/enrichment/sweep-status.
    if (req.query["sweep"] === "1" || req.query["sweep"] === "true") {
      // El barrido sólo tiene sentido en modo escritura: el dry-run nunca marca
      // enriched_at, así que re-seleccionaría las mismas filas y giraría hasta el
      // cap de lotes sin terminar. Para una muestra dry-run use /run?limit=N.
      if (!write) {
        res.status(400).json({
          error:
            "el barrido (sweep=1) requiere write=1; el dry-run no termina. Para una muestra use /admin/enrichment/run?limit=N",
        });
        return;
      }
      // Mismo gateo que /run: si pides escribir pero el flag está apagado,
      // 403 de inmediato (en vez de "started" y fallar en silencio dentro).
      if (!writesEnabled()) {
        res
          .status(403)
          .json({ error: new EnrichmentWritesDisabledError().message });
        return;
      }
      if (isSweepRunning()) {
        res
          .status(409)
          .json({ error: "barrido ya en curso", status: getSweepStatus() });
        return;
      }
      void runFullEnrichmentSweep({ write });
      res.status(202).json({
        started: true,
        write,
        message:
          "barrido completo iniciado; siga el progreso en logs o GET /api/admin/enrichment/sweep-status",
      });
      return;
    }

    const limit = Number.parseInt(String(req.query["limit"] ?? "40"), 10) || 40;
    const sampleRaw = Number.parseInt(String(req.query["sample"] ?? ""), 10);
    const sampleSize = Number.isFinite(sampleRaw) ? sampleRaw : undefined;

    try {
      const result = await runEnrichmentBatch({ limit, write, sampleSize });
      res.json(result);
    } catch (err) {
      if (err instanceof EnrichmentWritesDisabledError) {
        res.status(403).json({ error: err.message });
        return;
      }
      logger.error({ err }, "admin: enriquecimiento falló");
      res.status(500).json({ error: "enriquecimiento falló" });
    }
  },
);

// GET /api/admin/enrichment/sweep-status — progreso del barrido completo.
router.get(
  "/admin/enrichment/sweep-status",
  authAdmin,
  (_req: Request, res: Response): void => {
    res.json(getSweepStatus());
  },
);

export default router;
