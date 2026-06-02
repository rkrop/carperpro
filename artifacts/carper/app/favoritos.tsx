import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { EmptyState, Hairline } from "@/components/CarperUI";
import { ProductRow } from "@/components/ProductRow";
import { ScreenHeader } from "@/components/ScreenHeader";

import { getProduct } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Favoritos() {
  const c = useColors();
  const router = useRouter();
  const { favorites } = useApp();
  const items = favorites.map(getProduct).filter(Boolean) as NonNullable<ReturnType<typeof getProduct>>[];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title={`Favoritos · ${items.length}`} />
      {items.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Sin favoritos"
          message="Guarda refacciones con el ícono de corazón para encontrarlas rápido."
          actionLabel="Explorar Catálogo"
          onAction={() => router.replace("/(tabs)/categorias")}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {items.map((item, i) => (
            <View key={item.id}>
              <ProductRow product={item} />
              {i < items.length - 1 ? <Hairline /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
