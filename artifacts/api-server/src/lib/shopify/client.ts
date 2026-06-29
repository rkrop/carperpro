// Shopify Storefront API client — server-side only.
// Fetches shop_domain + storefront_access_token from the Replit connector proxy.
// Never expose Admin tokens or shop_id to app code.

const STOREFRONT_API_VERSION = "2026-04";

type ShopifyConnectionResponse = {
  items?: Array<{ settings?: { shop_domain?: string; storefront_access_token?: string } }>;
};

type ShopifyStorefrontConfig = { shopDomain: string; storefrontAccessToken: string };

const CONFIG_CACHE_TTL_MS = 60_000;
let cachedConfig: { value: ShopifyStorefrontConfig; expiresAt: number } | undefined;

function getOpenIntConnectionConfig() {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const token = process.env["REPL_IDENTITY"]
    ? `repl ${process.env["REPL_IDENTITY"]}`
    : process.env["WEB_REPL_RENEWAL"]
      ? `depl ${process.env["WEB_REPL_RENEWAL"]}`
      : null;
  if (!hostname || !token) throw new Error("Missing Replit connector environment variables");
  const protocol = hostname.startsWith("localhost") ? "http" : "https";
  const url = new URL(`${protocol}://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "shopify-store");
  url.searchParams.set("refresh_policy", "none");
  return { connectionUrl: url.toString(), token };
}

export async function getShopifyStorefrontConfig(
  opts: { forceRefresh?: boolean } = {},
): Promise<ShopifyStorefrontConfig> {
  if (cachedConfig && !opts.forceRefresh && Date.now() < cachedConfig.expiresAt) {
    return cachedConfig.value;
  }
  const { connectionUrl, token } = getOpenIntConnectionConfig();
  const resp = await fetch(connectionUrl, {
    headers: { Accept: "application/json", "X-Replit-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Failed to fetch Shopify connection: ${resp.status}`);
  const data = (await resp.json()) as ShopifyConnectionResponse;
  const settings = data.items?.[0]?.settings;
  if (!settings?.shop_domain || !settings.storefront_access_token) {
    throw new Error("Shopify Store integration is missing Storefront settings.");
  }
  cachedConfig = {
    value: { shopDomain: settings.shop_domain, storefrontAccessToken: settings.storefront_access_token },
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  };
  return cachedConfig.value;
}

export async function shopifyStorefrontRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  opts: { retryOnUnauthorized?: boolean } = {},
): Promise<T> {
  const config = await getShopifyStorefrontConfig();
  const resp = await fetch(
    `https://${config.shopDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": config.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (opts.retryOnUnauthorized !== false && (resp.status === 401 || resp.status === 403)) {
    cachedConfig = undefined;
    await getShopifyStorefrontConfig({ forceRefresh: true });
    return shopifyStorefrontRequest<T>(query, variables, { retryOnUnauthorized: false });
  }
  const text = await resp.text();
  const json = text ? safeJsonParse(text) : {};
  if (!resp.ok || (json as { errors?: unknown[] }).errors?.length) {
    throw new Error(
      `Shopify Storefront API error (${resp.status}): ${JSON.stringify((json as { errors?: unknown }).errors ?? json)}`,
    );
  }
  return (json as { data: T }).data;
}

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return { errors: [{ message: text }] }; }
}
