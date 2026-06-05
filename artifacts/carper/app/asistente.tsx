import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCardMini } from "@/components/ProductRow";
import { Fonts, isWeb, WEB_TOP_INSET } from "@/constants/fonts";
import {
  useAssistantChat,
  type AssistantChatMessage,
  type Product,
} from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Real catalog products attached to an assistant turn (rendered as cards). */
  products?: Product[];
}

const GREETING =
  "Bienvenido al asistente de Carper. Indíqueme qué vehículo tiene (marca, modelo y año) y qué refacción necesita o qué falla presenta, y le recomendaré la pieza correcta. También puede compartir el VIN para identificar su vehículo.";

// One-tap conversation starters for the empty state.
const STARTERS = [
  "Mi Tsuru 2010 rechina al frenar",
  "Necesito balatas para un Jetta A4 2003",
  "Mi Sentra no arranca",
  "Filtro de aceite para Versa 2015",
];

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `m${nextId}`;
}

// Native gets real keyboard avoidance (works on Android + iOS, unlike RN's
// KeyboardAvoidingView which no-ops on Android). Web has no soft keyboard and
// the codebase intentionally avoids keyboard-controller there, so use a plain View.
function ChatKeyboardWrapper({ children }: { children: React.ReactNode }) {
  if (isWeb) return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      {children}
    </KeyboardAvoidingView>
  );
}

export default function Asistente() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { send, isPending } = useAssistantChat();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: makeId(), role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 12;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isPending) return;
      setInput("");

      const userMsg: ChatMessage = { id: makeId(), role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages(history);
      scrollToEnd();

      // Server is stateless: send the whole conversation (content only) so the
      // assistant can use the car/symptom mentioned in earlier turns.
      const payload: AssistantChatMessage[] = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const { reply, products } = await send(payload);
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: reply,
            products: products.length > 0 ? products : undefined,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content:
              "Tuvimos un problema al procesar su mensaje. Por favor, inténtelo de nuevo en un momento.",
          },
        ]);
      }
      scrollToEnd();
    },
    [messages, isPending, send, scrollToEnd],
  );

  const showStarters = messages.length <= 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingTop: topPad,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="arrow-left" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: Fonts.black,
              fontSize: 16,
              letterSpacing: -0.4,
              textTransform: "uppercase",
              color: c.foreground,
            }}
          >
            Asistente
          </Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 10, color: c.mutedForeground, marginTop: 1 }}>
            Encuentra la pieza correcta
          </Text>
        </View>
        <View style={{ width: 36, height: 36, borderWidth: 1, borderColor: c.primary, alignItems: "center", justifyContent: "center" }}>
          <Feather name="message-circle" size={16} color={c.primary} />
        </View>
      </View>

      <ChatKeyboardWrapper>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, gap: 16 }}
          onContentSizeChange={scrollToEnd}
        >
          {messages.map((m) =>
            m.role === "user" ? (
              <View key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                <View style={{ backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20, color: c.primaryForeground }}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={m.id} style={{ alignSelf: "flex-start", maxWidth: "92%", gap: 12 }}>
                <View style={{ borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.neutral50 }}>
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20, color: c.foreground }}>
                    {m.content}
                  </Text>
                </View>
                {m.products && m.products.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingRight: 8 }}
                  >
                    {m.products.map((p) => (
                      <ProductCardMini key={p.id} product={p} />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ),
          )}

          {isPending ? (
            <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={c.foreground} />
              <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.mutedForeground }}>
                Buscando…
              </Text>
            </View>
          ) : null}

          {showStarters ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>
                Sugerencias
              </Text>
              {STARTERS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => sendMessage(s)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderWidth: 1,
                    borderColor: c.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: pressed ? c.neutral50 : c.background,
                  })}
                >
                  <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: c.foreground }}>
                    {s}
                  </Text>
                  <Feather name="arrow-up-right" size={16} color={c.neutral400} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* Input bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: (isWeb ? 12 : insets.bottom) + 12,
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.background,
          }}
        >
          <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
              placeholder="Escriba su vehículo y la pieza…"
              placeholderTextColor={c.neutral400}
              returnKeyType="send"
              multiline
              style={{
                paddingVertical: 12,
                fontFamily: Fonts.medium,
                fontSize: 14,
                color: c.foreground,
                maxHeight: 100,
              }}
            />
          </View>
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isPending}
            style={{
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: !input.trim() || isPending ? c.neutral300 : c.primary,
            }}
          >
            <Feather name="arrow-up" size={20} color={c.primaryForeground} />
          </Pressable>
        </View>
      </ChatKeyboardWrapper>

    </View>
  );
}
