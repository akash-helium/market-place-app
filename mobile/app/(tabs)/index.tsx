import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/api/client";
import type { Category } from "../../src/api/types";
import { Empty, Field, IconButton } from "../../src/components/ui";
import { categoryTints, colors, font } from "../../src/theme";
import { mediaUrl } from "../../src/utils/media";

type SortKey = "newest" | "price_asc" | "price_desc";

export default function HomeScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [inStockOnly, setInStockOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          const cat = await api<{ categories: Category[] }>("/api/categories");
          if (!alive) return;
          setCategories(cat.categories);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.tagline ?? "").toLowerCase().includes(term)
    );
  }, [categories, q]);

  function applyFilter() {
    setFilterOpen(false);
    const params: Record<string, string> = {
      sort,
      title: q.trim() || "All products",
    };
    if (q.trim()) params.q = q.trim();
    if (inStockOnly) params.inStock = "1";
    router.push({ pathname: "/products", params });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>HarvestHub</Text>
        <Pressable style={styles.listChip} onPress={() => router.push("/sell/add")}>
          <Ionicons name="add" size={17} color="#FFFFFF" />
          <Text style={styles.listChipText}>List</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.search, focused && { borderColor: colors.accent }]}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <Field
            style={styles.searchInput}
            placeholder="Search rice, dal, veggies…"
            value={q}
            onChangeText={setQ}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (q.trim()) {
                router.push({
                  pathname: "/products",
                  params: { q: q.trim(), title: q.trim(), sort },
                });
              }
            }}
          />
          {q ? (
            <Pressable onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <IconButton size={50} onPress={() => setFilterOpen(true)}>
          <Ionicons name="options-outline" size={21} color={colors.ink} />
        </IconButton>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Shop by category</Text>
        <Text style={styles.sectionMeta}>{filtered.length} categories</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 14 }}
          contentContainerStyle={{ gap: 18, paddingHorizontal: 24, paddingBottom: 110 }}
          ListEmptyComponent={
            <Empty text="No categories found" sub="Try another search term." />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.tile}
              onPress={() =>
                router.push({
                  pathname: "/category/[id]",
                  params: { id: String(item.id), name: item.name },
                })
              }
            >
              <View
                style={[
                  styles.hero,
                  { backgroundColor: categoryTints[item.name] ?? colors.rail },
                ]}
              >
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{item.itemCount} items</Text>
                </View>
                {item.iconUrl ? (
                  <Image
                    source={{ uri: mediaUrl(item.iconUrl) }}
                    style={styles.heroImg}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.heroLetter}>{item.name.slice(0, 1)}</Text>
                )}
              </View>
              <Text style={styles.tileName}>{item.name}</Text>
              <Text style={styles.tileTag}>{item.tagline}</Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Filter & sort</Text>

            <Text style={styles.sheetLabel}>Sort by</Text>
            {(
              [
                ["newest", "Newest first"],
                ["price_asc", "Price: low to high"],
                ["price_desc", "Price: high to low"],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.option, sort === key && styles.optionOn]}
                onPress={() => setSort(key)}
              >
                <Text style={[styles.optionText, sort === key && styles.optionTextOn]}>
                  {label}
                </Text>
                {sort === key ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}

            <Pressable
              style={[styles.option, inStockOnly && styles.optionOn]}
              onPress={() => setInStockOnly((v) => !v)}
            >
              <Text style={[styles.optionText, inStockOnly && styles.optionTextOn]}>
                In stock only
              </Text>
              <Ionicons
                name={inStockOnly ? "checkbox" : "square-outline"}
                size={22}
                color={inStockOnly ? colors.accent : colors.muted}
              />
            </Pressable>

            <Pressable style={styles.applyBtn} onPress={applyFilter}>
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
  },
  brand: { fontSize: 26, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.6 },
  listChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 46,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: colors.ink,
  },
  listChipText: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 14 },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    minHeight: 40,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  section: { fontSize: 17, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.3 },
  sectionMeta: { fontSize: 13, fontFamily: font.semibold, color: colors.muted },
  tile: { flex: 1 },
  hero: {
    height: 150,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroImg: { width: "78%", height: "78%" },
  countPill: {
    position: "absolute",
    top: 9,
    left: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.9)",
    zIndex: 2,
  },
  countPillText: { fontSize: 11, fontFamily: font.bold, color: colors.ink },
  heroLetter: { fontSize: 48, fontFamily: font.extrabold, color: colors.ink, opacity: 0.22 },
  tileName: {
    marginTop: 11,
    marginBottom: 2,
    fontSize: 15.5,
    fontFamily: font.semibold,
    color: colors.ink,
  },
  tileTag: { fontSize: 13, fontFamily: font.medium, color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,20,25,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 32,
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 22, fontFamily: font.bold, color: colors.ink, marginBottom: 14 },
  sheetLabel: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionText: { fontFamily: font.semibold, color: colors.ink, fontSize: 15 },
  optionTextOn: { color: colors.accent },
  applyBtn: {
    marginTop: 12,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: "#fff", fontFamily: font.bold, fontSize: 16 },
});
