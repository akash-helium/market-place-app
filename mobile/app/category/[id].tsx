import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import type { Category, Subcategory } from "../../src/api/types";
import { Empty } from "../../src/components/ui";
import { categoryTints, colors, font } from "../../src/theme";
import { mediaUrl } from "../../src/utils/media";

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState(Number(id));
  const [activeName, setActiveName] = useState(name ?? "");
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const data = await api<{ categories: Category[] }>("/api/categories");
      setCategories(data.categories);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await api<{ subcategories: Subcategory[] }>(
        `/api/categories/${activeId}/subcategories`
      );
      setSubs(data.subcategories);
      setLoading(false);
    })();
  }, [activeId]);

  const visibleSubs = q.trim()
    ? subs.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()))
    : subs;

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: "All Categories" }} />

      <Pressable
        style={styles.search}
        onPress={() =>
          router.push({
            pathname: "/products",
            params: { categoryId: String(activeId), title: activeName, q },
          })
        }
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <Text style={styles.searchText}>Search in {activeName || "category"}</Text>
      </Pressable>

      <View style={styles.split}>
        <View style={styles.rail}>
          <FlatList
            data={categories}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => {
              const on = item.id === activeId;
              return (
                <Pressable
                  style={[styles.railItem, on && styles.railItemOn]}
                  onPress={() => {
                    setActiveId(item.id);
                    setActiveName(item.name);
                    setQ("");
                  }}
                >
                  {on ? <View style={styles.railBar} /> : null}
                  <View
                    style={[
                      styles.bubble,
                      { backgroundColor: categoryTints[item.name] ?? colors.rail },
                      on && styles.bubbleOn,
                    ]}
                  >
                    {item.iconUrl ? (
                      <Image
                        source={{ uri: mediaUrl(item.iconUrl) }}
                        style={styles.bubbleImg}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.bubbleLetter}>{item.name.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text style={[styles.railLabel, on && styles.railLabelOn]} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={styles.right}>
          <Text style={styles.rightTitle}>{activeName}</Text>
          <Text style={styles.rightMeta}>{subs.length} types</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={visibleSubs}
              keyExtractor={(s) => String(s.id)}
              numColumns={2}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
              ListHeaderComponent={
                <Pressable
                  style={styles.allBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/products",
                      params: { categoryId: String(activeId), title: activeName },
                    })
                  }
                >
                  <Text style={styles.allBtnText}>See all in {activeName}</Text>
                </Pressable>
              }
              ListEmptyComponent={<Empty text="No subtypes yet." />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.subTile}
                  onPress={() =>
                    router.push({
                      pathname: "/products",
                      params: {
                        categoryId: String(activeId),
                        subcategoryId: String(item.id),
                        title: item.name,
                      },
                    })
                  }
                >
                  <View
                    style={[
                      styles.subHero,
                      { backgroundColor: categoryTints[activeName] ?? colors.rail },
                    ]}
                  >
                    {item.iconUrl ? (
                      <Image
                        source={{ uri: mediaUrl(item.iconUrl) }}
                        style={styles.subImg}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.subLetter}>{item.name.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text style={styles.subName}>{item.name}</Text>
                  <Text style={styles.subCount}>{item.itemCount} items</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  search: {
    marginHorizontal: 24,
    marginBottom: 12,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  searchText: { fontFamily: font.medium, color: colors.placeholder, fontSize: 14 },
  split: { flex: 1, flexDirection: "row" },
  rail: { width: 94, backgroundColor: colors.rail },
  railItem: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    position: "relative",
  },
  railItemOn: { backgroundColor: colors.surface },
  railBar: {
    position: "absolute",
    left: 0,
    top: 18,
    bottom: 18,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bubbleOn: { borderWidth: 2, borderColor: colors.accent },
  bubbleImg: { width: 40, height: 40 },
  bubbleLetter: { fontFamily: font.bold, fontSize: 18, color: colors.ink, opacity: 0.45 },
  railLabel: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: font.semibold,
    color: colors.muted,
    textAlign: "center",
  },
  railLabelOn: { color: colors.ink },
  right: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  rightTitle: { fontSize: 18, fontFamily: font.bold, color: colors.ink },
  rightMeta: { fontSize: 13, fontFamily: font.medium, color: colors.muted, marginBottom: 12 },
  allBtn: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  allBtnText: { color: colors.bg, textAlign: "center", fontFamily: font.bold },
  subTile: { flex: 1 },
  subHero: {
    height: 94,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  subImg: { width: 70, height: 70 },
  subLetter: { fontSize: 28, fontFamily: font.extrabold, color: colors.ink, opacity: 0.28 },
  subName: { marginTop: 8, fontSize: 13.5, fontFamily: font.semibold, color: colors.ink },
  subCount: { marginTop: 2, fontSize: 12, fontFamily: font.medium, color: colors.muted },
});
