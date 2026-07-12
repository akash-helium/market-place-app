import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api, ApiError } from "../../src/api/client";
import type { OrderSummary } from "../../src/api/types";
import { Empty, ErrorText } from "../../src/components/ui";
import { colors, radius, space } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";

export default function OrdersScreen() {
  const { as } = useLocalSearchParams<{ as?: string }>();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seller = as === "seller";

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          const path = seller ? "/api/orders?as=seller" : "/api/orders";
          const data = await api<{ orders: OrderSummary[] }>(path);
          if (alive) setOrders(data.orders);
        } catch (e) {
          if (alive) setError(e instanceof ApiError ? e.message : "Failed");
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [seller])
  );

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: seller ? "Seller orders" : "My orders" }} />
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          ListEmptyComponent={<Empty text="No orders yet." />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/orders/${item.id}`)}>
              <Text style={styles.num}>{item.orderNumber}</Text>
              <Text style={styles.meta}>
                {item.status} · {item.itemsCount} items · {formatPaise(item.totalPaise)}
              </Text>
              <Text style={styles.meta}>{item.shopName ?? item.buyerPhone}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  num: { fontWeight: "800", color: colors.ink, fontSize: 16 },
  meta: { marginTop: 4, color: colors.muted, fontSize: 13 },
});
