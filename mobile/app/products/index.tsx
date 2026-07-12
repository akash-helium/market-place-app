import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/api/client";
import type { ProductListItem } from "../../src/api/types";
import { Chip, Empty } from "../../src/components/ui";
import { colors, font, radius, space } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";
import { mediaUrl } from "../../src/utils/media";

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    categoryId?: string;
    subcategoryId?: string;
    q?: string;
    shopId?: string;
    title?: string;
    sort?: string;
    inStock?: string;
  }>();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState(params.sort ?? "newest");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (params.categoryId) qs.set("categoryId", params.categoryId);
    if (params.subcategoryId) qs.set("subcategoryId", params.subcategoryId);
    if (params.q) qs.set("q", params.q);
    if (params.shopId) qs.set("shopId", params.shopId);
    if (params.inStock === "1") qs.set("inStock", "1");
    qs.set("sort", sort);
    qs.set("limit", "50");
    const data = await api<{ products: ProductListItem[] }>(`/api/products?${qs}`);
    setProducts(data.products);
    setLoading(false);
  }, [params.categoryId, params.subcategoryId, params.q, params.shopId, params.inStock, sort]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: params.title ?? params.q ?? "Products" }} />
      <View style={styles.sorts}>
        {(["newest", "price_asc", "price_desc"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSort(s)}
            style={[styles.sortChip, sort === s && styles.sortActive]}
          >
            <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
              {s === "newest" ? "Newest" : s === "price_asc" ? "Price ↑" : "Price ↓"}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          ListEmptyComponent={<Empty text="No products found." />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
              {item.coverUrl ? (
                <Image source={{ uri: mediaUrl(item.coverUrl) }} style={styles.img} />
              ) : (
                <View style={[styles.img, styles.imgEmpty]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>{item.shopName}</Text>
                {item.packSize ? <Chip label={item.packSize} tone="muted" /> : null}
                <Text style={styles.price}>{formatPaise(item.pricePaise)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  sorts: { flexDirection: "row", gap: 8, marginVertical: 10 },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  sortActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  sortText: { fontSize: 13, fontFamily: font.semibold, color: colors.muted },
  sortTextActive: { color: colors.accent },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  img: { width: 74, height: 74, borderRadius: 14, backgroundColor: colors.rail },
  imgEmpty: { borderWidth: 1, borderColor: colors.line },
  title: { fontFamily: font.bold, color: colors.ink, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 12, fontFamily: font.medium },
  price: { marginTop: 8, fontFamily: font.extrabold, color: colors.ink, fontSize: 16 },
});
