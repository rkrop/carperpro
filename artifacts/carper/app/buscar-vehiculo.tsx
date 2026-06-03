import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { AccentButton } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { VEHICLE_DATA } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const ANIOS = Array.from({ length: 2025 - 1990 + 1 }, (_, i) => String(2025 - i));
const STEPS = ["Marca", "Modelo", "Año", "Motor"] as const;

export default function BuscarVehiculo() {
  const c = useColors();
  const router = useRouter();
  const { setVehicle } = useApp();
  const [step, setStep] = useState(0);
  const [marca, setMarca] = useState<string | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [anio, setAnio] = useState<string | null>(null);
  const [motor, setMotor] = useState<string | null>(null);

  const tap = () => Platform.OS !== "web" && Haptics.selectionAsync();

  const options: string[] =
    step === 0 ? VEHICLE_DATA.marcas : step === 1 ? VEHICLE_DATA.modelos[marca ?? ""] ?? [] : step === 2 ? ANIOS : VEHICLE_DATA.motores;

  const selected = [marca, modelo, anio, motor][step];

  const select = (val: string) => {
    tap();
    if (step === 0) {
      setMarca(val);
      setModelo(null);
    } else if (step === 1) setModelo(val);
    else if (step === 2) setAnio(val);
    else setMotor(val);
    if (step < 3) setStep(step + 1);
  };

  const finish = () => {
    if (marca && modelo && anio && motor) {
      setVehicle({ marca, modelo, anio, motor });
      // Search the catalog by marca + modelo via full-text search. Año/motor are
      // saved on the vehicle for context but kept out of the query: descriptions
      // store year RANGES (e.g. "1992-2017"), so forcing a literal year would
      // wrongly exclude matching parts.
      router.replace(`/resultados?q=${encodeURIComponent(`${marca} ${modelo}`)}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Buscar por Vehículo" onBack={() => (step > 0 ? setStep(step - 1) : router.back())} />

      {/* Progress */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border }}>
        {STEPS.map((label, i) => {
          const done = [marca, modelo, anio, motor][i];
          const active = i === step;
          return (
            <Pressable
              key={label}
              onPress={() => (done || i < step) && setStep(i)}
              style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderRightWidth: i < 3 ? 1 : 0, borderRightColor: c.border, backgroundColor: active ? c.foreground : c.background }}
            >
              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: active ? c.background : done ? c.primary : c.neutral400, marginBottom: 4 }}>0{i + 1}</Text>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: active ? c.background : c.foreground }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 24, paddingVertical: 24 }}>
        <Text style={{ fontFamily: Fonts.black, fontSize: 24, letterSpacing: -1, textTransform: "uppercase", color: c.foreground }}>
          Selecciona {STEPS[step]}
        </Text>
        {(marca || modelo || anio) && step > 0 ? (
          <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.mutedForeground, marginTop: 6 }}>
            {[marca, modelo, anio].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
          {options.map((opt) => {
            const isSel = selected === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => select(opt)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
              >
                <Text style={{ fontFamily: Fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: "uppercase", color: isSel ? c.primary : c.foreground }}>{opt}</Text>
                {isSel ? <Feather name="check" size={18} color={c.primary} /> : <Feather name="chevron-right" size={16} color={c.neutral400} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {marca && modelo && anio && motor ? (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <AccentButton label="Ver Refacciones Compatibles" icon="arrow-right" onPress={finish} />
        </View>
      ) : null}
    </View>
  );
}
