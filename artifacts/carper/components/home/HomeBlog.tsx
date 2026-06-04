import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { FEATURED_POSTS, formatBlogDate } from "@/lib/blogContent";

/** Home-screen spotlight for the Blog & Comunidad section. */
export function HomeBlog() {
  const c = useColors();
  const router = useRouter();

  if (FEATURED_POSTS.length === 0) return null;

  return (
    <View
      style={{
        paddingTop: 32,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.background,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          marginBottom: 6,
        }}
      >
        <SectionLabel>Blog & Comunidad</SectionLabel>
        <Pressable
          onPress={() => router.push("/blog" as never)}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: c.primary,
            }}
          >
            Ver todo
          </Text>
          <Feather name="arrow-right" size={13} color={c.primary} />
        </Pressable>
      </View>

      <Text
        style={{
          fontFamily: Fonts.black,
          fontSize: 22,
          letterSpacing: -1,
          textTransform: "uppercase",
          color: c.foreground,
          paddingHorizontal: 24,
          marginBottom: 20,
        }}
      >
        Noticias y consejos
      </Text>

      {/* Horizontal scroll of featured cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
      >
        {FEATURED_POSTS.map((post) => (
          <Pressable
            key={post.id}
            onPress={() => router.push(`/blog/${post.id}` as never)}
            style={({ pressed }) => ({
              width: 240,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: pressed ? c.neutral50 : c.background,
              overflow: "hidden",
            })}
          >
            {/* Editorial photo header */}
            <View style={{ height: 110, backgroundColor: post.accentColor }}>
              <Image
                source={post.image}
                resizeMode="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </View>

            {/* Content */}
            <View style={{ padding: 14, gap: 6 }}>
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
                  fontFamily: Fonts.black,
                  fontSize: 13,
                  letterSpacing: -0.3,
                  textTransform: "uppercase",
                  lineHeight: 15,
                  color: c.foreground,
                }}
                numberOfLines={3}
              >
                {post.title}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.medium,
                    fontSize: 10,
                    color: c.mutedForeground,
                  }}
                >
                  {formatBlogDate(post.date)} · {post.readMin} min
                </Text>
                <Feather name="arrow-right" size={12} color={c.primary} />
              </View>
            </View>
          </Pressable>
        ))}

        {/* "Ver todo" trailing card */}
        <Pressable
          onPress={() => router.push("/blog" as never)}
          style={({ pressed }) => ({
            width: 100,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: pressed ? c.neutral50 : c.background,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="book-open" size={18} color={c.primaryForeground} />
          </View>
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 9,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: c.foreground,
              textAlign: "center",
            }}
          >
            Ver{"\n"}todo
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
