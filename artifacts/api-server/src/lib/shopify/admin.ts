// Shopify Admin GraphQL client — server-side only.
// Calls the Shopify Admin API through the Replit OpenInt connector proxy so no
// Admin API key is ever embedded in app code.  The connector supplies and rotates
// the shop credentials; this module just needs the proxy hostname and the Replit
// identity token.
//
// NOTE: Available scopes in the v1 Replit-managed Shopify connector:
//   write_products, write_inventory, read_locations, read_publications,
//   write_publications.
// `read_orders` is NOT provisioned in v1 — order-ingestion calls will receive
// PERMISSION_DENIED and are handled gracefully in order-ingestion.ts.

import { logger } from "../logger";

const ADMIN_API_PATH = "/admin/api/2026-04/graphql.json";
const MAX_COST_AVAILABLE = 2_000;

function getProxyConfig(): { proxyUrl: string; token: string } {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const token = process.env["REPL_IDENTITY"]
    ? `repl ${process.env["REPL_IDENTITY"]}`
    : process.env["WEB_REPL_RENEWAL"]
      ? `depl ${process.env["WEB_REPL_RENEWAL"]}`
      : null;
  if (!hostname || !token) {
    throw new Error(
      "Shopify Admin API: faltan variables de entorno del conector Replit (REPLIT_CONNECTORS_HOSTNAME / REPL_IDENTITY)",
    );
  }
  const protocol = hostname.startsWith("localhost") ? "http" : "https";
  return {
    proxyUrl: `${protocol}://${hostname}/api/v2/proxy${ADMIN_API_PATH}`,
    token,
  };
}

export type AdminGraphQLResponse<T> = {
  data: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: { currentlyAvailable: number; maximumAvailable: number; restoreRate: number } };
  };
};

/**
 * Execute a Shopify Admin GraphQL query/mutation.
 * Throws on HTTP or top-level GraphQL errors.
 * Returns { data, extensions } on success.
 */
export async function shopifyAdminRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<AdminGraphQLResponse<T>> {
  const { proxyUrl, token } = getProxyConfig();
  const resp = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Replit-Token": token,
      "Connector-Name": "shopify-store",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await resp.text();
  let json: AdminGraphQLResponse<T>;
  try {
    json = JSON.parse(text) as AdminGraphQLResponse<T>;
  } catch {
    throw new Error(
      `Shopify Admin API: respuesta no válida (HTTP ${resp.status}): ${text.slice(0, 300)}`,
    );
  }

  if (json.errors?.length) {
    const msgs = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Shopify Admin API GraphQL error: ${msgs}`);
  }
  if (!resp.ok) {
    throw new Error(
      `Shopify Admin API HTTP ${resp.status}: ${text.slice(0, 300)}`,
    );
  }
  return json;
}

/**
 * Throttle-aware wrapper: if Shopify's query cost budget is almost exhausted,
 * wait for it to replenish before returning.  Call this after each
 * shopifyAdminRequest that you expect to be mutation-heavy.
 */
export async function throttleIfNeeded(
  extensions: AdminGraphQLResponse<unknown>["extensions"],
): Promise<void> {
  const cost = extensions?.cost?.throttleStatus;
  if (!cost) return;
  if (cost.currentlyAvailable < MAX_COST_AVAILABLE / 4) {
    const waitMs = Math.ceil(
      ((MAX_COST_AVAILABLE / 2 - cost.currentlyAvailable) / cost.restoreRate) * 1_000,
    );
    logger.debug(
      { waitMs, currentlyAvailable: cost.currentlyAvailable },
      "Shopify Admin: esperando recuperación de cuota",
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
