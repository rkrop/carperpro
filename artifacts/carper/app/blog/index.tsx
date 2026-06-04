import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  BlogCategory,
  formatBlogDate,
} from "@/lib/blogContent";

export default function BlogIndex() {
  const c = useColors();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<BlogCategory | null>(null);

  const filtered =
    activeCategory == null
      ? BLOG_POSTS
      : BLOG_POSTS.filter((p) => p.category === activeCategory);

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title="Blog & Comunidad" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View
          style={{
            backgroundColor: c.background,
            paddingHorizontal: 24,
            paddingVertical: 28,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.black,
              fontSize: 28,
              letterSpacing: -1.5,
              textTransform: "uppercase",
              color: c.foreground,
              lineHeight: 26,
            }}
          >
            Noticias,{"\n"}tips y comunidad
          </Text>
          <Text
            style={{
              fontFamily: Fonts.medium,
              fontSize: 13,
              lineHeight: 20,
              color: c.mutedForeground,
              marginTop: 10,
            }}
          >
            Consejos del taller, datos curiosos del ramo, testimonios reales y
            lo más relevante de la industria automotriz.
          </Text>
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 14, gap: 8 }}
        >
          <Pressable
            onPress={() => setActiveCategory(null)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: activeCategory == null ? c.foreground : c.border,
              backgroundColor:
                activeCategory == null
                  ? c.foreground
                  : pressed
                  ? c.neutral50
                  : c.background,
            })}
          >
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: activeCategory == null ? c.background : c.foreground,
              }}
            >
              Todos
            </Text>
          </Pressable>

          {BLOG_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(isActive ? null : cat)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: isActive ? c.foreground : c.border,
                  backgroundColor: isActive
                    ? c.foreground
                    : pressed
                    ? c.neutral50
                    : c.background,
                })}
              >
                <Text
                  style={{
                    fontFamily: Fonts.bold,
                    fontSize: 9,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: isActive ? c.background : c.foreground,
                  }}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Article list */}
        {filtered.map((post, i) => (
          <Pressable
            key={post.id}
            onPress={() => router.push(`/blog/${post.id}` as never)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.neutral50 : c.background,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            })}
          >
            <View style={{ flexDirection: "row", gap: 0 }}>
              {/* Editorial photo column — absoluteFill so the image fills the
                  row's height (driven by the text column) instead of relying on
                  an ambiguous height:"100%" against a min-height-only parent. */}
              <View
                style={{
                  width: 110,
                  minHeight: 110,
                  alignSelf: "stretch",
                  backgroundColor: post.accentColor,
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                <Image source={post.image} resizeMode="cover" style={StyleSheet.absoluteFill} />
              </View>

              {/* Text content */}
              <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.bold,
                      fontSize: 8,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: c.primary,
                    }}
                  >
                    {post.tag}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.medium,
                      fontSize: 9,
                      color: c.mutedForeground,
                    }}
                  >
                    {post.category}
                  </Text>
                </View>

                <Text
                  style={{
                    fontFamily: Fonts.black,
                    fontSize: 14,
                    letterSpacing: -0.4,
                    textTransform: "uppercase",
                    lineHeight: 16,
                    color: c.foreground,
                    marginBottom: 6,
                  }}
                  numberOfLines={3}
                >
                  {post.title}
                </Text>

                <Text
                  style={{
                    fontFamily: Fonts.medium,
                    fontSize: 11,
                    lineHeight: 15,
                    color: c.mutedForeground,
                  }}
                  numberOfLines={2}
                >
                  {post.summary}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.medium,
                      fontSize: 10,
                      color: c.mutedForeground,
                    }}
                  >
                    {formatBlogDate(post.date)} · {post.readMin} min lectura
                  </Text>
                  <Feather name="chevron-right" size={14} color={c.mutedForeground} />
                </View>
              </View>
            </View>
          </Pressable>
        ))}

        {filtered.length === 0 && (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 13,
                color: c.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Sin artículos en esta categoría
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
