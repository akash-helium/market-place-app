import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "../../src/api/client";
import type { NotificationItem } from "../../src/api/types";
import { Empty, ErrorText } from "../../src/components/ui";
import { colors, font } from "../../src/theme";

function typeStyle(type: string) {
  switch (type) {
    case "order":
    case "query":
      return { bg: colors.accentSoft, fg: colors.accent, icon: "cart-outline" as const };
    case "payout":
      return { bg: colors.successSoft, fg: colors.success, icon: "cash-outline" as const };
    case "review":
      return { bg: colors.warnSoft, fg: colors.warn, icon: "star-outline" as const };
    case "low_stock":
      return { bg: colors.dangerSoft, fg: "#C0573A", icon: "cube-outline" as const };
    default:
      return { bg: "#ECEAE5", fg: "#6B6862", icon: "information-circle-outline" as const };
  }
}

function groupLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);
  if (d >= startToday) return "Today";
  if (d >= startWeek) return "This week";
  return "Earlier";
}

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ notifications: NotificationItem[] }>("/api/notifications");
      setItems(data.notifications);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const unread = items.filter((i) => !i.isRead).length;

  const sections = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of items) {
      const g = groupLabel(n.createdAt);
      const list = map.get(g) ?? [];
      list.push(n);
      map.set(g, list);
    }
    return ["Today", "This week", "Earlier"]
      .filter((k) => map.has(k))
      .flatMap((k) => [
        { kind: "header" as const, key: k },
        ...(map.get(k) ?? []).map((n) => ({ kind: "row" as const, n })),
      ]);
  }, [items]);

  async function markAll() {
    await api("/api/notifications/mark-all-read", { method: "POST", body: "{}" });
    await load();
  }

  async function openItem(n: NotificationItem) {
    if (!n.isRead) {
      await api(`/api/notifications/${n.id}/read`, { method: "PATCH", body: "{}" });
    }
    const orderId = n.data?.orderId;
    if (typeof orderId === "number") router.push(`/orders/${orderId}`);
    else await load();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <View>
          <Text style={styles.h}>Notifications</Text>
          <Text style={styles.sub}>
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </Text>
        </View>
        <Pressable onPress={markAll}>
          <Text style={[styles.mark, { color: unread ? colors.accent : colors.muted }]}>
            Mark all read
          </Text>
        </Pressable>
      </View>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, i) => (item.kind === "header" ? item.key : `${item.n.id}-${i}`)}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          ListEmptyComponent={<Empty text="No alerts yet." />}
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return <Text style={styles.group}>{item.key}</Text>;
            }
            const n = item.n;
            const t = typeStyle(n.type);
            return (
              <Pressable
                style={[styles.row, !n.isRead && styles.unread]}
                onPress={() => openItem(n)}
              >
                <View style={[styles.icon, { backgroundColor: t.bg }]}>
                  <Ionicons name={t.icon} size={20} color={t.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                </View>
                <View style={styles.rightCol}>
                  <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                  {!n.isRead ? <View style={styles.dot} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  h: { fontSize: 26, fontFamily: font.bold, color: colors.ink },
  sub: { marginTop: 2, fontFamily: font.medium, color: colors.muted, fontSize: 13 },
  mark: { fontFamily: font.bold, fontSize: 14, marginTop: 8 },
  group: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.muted,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
  },
  unread: {
    borderColor: colors.accentBorder,
    backgroundColor: "rgba(27,122,74,0.05)",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: font.bold, color: colors.ink, fontSize: 14.5 },
  body: { marginTop: 3, fontFamily: font.medium, color: colors.muted, fontSize: 13 },
  rightCol: { alignItems: "flex-end", gap: 8 },
  time: { fontSize: 11, fontFamily: font.semibold, color: colors.muted },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
});
