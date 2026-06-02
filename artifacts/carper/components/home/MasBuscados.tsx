import React from "react";
import { ScrollView, View } from "react-native";

import { SectionLabel, Skeleton } from "@/components/CarperUI";
import { ProductCardMini } from "@/components/ProductRow";
import { useApp } from "@/context/AppContext";
import { useProducts } from "@/data/catalog";

/**
 * "Más buscados" — a row of real, priced catalog products from a high-rotation
 * query, so the home screen has product life even for a brand-new shopper.
 */
export function MasBuscados() {
  const { sucursal } = useApp();
  const { data, isLoading } = useProducts({ q: "marcha", sucursalId: sucursal.id || undefined, limit: 50 });
  // Real, priced catalog products. In-stock items first (stock is 0 until the ERP
  // inventory sync runs), so this naturally prioritizes available parts in prod.
  const items = (data?.items ?? [])
    .filter((p) => p.price > 0)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
    .slice(0, 8);

  if (!isLoading && items.length === 0) return null;

  return (
    <View style={{ paddingVertical: 32 }}>
      <SectionLabel style={{ marginBottom: 20, paddingHorizontal: 24 }}>Más Buscados</SectionLabel>
      {isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={150} height={210} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
          {items.map((p) => (
            <ProductCardMini key={p.id} product={p} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
