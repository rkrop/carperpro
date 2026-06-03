import { Feather } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";

import { AccentButton } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { startPhoneVerification, usePhoneSession, verifyPhoneCode } from "@/lib/auth";

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

const RESEND_COOLDOWN_S = 30;

/**
 * Self-contained phone + SMS OTP login. Collapsed by default to a single
 * "Continuar con teléfono" button; expands into a phone-entry step, then a
 * code-entry step. On success it stores the opaque session token and navigates
 * to the account tab. Coexists with the Clerk email/Google flows above it.
 */
export function PhoneAuthSection() {
  const c = useColors();
  const router = useRouter();
  const { setPhoneSession } = usePhoneSession();

  const [step, setStep] = React.useState<"idle" | "phone" | "code">("idle");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const goHome = useCallback(() => {
    if (Platform.OS === "web") {
      window.location.href = "/";
    } else {
      router.replace("/(tabs)/cuenta");
    }
  }, [router]);

  const sendCode = useCallback(async () => {
    if (loading) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Ingresa un número de 10 dígitos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await startPhoneVerification(phone);
      setStep("code");
      setCode("");
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setLoading(false);
    }
  }, [loading, phone]);

  const confirmCode = useCallback(async () => {
    if (loading) return;
    if (code.replace(/\D/g, "").length < 4) {
      setError("Ingresa el código que recibiste.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { token, userId } = await verifyPhoneCode(phone, code);
      await setPhoneSession(token, userId);
      goHome();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorrecto.");
    } finally {
      setLoading(false);
    }
  }, [loading, code, phone, setPhoneSession, goHome]);

  if (step === "idle") {
    return (
      <Pressable
        onPress={() => {
          setError(null);
          setStep("phone");
        }}
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
        <Feather name="smartphone" size={16} color={c.foreground} />
        <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: c.foreground }}>
          Continuar con teléfono
        </Text>
      </Pressable>
    );
  }

  if (step === "phone") {
    return (
      <View>
        <AuthField
          label="Teléfono"
          value={phone}
          onChangeText={(t) => setPhone(t)}
          placeholder="55 1234 5678"
          keyboardType="numeric"
          error={error}
        />
        <AccentButton label="Enviar código" loading={loading} disabled={!phone} onPress={sendCode} />
        <Pressable onPress={() => setStep("idle")} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground }}>
            Cancelar
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.mutedForeground, marginBottom: 16 }}>
        Te enviamos un código por SMS al {phone}.
      </Text>
      <AuthField
        label="Código"
        value={code}
        onChangeText={(t) => setCode(t)}
        placeholder="000000"
        keyboardType="numeric"
        error={error}
      />
      <AccentButton label="Verificar y entrar" loading={loading} disabled={!code} onPress={confirmCode} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 16 }}>
        <Pressable onPress={() => { setStep("phone"); setError(null); }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground }}>
            Cambiar número
          </Text>
        </Pressable>
        <Pressable disabled={cooldown > 0 || loading} onPress={sendCode}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: cooldown > 0 ? c.neutral400 : c.primary }}>
            {cooldown > 0 ? `Reenviar (${cooldown})` : "Reenviar código"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
