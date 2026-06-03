---
name: Carper react-query caching & list perf
description: Why global query staleTime is safe despite live-stock needs, and how the results list is virtualized
---

# Global react-query caching (carper)

The QueryClient sets global defaults: `staleTime` ~60s, `gcTime` ~10min, `retry` 2, `refetchOnWindowFocus` false. This makes revisiting screens show cached catalog instantly while it refreshes in the background.

**Why this is safe even though stock matters:** stock freshness is NOT guaranteed by the global staleTime. It is guaranteed at the two points that matter:
- cart availability (`useProductsAvailability`) overrides to `staleTime: 0, gcTime: 0` (always fresh).
- checkout/orders re-validate availability server-side before committing.

**How to apply:** do NOT "fix" perceived stale stock by lowering the global staleTime — that just refetches the whole catalog constantly. Keep freshness at the cart/checkout layer instead.

# Results list virtualization

`app/resultados.tsx` renders up to 200 products via `FlatList` (not ScrollView+.map). Uses `ItemSeparatorComponent={Hairline}`, memoized `renderItem`/`keyExtractor`, `removeClippedSubviews`, `initialNumToRender 8 / maxToRenderPerBatch 10 / windowSize 7`. `ProductRow` is wrapped in `React.memo` (props are `product` only). The horizontal filter chips are a separate sibling `ScrollView` ABOVE the FlatList — keep them un-nested to avoid VirtualizedList nesting warnings.
