import { Feather } from "@expo/vector-icons";
import { useAuth, useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton } from "@/components/CarperUI";
import { AuthField, GoogleAuthButton, OrDivider, clerkErrorMessage } from "@/components/AuthUI";
import { Fonts, isWeb, WEB_TOP_INSET } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function SignUp() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 12;
  const fetching = fetchStatus === "fetching";

  const goHome = React.useCallback(() => {
    if (Platform.OS === "web") {
      window.location.href = "/";
    } else {
      router.replace("/(tabs)/cuenta");
    }
  }, [router]);

  React.useEffect(() => {
    if (isSignedIn) goHome();
  }, [isSignedIn, goHome]);

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          goHome();
        },
      });
    }
  };

  const Header = (
    <View style={{ paddingTop: topPad, paddingHorizontal: 24, paddingBottom: 8, flexDirection: "row", alignItems: "center" }}>
      <Pressable
        onPress={() => router.back()}
        style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
      >
        <Feather name="x" size={18} color={c.foreground} />
      </Pressable>
    </View>
  );

  const awaitingCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {Header}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: Fonts.black, fontSize: 30, letterSpacing: -1.2, textTransform: "uppercase", color: c.foreground, marginBottom: 8 }}>
            Verifica tu correo
          </Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 14, color: c.mutedForeground, marginBottom: 28 }}>
            Te enviamos un código a {emailAddress}.
          </Text>
          <AuthField label="Código" value={code} onChangeText={setCode} placeholder="000000" keyboardType="numeric" error={clerkErrorMessage(errors)} />
          <AccentButton label="Verificar y crear cuenta" loading={fetching} onPress={handleVerify} />
          <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.primary }}>Reenviar código</Text>
          </Pressable>
          <View nativeID="clerk-captcha" />
        </ScrollView>
      </View>
    );
  }

  const generalError = clerkErrorMessage(errors);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {Header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 8 }}>Carper Autopartes</Text>
        <Text style={{ fontFamily: Fonts.black, fontSize: 34, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground, marginBottom: 8 }}>
          Crear cuenta
        </Text>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 14, color: c.mutedForeground, marginBottom: 28 }}>
          Guarda tus favoritos, direcciones y pedidos para acceder desde cualquier dispositivo.
        </Text>

        <GoogleAuthButton />
        <OrDivider />

        <AuthField
          label="Correo"
          value={emailAddress}
          onChangeText={setEmailAddress}
          placeholder="tu@correo.com"
          keyboardType="email-address"
          error={errors.fields.emailAddress?.message}
        />
        <AuthField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
          error={errors.fields.password?.message}
        />
        {generalError ? (
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.destructive, marginBottom: 14 }}>{generalError}</Text>
        ) : null}

        <AccentButton
          label="Continuar"
          loading={fetching}
          disabled={!emailAddress || !password}
          onPress={handleSubmit}
        />

        {/* Required for sign-up — Clerk bot protection is enabled by default. */}
        <View nativeID="clerk-captcha" />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 6 }}>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.mutedForeground }}>¿Ya tienes cuenta?</Text>
          <Link href="/(auth)/sign-in" replace>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 13, color: c.primary }}>Iniciar sesión</Text>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
