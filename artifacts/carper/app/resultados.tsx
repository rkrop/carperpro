import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Chip, EmptyState, Hairline, IconBox, Skeleton } from "@/components/CarperUI";
import { ProductRow } from "@/components/ProductRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb } from "@/constants/fonts";
import { BRANDS, PRODUCTS, Product, getCategory } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

function matches(p: Product, q: string) {
  const term = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(term) ||
    p.sku.toLowerCase().includes(term) ||
    p.brand.toLowerCase().includes(term) ||
    (getCategory(p.categoryId)?.name.toLowerCase().includes(term) ?? false)
  );
}

export default function Resultados() {
  const c = useColors();
  const params = useLocalSearchParams<{ q?: string; category?: string; compat?: string }>();
  const [loading, setLoading] = useState(!isWeb);
  const [brand, setBrand] = useState<string | null>(null);

  useEffect(() => {
    if (isWeb) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(t);
  }, [params.q, params.category, params.compat]);

  const category = params.category ? getCategory(params.category) : undefined;

  const base = useMemo(() => {
    let list = PRODUCTS;
    if (params.category) list = list.filter((p) => p.categoryId === params.category);
    if (params.q) list = list.filter((p) => matches(p, params.q!));
    if (params.compat === "1") list = list.filter((p) => p.compatible);
    return list;
  }, [params.q, params.category, params.compat]);

  const filtered = brand ? base.filter((p) => p.brand === brand) : base;
  const availableBrands = useMemo(() => BRANDS.filter((b) => base.some((p) => p.brand === b)), [base]);

  const title = category ? category.name : params.compat === "1" ? "Compatibles" : "Resultados";
  const subtitle = params.q
    ? `Resultados para "${params.q}"`
    : category
      ? `${category.count.toLocaleString("en-US")} refacciones en catálogo`
      : "Refacciones compatibles con tu vehículo";

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title={title} />

      <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground }}>{subtitle}</Text>
      </View>

      {/* Filters */}
      {availableBrands.length > 1 ? (
        <View style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 14, gap: 10, alignItems: "center" }}
          >
            <IconBox size={34}>
              <Feather name="sliders" size={15} color={c.foreground} />
            </IconBox>
            {availableBrands.map((b) => (
              <Chip key={b} label={b} active={brand === b} onPress={() => setBrand(brand === b ? null : b)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {loading ? (
        <View>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 16, padding: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Skeleton width={96} height={96} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="40%" height={10} />
                <Skeleton width="90%" height={14} />
                <Skeleton width="70%" height={14} />
                <Skeleton width="50%" height={18} style={{ marginTop: 12 }} />
              </View>
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sin resultados"
          message={`No encontramos refacciones${params.q ? ` para "${params.q}"` : ""}. Verifica el SKU o intenta con otra marca.`}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {filtered.map((item, i) => (
            <View key={item.id}>
              <ProductRow product={item} />
              {i < filtered.length - 1 ? <Hairline /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
