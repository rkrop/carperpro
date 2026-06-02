/**
 * Lightweight, dependency-free SEO head management for the Carper Autopartes
 * catalog showcase (a client-rendered Vite SPA).
 *
 * `useSeo` imperatively keeps the document <title>, meta description, canonical
 * link, Open Graph / Twitter tags and JSON-LD structured data in sync with the
 * current route. Modern crawlers (Googlebot) render JS, so per-route head
 * updates are indexed; the static defaults in index.html remain as a fallback
 * for crawlers that don't execute JS.
 */
import { useEffect } from "react";
import { STORE } from "@/lib/store";

const SITE_NAME = "Carper Autopartes";
const DEFAULT_DESCRIPTION =
  "Catálogo en línea de Carper Autopartes en Ciudad Obregón. Miles de refacciones y autopartes: consulta precio y disponibilidad y pide por WhatsApp.";

/** Absolute origin of the current page (empty during SSR/build). */
function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Base path the SPA is mounted at (e.g. "/tienda/"). */
function basePath(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.replace(/\/$/, "");
}

/** Build an absolute URL for a route path relative to the SPA base. */
export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin()}${basePath()}${p}`;
}

const DEFAULT_IMAGE = () => absoluteUrl("/opengraph.jpg");

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const JSONLD_ATTR = "data-seo-jsonld";

function setJsonLd(blocks: object[]) {
  document.head
    .querySelectorAll(`script[${JSONLD_ATTR}]`)
    .forEach((node) => node.remove());
  for (const block of blocks) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(JSONLD_ATTR, "");
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  }
}

export interface SeoOptions {
  /** Full document title. */
  title: string;
  /** Meta description (~150-160 chars). */
  description?: string;
  /** Route path used for the canonical / og:url (relative to the SPA base). */
  path: string;
  /** Absolute image URL for OG/Twitter cards. Defaults to the site OG image. */
  image?: string;
  /** og:type — "website" for listings, "product" for product detail. */
  type?: string;
  /** When true, emits robots "noindex, follow" (e.g. for search-result views). */
  noindex?: boolean;
  /** One or more JSON-LD structured-data blocks. */
  jsonLd?: object | object[];
}

export function useSeo(opts: SeoOptions): void {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    path,
    image,
    type = "website",
    noindex = false,
    jsonLd,
  } = opts;

  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const canonical = absoluteUrl(path);
    const img = image || DEFAULT_IMAGE();

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta(
      "name",
      "robots",
      noindex ? "noindex, follow" : "index, follow",
    );
    upsertLink("canonical", canonical);

    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:image", img);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", img);

    const blocks = jsonLd
      ? Array.isArray(jsonLd)
        ? jsonLd
        : [jsonLd]
      : [];
    setJsonLd(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, type, noindex, jsonLdKey]);
}

/** Organization structured data for the storefront brand. */
export function organizationJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: absoluteUrl("/"),
    image: DEFAULT_IMAGE(),
    telephone: `+52${STORE.phone}`,
    email: STORE.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Blvd. Ignacio Ramírez 290",
      addressLocality: "Ciudad Obregón",
      addressRegion: "Sonora",
      postalCode: "85160",
      addressCountry: "MX",
    },
    sameAs: [STORE.instagramUrl],
  };
}

/** WebSite structured data with a catalog search action. */
export function websiteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/catalogo")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** BreadcrumbList structured data from an ordered list of name/url pairs. */
export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export interface ProductJsonLdInput {
  name: string;
  sku: string;
  brand: string;
  price: number;
  image?: string | null;
  description?: string | null;
  inStock: boolean;
  oem?: string[] | null;
  path: string;
}

/** Product + Offer structured data for a product detail page. */
export function productJsonLd(p: ProductJsonLdInput): object {
  const url = absoluteUrl(p.path);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    description:
      p.description?.trim() ||
      `${p.name} disponible en ${SITE_NAME}, Ciudad Obregón.`,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "MXN",
      price: p.price.toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      availability: p.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
  if (p.brand && p.brand !== "SIN MARCA") {
    jsonLd.brand = { "@type": "Brand", name: p.brand };
  }
  if (p.image) jsonLd.image = [p.image];
  if (p.oem && p.oem.length > 0) jsonLd.mpn = p.oem[0];
  return jsonLd;
}
