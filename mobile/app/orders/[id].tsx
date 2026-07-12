import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, ErrorText } from "../../src/components/ui";
import { colors, space } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";

type OrderDetail = {
  id: number;
  orderNumber: string;
  status: string;
  totalPaise: number;
  shopId: number;
  items: { title: string; quantity: number; pricePaise: number }[];
  deliveryAddress?: string;
  deliveryPincode?: string;
};

const NEXT: Record<string, string | undefined> = {
  placed: "confirmed",
  confirmed: "dispatched",
  dispatched: "delivered",
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<OrderDetail>(`/api/orders/${id}`);
    setOrder(data);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!order) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;

  const next = NEXT[order.status];
  const isSeller = me?.shopId === order.shopId;

  async function advance() {
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
      Alert.alert("Updated", `Status → ${next}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: order.orderNumber }} />
      <Text style={styles.status}>{order.status}</Text>
      <Text style={styles.total}>{formatPaise(order.totalPaise)}</Text>
      {order.deliveryAddress ? (
        <Text style={styles.meta}>
          {order.deliveryAddress} · {order.deliveryPincode}
        </Text>
      ) : null}
      {order.items.map((it, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.itemTitle}>
            {it.title} × {it.quantity}
          </Text>
          <Text style={styles.meta}>{formatPaise(it.pricePaise * it.quantity)}</Text>
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
      {isSeller && next ? (
        <Button title={`Mark ${next}`} onPress={advance} loading={busy} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  status: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "uppercase",
    fontSize: 12,
  },
  total: { marginTop: 12, fontSize: 28, fontWeight: "800", color: colors.ink },
  meta: { marginTop: 4, color: colors.muted },
  item: {
    marginTop: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemTitle: { fontWeight: "600", color: colors.ink },
});
