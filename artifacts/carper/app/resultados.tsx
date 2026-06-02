import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Chip, EmptyState, Hairline, IconBox, Skeleton } from "@/components/CarperUI";
import { ProductRow } from "@/components/ProductRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useBrands, useCategories, useProducts } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Resultados() {
  const c = useColors();
  const params = useLocalSearchParams<{ q?: string; category?: string; compat?: string }>();
  const { sucursal } = useApp();
  const [brand, setBrand] = useState<string | null>(null);
  const [availOnly, setAvailOnly] = useState(false);
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);

  const { data: categories } = useCategories();
  const { data: allBrands } = useBrands();
  const {
    data,
    isLoading,
    isError,
    error,
  } = useProducts({
    q: params.q || undefined,
    categoryId: params.category || undefined,
    sucursalId: sucursal.id || undefined,
    limit: 200,
  });

  const category = params.category ? categories?.find((cat) => cat.id === params.category) : undefined;

  const base = useMemo(() => {
    let list = data?.items ?? [];
    if (params.compat === "1") list = list.filter((p) => p.compatible);
    return list;
  }, [data?.items, params.compat]);

  const filtered = useMemo(() => {
    let list = brand ? base.filter((p) => p.brand === brand) : base;
    if (availOnly) list = list.filter((p) => p.stock > 0);
    if (priceSort) list = [...list].sort((a, b) => (priceSort === "asc" ? a.price - b.price : b.price - a.price));
    return list;
  }, [base, brand, availOnly, priceSort]);

  const availableBrands = useMemo(() => (allBrands ?? []).filter((b) => base.some((p) => p.brand === b)), [allBrands, base]);

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
      {base.length > 0 ? (
        <View style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 14, gap: 10, alignItems: "center" }}
          >
            <IconBox size={34}>
              <Feather name="sliders" size={15} color={c.foreground} />
            </IconBox>
            <Chip label="En existencia" active={availOnly} onPress={() => setAvailOnly((v) => !v)} />
            <Chip label="Precio: menor" active={priceSort === "asc"} onPress={() => setPriceSort(priceSort === "asc" ? null : "asc")} />
            <Chip label="Precio: mayor" active={priceSort === "desc"} onPress={() => setPriceSort(priceSort === "desc" ? null : "desc")} />
            {availableBrands.map((b) => (
              <Chip key={b} label={b} active={brand === b} onPress={() => setBrand(brand === b ? null : b)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {isError ? (
        <EmptyState icon="alert-circle" title="Error al cargar" message={error instanceof Error ? error.message : "No se pudieron cargar las refacciones."} />
      ) : isLoading ? (
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
