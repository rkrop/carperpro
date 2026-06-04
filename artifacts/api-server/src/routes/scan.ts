import { Router, type IRouter, type Request, type Response } from "express";
import { ScanIdentifyBody, ScanIdentifyResponse } from "@workspace/api-zod";
import { identifyPartFromImage } from "../lib/visionScan";
import { searchCatalog, serializeProduct } from "../lib/catalogSearch";
import { writeLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

// How many matches to surface for a scanned part. Enough to give the customer
// real options to compare without overwhelming the results panel.
const MAX_RESULTS = 12;

// Hard ceiling on the decoded image payload (~7.5 MB of base64 ≈ ~5.6 MB image).
// The client downscales/compresses before sending; this guards the server from
// oversized uploads even though express.json already caps the body.
const MAX_IMAGE_CHARS = 7_500_000;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

// Visual part finder ("Camino B"): the client sends a photo of a part; a
// multimodal model identifies WHAT it is, and we ground the result in the SAME
// catalog search used everywhere else. The model only decides what to search
// for — every returned product is a real catalog row serialized the usual way.
// Never invents parts/prices/SKUs.
router.post(
  "/scan/identify",
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ScanIdentifyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida", details: parsed.error.issues });
      return;
    }

    const imageBase64 = parsed.data.imageBase64.trim();
    if (!imageBase64) {
      res.status(400).json({ error: "Imagen vacía" });
      return;
    }
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      res.status(400).json({ error: "La imagen es demasiado grande" });
      return;
    }

    const mimeType =
      parsed.data.mimeType && ALLOWED_MIME.has(parsed.data.mimeType)
        ? parsed.data.mimeType
        : "image/jpeg";

    const { recognized, label, query } = await identifyPartFromImage(imageBase64, mimeType);

    // Ground the recommendation in the real catalog, reusing the shared pipeline
    // (AI assist + semantic widening) exactly like the assistant/search screens.
    let products: ReturnType<typeof serializeProduct>[] = [];
    if (recognized && query) {
      const { rows } = await searchCatalog({ q: query, assist: true, limit: MAX_RESULTS });
      products = rows.map((p) => serializeProduct(p));
    }

    const data = ScanIdentifyResponse.parse({
      // Only claim "recognized" when we actually have matches to show; a label
      // with zero catalog hits is reported as not-found so the UI stays honest.
      recognized: recognized && products.length > 0,
      label,
      query,
      products,
    });
    res.json(data);
  },
);

export default router;
