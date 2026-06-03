import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  userFavoritesTable,
  userAddressesTable,
  outboundOrdersTable,
} from "@workspace/db";
import {
  requireAuth,
  provisionUser,
  type AuthedRequest,
} from "../middlewares/requireAuth";
import { normalizeShippingAddress } from "../lib/shippingAddress";

const router: IRouter = Router();

// Everything under /me requires a signed-in user and a provisioned account.
router.use("/me", requireAuth, provisionUser);

function uid(req: Request): string {
  return (req as AuthedRequest).userId;
}

/** Minimal product-snapshot validation. We store the snapshot as-is (the shape
 * mirrors the API `Product`); we only require a stable id + sku to key on. */
function toProductSnapshot(raw: unknown): { id: string; snapshot: Record<string, unknown> } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const sku = typeof r.sku === "string" ? r.sku : "";
  if (!id || !sku) return null;
  return { id, snapshot: r };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, uid(req)))
    .limit(1);
  const u = rows[0];
  res.json({
    id: uid(req),
    email: u?.email ?? null,
    name: u?.name ?? null,
    phone: u?.phone ?? null,
  });
});

// ---------------------------------------------------------------------------
// Favorites (product snapshots)
// ---------------------------------------------------------------------------
router.get("/me/favorites", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({ product: userFavoritesTable.product })
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.userId, uid(req)))
    .orderBy(desc(userFavoritesTable.createdAt));
  res.json(rows.map((r) => r.product));
});

router.put(
  "/me/favorites/:productId",
  async (req: Request, res: Response): Promise<void> => {
    const productId = String(req.params.productId);
    const parsed = toProductSnapshot(req.body);
    if (!parsed || parsed.id !== productId) {
      res.status(400).json({ error: "Producto inválido" });
      return;
    }
    await db
      .insert(userFavoritesTable)
      .values({ userId: uid(req), productId: parsed.id, product: parsed.snapshot })
      .onConflictDoUpdate({
        target: [userFavoritesTable.userId, userFavoritesTable.productId],
        set: { product: parsed.snapshot },
      });
    res.status(204).end();
  },
);

router.delete(
  "/me/favorites/:productId",
  async (req: Request, res: Response): Promise<void> => {
    await db
      .delete(userFavoritesTable)
      .where(
        and(
          eq(userFavoritesTable.userId, uid(req)),
          eq(userFavoritesTable.productId, String(req.params.productId)),
        ),
      );
    res.status(204).end();
  },
);

// One-time migration of device-local favorites on first sign-in. Existing
// server favorites are kept (insert-or-ignore), so re-running is harmless.
router.post(
  "/me/favorites/sync",
  async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const products = Array.isArray(body.products) ? body.products : [];
    const snapshots = products
      .map(toProductSnapshot)
      .filter((p): p is { id: string; snapshot: Record<string, unknown> } => p !== null);
    if (snapshots.length > 0) {
      await db
        .insert(userFavoritesTable)
        .values(
          snapshots.map((p) => ({
            userId: uid(req),
            productId: p.id,
            product: p.snapshot,
          })),
        )
        .onConflictDoNothing();
    }
    const rows = await db
      .select({ product: userFavoritesTable.product })
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.userId, uid(req)))
      .orderBy(desc(userFavoritesTable.createdAt));
    res.json(rows.map((r) => r.product));
  },
);

// ---------------------------------------------------------------------------
// Saved addresses
// ---------------------------------------------------------------------------
function addressToClient(row: typeof userAddressesTable.$inferSelect) {
  return {
    id: row.id,
    label: row.label ?? null,
    address: row.address,
    isDefault: row.isDefault,
  };
}

router.get("/me/addresses", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(userAddressesTable)
    .where(eq(userAddressesTable.userId, uid(req)))
    .orderBy(desc(userAddressesTable.isDefault), desc(userAddressesTable.createdAt));
  res.json(rows.map(addressToClient));
});

router.post("/me/addresses", async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const address = normalizeShippingAddress(body.address);
  if (!address) {
    res.status(400).json({ error: "La dirección está incompleta o es inválida" });
    return;
  }
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const makeDefault = body.isDefault === true;

  const created = await db.transaction(async (tx) => {
    if (makeDefault) {
      await tx
        .update(userAddressesTable)
        .set({ isDefault: false })
        .where(eq(userAddressesTable.userId, uid(req)));
    }
    // First saved address is the default automatically.
    const existing = await tx
      .select({ id: userAddressesTable.id })
      .from(userAddressesTable)
      .where(eq(userAddressesTable.userId, uid(req)))
      .limit(1);
    const isDefault = makeDefault || existing.length === 0;
    const inserted = await tx
      .insert(userAddressesTable)
      .values({ userId: uid(req), label, address, isDefault })
      .returning();
    return inserted[0];
  });
  res.status(201).json(addressToClient(created));
});

router.put("/me/addresses/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const address = normalizeShippingAddress(body.address);
  if (!address) {
    res.status(400).json({ error: "La dirección está incompleta o es inválida" });
    return;
  }
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const makeDefault = body.isDefault === true;

  const updated = await db.transaction(async (tx) => {
    if (makeDefault) {
      await tx
        .update(userAddressesTable)
        .set({ isDefault: false })
        .where(eq(userAddressesTable.userId, uid(req)));
    }
    const rows = await tx
      .update(userAddressesTable)
      .set({ label, address, isDefault: makeDefault })
      .where(and(eq(userAddressesTable.id, id), eq(userAddressesTable.userId, uid(req))))
      .returning();
    return rows[0] ?? null;
  });
  if (!updated) {
    res.status(404).json({ error: "Dirección no encontrada" });
    return;
  }
  res.json(addressToClient(updated));
});

router.delete("/me/addresses/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  await db
    .delete(userAddressesTable)
    .where(and(eq(userAddressesTable.id, id), eq(userAddressesTable.userId, uid(req))));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Order history (orders placed while signed in)
// ---------------------------------------------------------------------------
router.get("/me/orders", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(outboundOrdersTable)
    .where(eq(outboundOrdersTable.userId, uid(req)))
    .orderBy(desc(outboundOrdersTable.createdAt));
  res.json(
    rows.map((o) => ({
      id: String(o.id),
      folio: o.folio,
      date: o.createdAt.toISOString(),
      total: o.total,
      entrega: o.entrega,
      pago: o.pago,
      status: o.status,
      paymentStatus: o.paymentStatus,
      lines: o.lines.map((l) => ({
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        price: l.price,
      })),
    })),
  );
});

export default router;
