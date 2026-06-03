import { Router, type IRouter, type Request, type Response } from "express";
import { and } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { notTestProduct, sellableProduct } from "../lib/catalogSearch";

const router: IRouter = Router();

// The catalog showcase site (artifacts/tienda) is served under this base path.
// Product/category URLs in the sitemap point at that SPA, not at the API.
const TIENDA_BASE = "/tienda";

// Sitemaps are capped at 50,000 URLs per file. The catalog is comfortably under
// that, but we cap defensively so a runaway catalog can't produce an invalid
// (oversized) sitemap.
const MAX_PRODUCT_URLS = 45000;

// Absolute origin (scheme + host) the sitemap URLs should use. Prefer an
// explicit PUBLIC_SITE_URL override; otherwise derive it from the incoming
// request (honoring the proxy's forwarded headers in production).
function siteOrigin(req: Request): string {
  const env = process.env.PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const fwdProto = (req.headers["x-forwarded-proto"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const fwdHost = (req.headers["x-forwarded-host"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const proto = fwdProto || req.protocol;
  const host = fwdHost || req.get("host") || "localhost";
  return `${proto}://${host}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

router.get("/sitemap.xml", async (req: Request, res: Response): Promise<void> => {
  const base = `${siteOrigin(req)}${TIENDA_BASE}`;

  const [products, categories] = await Promise.all([
    db
      .select({ id: productsTable.id, updatedAt: productsTable.updatedAt })
      .from(productsTable)
      .where(and(notTestProduct(), sellableProduct()))
      .orderBy(productsTable.name)
      .limit(MAX_PRODUCT_URLS),
    db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .orderBy(categoriesTable.name),
  ]);

  const urls: SitemapUrl[] = [
    { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/catalogo`, changefreq: "daily", priority: "0.9" },
    { loc: `${base}/contacto`, changefreq: "monthly", priority: "0.5" },
  ];

  for (const c of categories) {
    urls.push({
      loc: `${base}/catalogo?categoryId=${encodeURIComponent(c.id)}`,
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  for (const p of products) {
    urls.push({
      loc: `${base}/producto/${encodeURIComponent(p.id)}`,
      lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
      changefreq: "weekly",
      priority: "0.6",
    });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => {
        const lines = [`    <loc>${xmlEscape(u.loc)}</loc>`];
        if (u.lastmod) lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
        lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
        lines.push(`    <priority>${u.priority}</priority>`);
        return `  <url>\n${lines.join("\n")}\n  </url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;

  res.header("Content-Type", "application/xml; charset=utf-8");
  res.header("Cache-Control", "public, max-age=3600");
  res.send(body);
});

export default router;
