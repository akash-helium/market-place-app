import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, ApiError } from "../../src/api/client";
import { Button, Empty, ErrorText, Field } from "../../src/components/ui";
import { colors, space } from "../../src/theme";

type QueryRow = {
  id: number;
  question: string;
  reply: string | null;
  productTitle: string;
  buyerPhone: string;
};

export default function QueriesScreen() {
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ queries: QueryRow[] }>("/api/queries");
      setQueries(data.queries);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function reply(id: number) {
    const text = replies[id]?.trim();
    if (!text) return;
    try {
      await api(`/api/queries/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply: text }),
      });
      Alert.alert("Sent", "Buyer will get a notification");
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed");
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;

  return (
    <View style={styles.wrap}>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={queries}
        keyExtractor={(q) => String(q.id)}
        ListEmptyComponent={<Empty text="No buyer questions yet." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>?</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.product}>{item.productTitle}</Text>
              <Text style={styles.q}>{item.question}</Text>
              <Text style={styles.meta}>{item.buyerPhone}</Text>
              {item.reply ? (
                <Text style={styles.reply}>You: {item.reply}</Text>
              ) : (
                <>
                  <Field
                    placeholder="Your reply"
                    value={replies[item.id] ?? ""}
                    onChangeText={(t) => setReplies((r) => ({ ...r, [item.id]: t }))}
                  />
                  <Button title="Reply" onPress={() => reply(item.id)} />
                </>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconText: { fontWeight: "800", color: colors.accent, fontSize: 18 },
  product: { fontWeight: "800", color: colors.ink },
  q: { marginTop: 8, color: colors.ink, fontSize: 15 },
  meta: { marginTop: 4, color: colors.muted, fontSize: 12 },
  reply: { marginTop: 10, color: colors.success, fontWeight: "600" },
});
