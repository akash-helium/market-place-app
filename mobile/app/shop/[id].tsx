import { useEffect, useState } from "react";
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import type { Shop } from "../../src/api/types";
import { colors, font } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";
import { mediaUrl } from "../../src/utils/media";

export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);

  useEffect(() => {
    (async () => {
      const data = await api<Shop>(`/api/shops/${id}`);
      setShop(data);
    })();
  }, [id]);

  if (!shop) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  }

  const phones = shop.contacts.filter((c) => c.kind === "phone");
  const emails = shop.contacts.filter((c) => c.kind === "email");
  const address = [shop.addressLine, shop.city, shop.pincode].filter(Boolean).join(", ");
  const products = shop.products ?? [];

  async function share() {
    const data = await api<{ whatsapp: string }>(`/api/shops/${shop!.id}/share-link`);
    await Linking.openURL(data.whatsapp);
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.banner}>
          {shop.bannerUrl ? (
            <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={StyleSheet.absoluteFillObject} />
          ) : null}
          <Pressable style={styles.bannerBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </Pressable>
          <Pressable style={[styles.bannerBtn, { right: 18, left: undefined }]} onPress={share}>
            <Ionicons name="share-outline" size={18} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
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
            <Text style={styles.name}>{shop.name}</Text>
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
              <Text style={styles.noteTitle}>Note from seller</Text>
              <Text style={styles.noteBody}>{shop.noteForBuyers}</Text>
            </View>
          ) : null}

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

          <Text style={styles.sectionHead}>Phone numbers</Text>
          <View style={styles.stack}>
            {phones.map((ph) => (
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
            ))}
          </View>

          <Text style={styles.sectionHead}>Email addresses</Text>
          <View style={styles.stack}>
            {emails.map((em) => (
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
            ))}
          </View>

          <View style={styles.productsHead}>
            <Text style={styles.productsTitle}>Listed products</Text>
            <Text style={styles.productsCount}>{shop.productCount} items</Text>
          </View>
          {products.map((p) => (
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
                {p.packSize ? <Text style={styles.packChip}>{p.packSize}</Text> : null}
              </View>
              <Text style={styles.price}>{formatPaise(p.pricePaise)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  banner: { height: 172, backgroundColor: colors.rail, position: "relative" },
  bannerBtn: {
    position: "absolute",
    top: 54,
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
});
