import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, Share, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { BLOG_POSTS, formatBlogDate } from "@/lib/blogContent";
import { STORE } from "@/lib/store";

/** Renders article body — blank lines separate paragraphs; **bold** text is highlighted. */
function ArticleBody({ text }: { text: string }) {
  const c = useColors();

  const paragraphs = text.split("\n\n").filter(Boolean);

  return (
    <>
      {paragraphs.map((para, i) => {
        const isHeading = para.startsWith("**") && para.endsWith("**") && !para.slice(2, -2).includes("**");
        if (isHeading) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: Fonts.black,
                fontSize: 14,
                letterSpacing: -0.2,
                textTransform: "uppercase",
                color: c.foreground,
                marginTop: 20,
                marginBottom: 6,
              }}
            >
              {para.slice(2, -2)}
            </Text>
          );
        }

        // Split inline **bold** segments
        const parts = para.split(/(\*\*[^*]+\*\*)/g);
        return (
          <Text
            key={i}
            style={{
              fontFamily: Fonts.medium,
              fontSize: 14,
              lineHeight: 22,
              color: c.foreground,
              marginBottom: 6,
            }}
          >
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <Text key={j} style={{ fontFamily: Fonts.bold }}>
                    {part.slice(2, -2)}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        );
      })}
    </>
  );
}

export default function BlogPost() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = BLOG_POSTS.find((p) => p.id === id);

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
        <ScreenHeader title="Artículo" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text
            style={{
              fontFamily: Fonts.black,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: -0.5,
              color: c.mutedForeground,
            }}
          >
            Artículo no encontrado
          </Text>
        </View>
      </View>
    );
  }

  const relatedPosts = BLOG_POSTS.filter(
    (p) => p.id !== post.id && (p.category === post.category || p.featured)
  ).slice(0, 3);

  async function handleShare() {
    try {
      await Share.share({
        title: post!.title,
        message: `${post!.title}\n\n${post!.summary}\n\nVía Carper Autopartes`,
      });
    } catch {
      // Ignore
    }
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(
      `Mira este artículo de Carper: "${post!.title}" — ${post!.summary}`
    );
    Linking.openURL(`https://wa.me/${STORE.whatsapp}?text=${text}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title={post.category} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero block */}
        <View
          style={{
            height: 160,
            backgroundColor: post.accentColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={post.icon as never}
            size={60}
            color="rgba(255,255,255,0.75)"
          />
        </View>

        {/* Meta row */}
        <View
          style={{
            backgroundColor: c.background,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: c.foreground,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.bold,
                  fontSize: 8,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: c.background,
                }}
              >
                {post.tag}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: Fonts.medium,
                fontSize: 10,
                color: c.mutedForeground,
              }}
            >
              {post.category}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: Fonts.black,
              fontSize: 24,
              letterSpacing: -1,
              textTransform: "uppercase",
              lineHeight: 24,
              color: c.foreground,
              marginBottom: 12,
            }}
          >
            {post.title}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Feather name="calendar" size={11} color={c.mutedForeground} />
              <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground }}>
                {formatBlogDate(post.date)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Feather name="clock" size={11} color={c.mutedForeground} />
              <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground }}>
                {post.readMin} min lectura
              </Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View
          style={{
            backgroundColor: c.background,
            paddingHorizontal: 24,
            paddingVertical: 20,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.bold,
              fontSize: 15,
              lineHeight: 22,
              color: c.foreground,
              fontStyle: "italic",
            }}
          >
            {post.summary}
          </Text>
        </View>

        {/* Body */}
        <View
          style={{
            backgroundColor: c.background,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 32,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <ArticleBody text={post.body} />
        </View>

        {/* Actions */}
        <View
          style={{
            backgroundColor: c.background,
            paddingHorizontal: 24,
            paddingVertical: 20,
            flexDirection: "row",
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: pressed ? c.neutral50 : c.background,
            })}
          >
            <Feather name="share-2" size={15} color={c.foreground} />
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: c.foreground,
              }}
            >
              Compartir
            </Text>
          </Pressable>

          <Pressable
            onPress={handleWhatsApp}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: "#25D366",
              backgroundColor: pressed ? "#1DA851" : "#25D366",
            })}
          >
            <MaterialCommunityIcons name="whatsapp" size={16} color="#fff" />
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              WhatsApp
            </Text>
          </Pressable>
        </View>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <View style={{ paddingTop: 28, paddingBottom: 40 }}>
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: c.mutedForeground,
                paddingHorizontal: 24,
                marginBottom: 16,
              }}
            >
              Más artículos
            </Text>

            {relatedPosts.map((rp) => (
              <Pressable
                key={rp.id}
                onPress={() => router.replace(`/blog/${rp.id}` as never)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                  backgroundColor: pressed ? c.neutral50 : "transparent",
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: rp.accentColor,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MaterialCommunityIcons
                    name={rp.icon as never}
                    size={20}
                    color="rgba(255,255,255,0.8)"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.bold,
                      fontSize: 8,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: c.primary,
                      marginBottom: 3,
                    }}
                  >
                    {rp.tag}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.black,
                      fontSize: 13,
                      letterSpacing: -0.3,
                      textTransform: "uppercase",
                      lineHeight: 14,
                      color: c.foreground,
                    }}
                    numberOfLines={2}
                  >
                    {rp.title}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={c.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
