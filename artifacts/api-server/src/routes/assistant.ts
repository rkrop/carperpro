import { Router, type IRouter, type Request, type Response } from "express";
import { CreateAssistantChatBody, CreateAssistantChatResponse } from "@workspace/api-zod";
import { runAssistant } from "../lib/assistant";
import { serializeProduct } from "../lib/catalogSearch";
import { writeLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

// Conversational part-finder (Task #48). Stateless: the client sends the full
// conversation each turn. The assistant asks about the car + symptom/part and
// recommends REAL catalog products (reusing the shared search pipeline). It never
// invents parts/prices/SKUs — recommendations are grounded products serialized
// the same way as every other catalog endpoint.
router.post(
  "/assistant/chat",
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateAssistantChatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida", details: parsed.error.issues });
      return;
    }

    const { reply, products } = await runAssistant(parsed.data.messages);
    const data = CreateAssistantChatResponse.parse({
      reply,
      products: products.map((p) => serializeProduct(p)),
    });
    res.json(data);
  },
);

export default router;
