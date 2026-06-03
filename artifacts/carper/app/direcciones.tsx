import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import {
  getListAddressesQueryKey,
  useCreateAddress,
  useDeleteAddress,
  useListAddresses,
  useUpdateAddress,
  type Address,
  type ShippingAddress,
} from "@workspace/api-client-react";

import { AccentButton, OutlineButton } from "@/components/CarperUI";
import { AuthField } from "@/components/AuthUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

function formatAddress(a: ShippingAddress): string {
  return [
    `${a.calle} ${a.numExterior}${a.numInterior ? ` int ${a.numInterior}` : ""}`.trim(),
    a.colonia ? `Col. ${a.colonia}` : "",
    a.cp ? `CP ${a.cp}` : "",
    a.municipio ?? "",
    a.estado ?? "",
  ]
    .filter(Boolean)
    .join(", ");
}

const EMPTY_FORM = {
  label: "",
  calle: "",
  numExterior: "",
  numInterior: "",
  colonia: "",
  cp: "",
  municipio: "",
  estado: "",
  referencias: "",
};

export default function Direcciones() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();

  const list = useListAddresses({ query: { queryKey: getListAddressesQueryKey(), enabled: isSignedIn } });
  const addresses = list.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAddressesQueryKey() });

  const createMut = useCreateAddress({ mutation: { onSuccess: invalidate } });
  const updateMut = useUpdateAddress({ mutation: { onSuccess: invalidate } });
  const deleteMut = useDeleteAddress({ mutation: { onSuccess: invalidate } });

  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const setField = (key: keyof typeof EMPTY_FORM) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  const canSave = form.calle.trim() && form.numExterior.trim() && form.colonia.trim() && form.cp.trim();

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    const address: ShippingAddress = {
      calle: form.calle.trim(),
      numExterior: form.numExterior.trim(),
      numInterior: form.numInterior.trim() || null,
      colonia: form.colonia.trim(),
      cp: form.cp.trim(),
      municipio: form.municipio.trim() || null,
      estado: form.estado.trim() || null,
      referencias: form.referencias.trim() || null,
    };
    try {
      await createMut.mutateAsync({
        data: { label: form.label.trim() || null, address, isDefault: addresses.length === 0 },
      });
      resetForm();
    } catch {
      Alert.alert("Error", "No se pudo guardar la dirección. Inténtalo de nuevo.");
    }
  };

  const makeDefault = (a: Address) => {
    if (a.isDefault) return;
    updateMut.mutate({ id: a.id, data: { label: a.label ?? null, address: a.address, isDefault: true } });
  };

  const confirmDelete = (a: Address) => {
    Alert.alert("Eliminar dirección", "¿Quieres eliminar esta dirección guardada?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => deleteMut.mutate({ id: a.id }) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title="Mis Direcciones" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }} keyboardShouldPersistTaps="handled">
        {list.isLoading ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : null}

        {!list.isLoading && addresses.length === 0 && !showForm ? (
          <View style={{ padding: 24, paddingTop: 40, alignItems: "center", gap: 16 }}>
            <View style={{ width: 56, height: 56, borderWidth: 1, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" }}>
              <Feather name="map-pin" size={24} color={c.foreground} />
            </View>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 14, color: c.mutedForeground, textAlign: "center" }}>
              Aún no tienes direcciones guardadas. Agrega una para acelerar tus pedidos a domicilio.
            </Text>
          </View>
        ) : null}

        {/* Address cards */}
        <View style={{ gap: 12, padding: addresses.length > 0 ? 16 : 0 }}>
          {addresses.map((a) => (
            <View key={a.id} style={{ backgroundColor: c.background, borderWidth: 1, borderColor: c.border, padding: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.foreground }}>
                  {a.label || "Dirección"}
                </Text>
                {a.isDefault ? (
                  <View style={{ backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: c.primaryForeground }}>Predeterminada</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.mutedForeground, lineHeight: 19 }}>{formatAddress(a.address)}</Text>
              {a.address.referencias ? (
                <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: c.neutral400, marginTop: 4 }}>Ref: {a.address.referencias}</Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }}>
                {!a.isDefault ? (
                  <Pressable onPress={() => makeDefault(a)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="check-circle" size={14} color={c.primary} />
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.primary }}>Hacer predeterminada</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => confirmDelete(a)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="trash-2" size={14} color={c.destructive} />
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.destructive }}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Add form */}
        {showForm ? (
          <View style={{ backgroundColor: c.background, borderTopWidth: 1, borderColor: c.border, padding: 24, marginTop: 16 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: c.foreground, marginBottom: 18 }}>Nueva dirección</Text>
            <AuthField label="Etiqueta (opcional)" value={form.label} onChangeText={setField("label")} placeholder="Casa, Taller…" autoCapitalize="sentences" />
            <AuthField label="Calle" value={form.calle} onChangeText={setField("calle")} placeholder="Av. Reforma" autoCapitalize="words" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AuthField label="Núm. ext." value={form.numExterior} onChangeText={setField("numExterior")} placeholder="123" />
              </View>
              <View style={{ flex: 1 }}>
                <AuthField label="Núm. int." value={form.numInterior} onChangeText={setField("numInterior")} placeholder="B" />
              </View>
            </View>
            <AuthField label="Colonia" value={form.colonia} onChangeText={setField("colonia")} placeholder="Centro" autoCapitalize="words" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AuthField label="C.P." value={form.cp} onChangeText={setField("cp")} placeholder="06000" keyboardType="numeric" />
              </View>
              <View style={{ flex: 2 }}>
                <AuthField label="Municipio" value={form.municipio} onChangeText={setField("municipio")} placeholder="Cuauhtémoc" autoCapitalize="words" />
              </View>
            </View>
            <AuthField label="Estado" value={form.estado} onChangeText={setField("estado")} placeholder="CDMX" autoCapitalize="words" />
            <AuthField label="Referencias (opcional)" value={form.referencias} onChangeText={setField("referencias")} placeholder="Entre calles, color de fachada…" autoCapitalize="sentences" />

            <AccentButton label="Guardar dirección" loading={createMut.isPending} disabled={!canSave} onPress={handleSave} />
            <View style={{ marginTop: 12 }}>
              <OutlineButton label="Cancelar" onPress={resetForm} />
            </View>
          </View>
        ) : (
          <View style={{ padding: 24 }}>
            <AccentButton label="Agregar dirección" icon="plus" onPress={() => setShowForm(true)} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
