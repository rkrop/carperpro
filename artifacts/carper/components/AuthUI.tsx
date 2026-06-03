import { Feather } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";

import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

// Completes any pending OAuth session when the browser redirects back.
WebBrowser.maybeCompleteAuthSession();

/** Preloads the browser on Android to cut OAuth latency. */
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

/** Labeled text input matching the editorial form style. */
export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string | null;
}) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral500, marginBottom: 8 }}>
        {label}
      </Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: error ? c.destructive : c.borderStrong,
          paddingHorizontal: 16,
          height: 52,
          fontFamily: Fonts.medium,
          fontSize: 15,
          color: c.foreground,
          backgroundColor: c.background,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.neutral400}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
      {error ? (
        <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: c.destructive, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  );
}

/**
 * "Continuar con Google" button. Runs the Clerk SSO flow (signs up OR signs in),
 * sets the new session active, then dismisses back to the account tab.
 */
export function GoogleAuthButton() {
  useWarmUpBrowser();
  const c = useColors();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = React.useState(false);

  const onPress = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            if (Platform.OS === "web") {
              const url = decorateUrl("/(tabs)/cuenta");
              window.location.href = url;
            } else {
              router.replace("/(tabs)/cuenta");
            }
          },
        });
      }
    } catch (err) {
      console.error("Google SSO error:", JSON.stringify(err, null, 2));
    } finally {
      setLoading(false);
    }
  }, [loading, router, startSSOFlow]);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        height: 52,
        borderWidth: 1,
        borderColor: c.borderStrong,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: pressed ? c.neutral100 : c.background,
      })}
    >
      {loading ? (
        <ActivityIndicator color={c.foreground} />
      ) : (
        <>
          <Feather name="chrome" size={16} color={c.foreground} />
          <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: c.foreground }}>
            Continuar con Google
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Extracts a human-readable message from a Clerk future `errors` object. The
 * generated `errors.raw` element type is opaque (`{}`), so narrow it here.
 */
export function clerkErrorMessage(errors: { raw?: ReadonlyArray<unknown> | null }): string | undefined {
  const first = errors.raw?.[0] as { message?: string } | undefined;
  return first?.message;
}

/** Hairline divider with centered "o" label. */
export function OrDivider() {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>o</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
    </View>
  );
}
