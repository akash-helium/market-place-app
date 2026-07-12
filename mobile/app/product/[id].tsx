import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError } from "../../src/api/client";
import type { ProductDetail } from "../../src/api/types";
import { Button, Chip, ErrorText, Field } from "../../src/components/ui";
import { colors, font } from "../../src/theme";
import { formatPaise } from "../../src/utils/money";
import { mediaUrl } from "../../src/utils/media";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    (async () => {
      const data = await api<ProductDetail>(`/api/products/${id}`);
      setProduct(data);
    })();
  }, [id]);

  if (!product) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  }

  const na = product.pricePaise == null;
  const cover = product.photos.find((p) => p.isCover)?.url ?? product.photos[0]?.url;
  const phones = product.sellerPhones ?? [];
  const emails = product.sellerEmails ?? [];

  async function sendQuery() {
    const text = question.trim();
    if (text.length < 2) {
      setError("Type your question first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/products/${product!.id}/queries`, {
        method: "POST",
        body: JSON.stringify({ question: text }),
      });
      setQueryOpen(false);
      setQuestion("");
      Alert.alert("Sent", "Your question was sent to the seller.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send query");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: product.title, presentation: "modal" }} />
      <Text style={styles.crumb}>
        {product.category}
        {product.subcategory ? ` · ${product.subcategory}` : ""}
      </Text>
      {cover ? (
        <Image source={{ uri: mediaUrl(cover) }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, { backgroundColor: colors.rail }]} />
      )}
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.price}>{formatPaise(product.pricePaise)}</Text>
      {product.mrpPaise ? (
        <Text style={styles.mrp}>{formatPaise(product.mrpPaise)}</Text>
      ) : null}
      {product.packSize ? <Chip label={`${product.packSize} pack`} tone="muted" /> : null}
      {na ? (
        <Text style={styles.hint}>Price N/A — please query the seller</Text>
      ) : null}

      <View style={styles.attrs}>
        {["Farm fresh", "Hand-cleaned", "Quality graded", "No additives"].map((a) => (
          <View key={a} style={styles.attr}>
            <Text style={styles.attrText}>{a}</Text>
          </View>
        ))}
      </View>

      {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}

      <Text style={styles.soldBy}>Sold by</Text>
      <View style={styles.seller}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sellerName}>{product.shopName}</Text>
          <Text style={styles.sellerMeta}>
            {product.shopCity ?? ""} · ★ {product.shopRating ?? "—"}
            {product.shopVerified ? " · Verified" : ""}
          </Text>
        </View>
        <Button
          title="Profile"
          variant="outline"
          height={38}
          onPress={() => router.push(`/shop/${product.shopId}`)}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <Button
          title="Query product"
          variant="accent"
          height={54}
          onPress={() => setQueryOpen(true)}
        />
      </View>
      <ErrorText>{error}</ErrorText>

      <Modal
        visible={queryOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setQueryOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setQueryOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Query product</Text>
            <Text style={styles.sheetSub}>Ask {product.shopName} about this item</Text>

            <Field
              well
              value={question}
              onChangeText={setQuestion}
              placeholder="e.g. Is this available for next-day dispatch?"
              multiline
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />

            <Button title="Send question" onPress={sendQuery} loading={busy} height={52} />

            {(phones.length > 0 || emails.length > 0) && (
              <>
                <Text style={styles.or}>Or contact directly</Text>
                {phones.map((p) => (
                  <View key={p.value} style={styles.contactRow}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="call-outline" size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactValue}>{p.value}</Text>
                      <Text style={styles.contactLabel}>{p.label ?? "Phone"}</Text>
                    </View>
                    <Pressable
                      style={styles.actionChip}
                      onPress={() => Linking.openURL(`tel:${p.value}`)}
                    >
                      <Text style={styles.actionChipText}>Call</Text>
                    </Pressable>
                  </View>
                ))}
                {emails.map((e) => (
                  <View key={e.value} style={styles.contactRow}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="mail-outline" size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactValue}>{e.value}</Text>
                      <Text style={styles.contactLabel}>{e.label ?? "Email"}</Text>
                    </View>
                    <Pressable
                      style={styles.actionChip}
                      onPress={() => Linking.openURL(`mailto:${e.value}`)}
                    >
                      <Text style={styles.actionChipText}>Mail</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            <Button title="Close" variant="ghost" height={44} onPress={() => setQueryOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingBottom: 48, backgroundColor: colors.bg },
  crumb: { color: colors.muted, fontSize: 12, fontFamily: font.bold, letterSpacing: 0.3 },
  hero: { marginTop: 12, width: "100%", height: 178, borderRadius: 20 },
  title: {
    marginTop: 14,
    fontSize: 23,
    fontFamily: font.bold,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  price: { marginTop: 8, fontSize: 24, fontFamily: font.extrabold, color: colors.ink },
  mrp: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  hint: {
    marginTop: 8,
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    padding: 8,
    borderRadius: 8,
    fontFamily: font.medium,
  },
  attrs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  attr: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.rail,
  },
  attrText: { fontSize: 12, fontFamily: font.semibold, color: colors.ink },
  desc: { marginTop: 14, color: colors.ink, lineHeight: 22, fontFamily: font.medium },
  soldBy: {
    marginTop: 22,
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  seller: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 14,
  },
  sellerName: { fontFamily: font.bold, color: colors.ink, fontSize: 15 },
  sellerMeta: { marginTop: 3, fontFamily: font.medium, color: colors.muted, fontSize: 12 },
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
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 22, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.4 },
  sheetSub: { marginTop: 4, marginBottom: 16, fontFamily: font.medium, color: colors.muted },
  or: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  contactValue: { fontFamily: font.bold, color: colors.ink, fontSize: 15 },
  contactLabel: { marginTop: 2, fontFamily: font.medium, color: colors.muted, fontSize: 12 },
  actionChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: { color: colors.bg, fontFamily: font.bold, fontSize: 13 },
});
