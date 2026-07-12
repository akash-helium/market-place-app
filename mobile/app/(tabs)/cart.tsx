import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, ApiError } from "../../src/api/client";
import type { Cart, CartItem } from "../../src/api/types";
import { Button, Empty, ErrorText } from "../../src/components/ui";
import { colors, radius, space } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";
import { mediaUrl } from "../../src/utils/media";

export default function CartScreen() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Cart>("/api/cart");
      setCart(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load cart");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of cart?.items ?? []) {
      const list = map.get(item.shopName) ?? [];
      list.push(item);
      map.set(item.shopName, list);
    }
    return [...map.entries()];
  }, [cart]);

  async function setQty(id: number, quantity: number) {
    if (quantity < 1) {
      await api(`/api/cart/items/${id}`, { method: "DELETE" });
    } else {
      await api(`/api/cart/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({ quantity }),
      });
    }
    await load();
  }

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;
  }

  return (
    <View style={styles.wrap}>
      <ErrorText>{error}</ErrorText>
      {!cart?.items.length ? (
        <Empty text="Cart is empty — browse Home to add bags." />
      ) : (
        <>
          <FlatList
            data={grouped}
            keyExtractor={([shop]) => shop}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item: [shop, items] }) => (
              <View style={styles.group}>
                <Text style={styles.shop}>{shop}</Text>
                {items.map((row) => (
                  <View key={row.id} style={styles.row}>
                    {row.coverUrl ? (
                      <Image source={{ uri: mediaUrl(row.coverUrl) }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{row.title}</Text>
                      <Text style={styles.meta}>
                        {row.packSize} · {formatPaise(row.pricePaise)}
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable onPress={() => setQty(row.id, row.quantity - 1)} style={styles.stepBtn}>
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <Text style={styles.qty}>{row.quantity}</Text>
                        <Pressable onPress={() => setQty(row.id, row.quantity + 1)} style={styles.stepBtn}>
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          />
          <View style={styles.footer}>
            <Text style={styles.total}>{cart.totalDisplay}</Text>
            <Button title="Checkout & pay" onPress={() => router.push("/checkout")} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shop: { fontWeight: "700", color: colors.brand, marginBottom: 10 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.brandSoft },
  thumbEmpty: { borderWidth: 1, borderColor: colors.line },
  title: { fontWeight: "600", color: colors.ink, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 2, fontSize: 13 },
  stepper: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 18, fontWeight: "700", color: colors.brand },
  qty: { fontWeight: "700", minWidth: 20, textAlign: "center" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  total: { fontSize: 20, fontWeight: "800", color: colors.ink },
});
