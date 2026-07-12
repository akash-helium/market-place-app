import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import type { Shop } from "../../src/api/types";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/ui";
import { colors, font } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";
import { mediaUrl } from "../../src/utils/media";

type MenuItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
};

export default function ProfileScreen() {
  const { me, logout, setSession } = useAuth();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const load = useCallback(async () => {
    if (!me?.shopId) {
      setShop(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api<Shop>("/api/shops/me");
      setShop(data);
    } catch {
      setShop(null);
    } finally {
      setLoading(false);
    }
  }, [me?.shopId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function loginDemo() {
    setDemoLoading(true);
    try {
      const data = await api<{ token: string }>("/api/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ phone: "9810817196" }),
      });
      await setSession(data.token);
    } finally {
      setDemoLoading(false);
    }
  }

  if (!me) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.guest}>
          <Text style={styles.guestTitle}>Profile</Text>
          <Text style={styles.guestSub}>Sign in to manage your shop and buyer queries.</Text>
          <Button
            title={demoLoading ? "Signing in…" : "Continue as demo seller"}
            onPress={loginDemo}
            loading={demoLoading}
            variant="accent"
          />
          <Button title="Phone login" onPress={() => router.push("/(auth)/phone")} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !shop) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />;
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.guest}>
          <Text style={styles.guestTitle}>Set up your shop</Text>
          <Text style={styles.guestSub}>
            Signed in as {me.phone}. Create a profile to sell and get buyer queries.
          </Text>
          <Button title="Set up profile" onPress={() => router.push("/(onboarding)/shop-setup")} />
          <Button
            title="Log out"
            variant="danger"
            onPress={async () => {
              await logout();
              router.replace("/(auth)/phone");
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const phones = shop.contacts.filter((c) => c.kind === "phone");
  const emails = shop.contacts.filter((c) => c.kind === "email");
  const address = [shop.addressLine, shop.city, shop.pincode].filter(Boolean).join(", ");
  const products = shop.products ?? [];

  const menu: MenuItem[] = [
    {
      key: "edit",
      icon: "create-outline",
      title: "Edit profile",
      subtitle: "Name, banner, phones, emails",
      onPress: () => router.push("/shop/edit"),
    },
    {
      key: "queries",
      icon: "chatbubble-ellipses-outline",
      title: "Buyer queries",
      subtitle: "Questions about your products",
      onPress: () => router.push("/queries"),
    },
    {
      key: "seller-orders",
      icon: "receipt-outline",
      title: "Seller orders",
      subtitle: "Orders placed with your shop",
      onPress: () => router.push({ pathname: "/orders", params: { as: "seller" } }),
    },
    {
      key: "orders",
      icon: "bag-handle-outline",
      title: "My orders",
      subtitle: "Orders you placed as a buyer",
      onPress: () => router.push("/orders"),
    },
    {
      key: "cart",
      icon: "cart-outline",
      title: "My cart",
      subtitle: "Review items before checkout",
      onPress: () => router.push("/(tabs)/cart"),
    },
    {
      key: "alerts",
      icon: "notifications-outline",
      title: "Notifications",
      subtitle: "Alerts and updates",
      onPress: () => router.push("/(tabs)/notifications"),
    },
    {
      key: "list",
      icon: "add-circle-outline",
      title: "List a product",
      subtitle: "Add one item or bulk upload",
      onPress: () => router.push("/sell/add"),
    },
    {
      key: "logout",
      icon: "log-out-outline",
      title: "Log out",
      subtitle: me.phone,
      danger: true,
      onPress: async () => {
        await logout();
        router.replace("/(auth)/phone");
      },
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner */}
        <View style={styles.banner}>
          {shop.bannerUrl ? (
            <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={StyleSheet.absoluteFillObject} />
          ) : null}
          <Pressable style={styles.bannerBtn} onPress={() => router.push("/shop/edit")}>
            <Ionicons name="create-outline" size={18} color={colors.ink} />
          </Pressable>
          <Pressable
            style={[styles.bannerBtn, { right: 18, left: undefined }]}
            onPress={async () => {
              const data = await api<{ whatsapp: string }>(`/api/shops/${shop.id}/share-link`);
              await Linking.openURL(data.whatsapp);
            }}
          >
            <Ionicons name="share-outline" size={18} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Avatar + rating */}
          <View style={styles.avatarRow}>
            {shop.logoUrl ? (
              <Image source={{ uri: mediaUrl(shop.logoUrl) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarLetter}>{shop.name.slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={styles.ratingText}>{Number(shop.ratingAvg).toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>
              {shop.name}
            </Text>
            {shop.isVerified ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
            ) : null}
          </View>

          <View style={styles.chips}>
            <Text style={styles.chip}>
              {shop.yearsOnPlatform || 1} yr{shop.yearsOnPlatform === 1 ? "" : "s"} on platform
            </Text>
            <Text style={styles.chip}>{shop.productCount} products</Text>
          </View>

          {shop.description ? <Text style={styles.desc}>{shop.description}</Text> : null}

          {shop.noteForBuyers ? (
            <View style={styles.note}>
              <Text style={styles.noteTitle}>Note for buyers</Text>
              <Text style={styles.noteBody}>{shop.noteForBuyers}</Text>
            </View>
          ) : null}

          {/* Address */}
          {address ? (
            <View style={styles.addressCard}>
              <View style={styles.addressIcon}>
                <Ionicons name="location-outline" size={19} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Address</Text>
                <Text style={styles.addressText}>{address}</Text>
              </View>
            </View>
          ) : null}

          {/* Phones */}
          <Text style={styles.sectionHead}>Phone numbers</Text>
          <View style={styles.stack}>
            {phones.length === 0 ? (
              <Text style={styles.emptyHint}>No phones yet — add them in Edit profile</Text>
            ) : (
              phones.map((ph) => (
                <View key={`${ph.value}-${ph.label}`} style={styles.contactCard}>
                  <Ionicons name="call-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactValue}>{ph.value}</Text>
                    {ph.label ? <Text style={styles.contactLabel}>{ph.label}</Text> : null}
                  </View>
                  <Pressable
                    style={styles.contactAction}
                    onPress={() => Linking.openURL(`tel:${ph.value}`)}
                  >
                    <Text style={styles.contactActionText}>Call</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* Emails */}
          <Text style={styles.sectionHead}>Email addresses</Text>
          <View style={styles.stack}>
            {emails.length === 0 ? (
              <Text style={styles.emptyHint}>No emails yet — add them in Edit profile</Text>
            ) : (
              emails.map((em) => (
                <View key={`${em.value}-${em.label}`} style={styles.contactCard}>
                  <Ionicons name="mail-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactValue} numberOfLines={1}>
                      {em.value}
                    </Text>
                    {em.label ? <Text style={styles.contactLabel}>{em.label}</Text> : null}
                  </View>
                  <Pressable
                    style={styles.contactAction}
                    onPress={() => Linking.openURL(`mailto:${em.value}`)}
                  >
                    <Text style={styles.contactActionText}>Mail</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* Account menu — same card style as query cards */}
          <Text style={[styles.sectionHead, { marginTop: 8 }]}>Your account</Text>
          <View style={styles.stack}>
            {menu.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.menuCard, item.danger && styles.menuDanger]}
                onPress={item.onPress}
              >
                <View style={[styles.menuIcon, item.danger && styles.menuIconDanger]}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.danger ? colors.danger : colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuTitle, item.danger && { color: colors.danger }]}>
                    {item.title}
                  </Text>
                  <Text style={styles.menuSub}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          {/* Listed products */}
          <View style={styles.productsHead}>
            <Text style={styles.productsTitle}>Listed products</Text>
            <Text style={styles.productsCount}>{shop.productCount} items</Text>
          </View>
          {products.length === 0 ? (
            <Text style={styles.emptyHint}>No live products yet.</Text>
          ) : (
            products.slice(0, 8).map((p) => (
              <Pressable
                key={p.id}
                style={styles.productRow}
                onPress={() => router.push(`/product/${p.id}`)}
              >
                {p.coverUrl ? (
                  <Image source={{ uri: mediaUrl(p.coverUrl) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.rail }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.pTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                  {p.packSize ? (
                    <Text style={styles.packChip}>{p.packSize}</Text>
                  ) : null}
                </View>
                <Text style={styles.price}>{formatPaise(p.pricePaise)}</Text>
              </Pressable>
            ))
          )}
          {products.length > 8 ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/products", params: { shopId: String(shop.id) } })
              }
            >
              <Text style={styles.seeAll}>See all products</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  guest: { flex: 1, padding: 24, gap: 12, justifyContent: "center" },
  guestTitle: { fontSize: 28, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.5 },
  guestSub: { fontSize: 15, fontFamily: font.medium, color: colors.muted, lineHeight: 22, marginBottom: 8 },

  banner: {
    height: 172,
    backgroundColor: colors.rail,
    position: "relative",
  },
  bannerBtn: {
    position: "absolute",
    top: 14,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  body: { paddingHorizontal: 22 },
  avatarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -46,
    marginBottom: 14,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: colors.bg,
    backgroundColor: colors.rail,
  },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontFamily: font.extrabold, fontSize: 36, color: colors.ink },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  ratingText: { fontFamily: font.bold, fontSize: 13, color: colors.ink },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  name: { flexShrink: 1, fontSize: 24, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    fontSize: 12.5,
    fontFamily: font.semibold,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 11,
    overflow: "hidden",
  },
  desc: {
    fontSize: 14.5,
    lineHeight: 23,
    fontFamily: font.medium,
    color: colors.muted,
    marginBottom: 18,
  },
  note: {
    backgroundColor: colors.warnSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  noteTitle: { fontFamily: font.bold, color: colors.warn, fontSize: 12, textTransform: "uppercase" },
  noteBody: { marginTop: 4, fontFamily: font.medium, color: colors.ink, lineHeight: 20 },

  addressCard: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
  },
  addressIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.rail,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  addressText: { fontSize: 14, fontFamily: font.medium, color: colors.ink, lineHeight: 20 },

  sectionHead: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 11,
  },
  stack: { gap: 10, marginBottom: 22 },
  emptyHint: { fontFamily: font.medium, color: colors.muted, fontSize: 13, marginBottom: 8 },

  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 11,
  },
  contactValue: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  contactLabel: { fontSize: 12, fontFamily: font.medium, color: colors.muted, marginTop: 1 },
  contactAction: {
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  contactActionText: { fontSize: 13.5, fontFamily: font.bold, color: colors.bg },

  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
  },
  menuDanger: { borderColor: "rgba(200,29,37,0.25)" },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: { backgroundColor: colors.dangerSoft },
  menuTitle: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  menuSub: { marginTop: 2, fontSize: 12.5, fontFamily: font.medium, color: colors.muted },

  productsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  productsTitle: { fontSize: 18, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.3 },
  productsCount: { fontSize: 13, fontFamily: font.semibold, color: colors.muted },
  productRow: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  thumb: { width: 64, height: 64, borderRadius: 15, backgroundColor: colors.rail },
  pTitle: { fontSize: 14.5, fontFamily: font.semibold, color: colors.ink, lineHeight: 19 },
  packChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  price: { fontSize: 15.5, fontFamily: font.bold, color: colors.ink },
  seeAll: {
    marginTop: 14,
    textAlign: "center",
    fontFamily: font.bold,
    color: colors.accent,
    fontSize: 14,
  },
});
