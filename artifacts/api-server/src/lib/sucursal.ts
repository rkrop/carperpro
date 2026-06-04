import { eq } from "drizzle-orm";
import { db, sucursalesTable } from "@workspace/db";
import { getWebhookSucursalId } from "./admintotal/config";

/**
 * Resolve a usable sucursal id for an order/checkout.
 *
 * Carper is a single-store business: the app sends a blank `sucursalId`
 * (`STORE.id === ""`) on purpose, so the server must supply a real, seeded
 * branch. We try, in order: the caller's value, the configured webhook
 * sucursal, then ANY existing sucursal. This last fallback makes checkout
 * robust to a mismatch between the webhook default (e.g. "9") and whatever id
 * the catalog seed actually created (e.g. "matriz").
 *
 * Returns the resolved id, or `null` only when the sucursales table is empty.
 */
export async function resolveSucursalId(candidate?: string | null): Promise<string | null> {
  const tryIds = [candidate?.trim(), getWebhookSucursalId()].filter(
    (v): v is string => !!v,
  );
  for (const id of tryIds) {
    const row = await db
      .select({ id: sucursalesTable.id })
      .from(sucursalesTable)
      .where(eq(sucursalesTable.id, id))
      .limit(1);
    if (row.length > 0) return row[0]!.id;
  }
  const any = await db.select({ id: sucursalesTable.id }).from(sucursalesTable).limit(1);
  return any.length > 0 ? any[0]!.id : null;
}
