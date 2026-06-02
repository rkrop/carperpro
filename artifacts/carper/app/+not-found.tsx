import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: "No encontrada" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          ESTA PÁGINA NO EXISTE.
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            IR AL INICIO
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontFamily: Fonts.black,
    fontSize: 20,
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
