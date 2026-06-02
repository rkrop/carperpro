---
name: Ofertas screen architecture
description: How the Carper Ofertas tab mixes live deals with curated marketing campaigns
---

# Ofertas (deals) tab — two distinct sources

The Ofertas tab (`artifacts/carper/app/(tabs)/ofertas.tsx`) renders two unrelated things:

1. **Live "Oferta del día"** — comes from the `/deals` API (`useDeals`), a rotating
   discounted product with a countdown clock. It renders ONLY when discounted
   products exist (a product with `originalPrice > price`).
   **The Excel seed has 0 discounted products**, so this hero is hidden until the
   ERP sync (or manual data) introduces sale prices. This is expected, not a bug.

2. **Curated campaign cards** — static merchandising config in `lib/campaigns.ts`.
   Each card has a local AI-generated image (`assets/images/ofertas/*.png`), editorial
   copy, and a `query` that links into `/resultados?q=<query>` catalog search. These
   are NOT per-product discounts — they are themed collections.

**Why:** The store owner wanted 10 themed promo cards. One of the 10 ("Oferta del día")
maps to the live deals hero, the other 9 are curated cards — so 9 cards + 1 live hero = 10.
The `02-deldia.png` asset is reused as the deal-of-day hero's faint `ImageBackground` backdrop.

**How to apply:** To add/edit a campaign, edit `CAMPAIGNS` in `lib/campaigns.ts` (image
`require` paths must be static literals for RN/Metro). To make the live deal hero appear,
some product needs `originalPrice > price`.
