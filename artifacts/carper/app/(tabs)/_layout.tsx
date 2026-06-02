import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.neutral400,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopWidth: 1,
          borderTopColor: c.border,
          height: Platform.OS === "web" ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "web" ? 24 : 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bold,
          fontSize: 9,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginTop: 2,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Inicio", tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="categorias"
        options={{ title: "Categorías", tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="buscar"
        options={{ title: "Buscar", tabBarIcon: ({ color }) => <Feather name="search" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="ofertas"
        options={{ title: "Ofertas", tabBarIcon: ({ color }) => <Feather name="tag" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{ title: "Cuenta", tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} /> }}
      />
    </Tabs>
  );
}
