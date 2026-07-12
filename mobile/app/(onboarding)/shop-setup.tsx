import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, ErrorText, Field, Label } from "../../src/components/ui";
import { colors, font } from "../../src/theme";
import { mediaUrl } from "../../src/utils/media";
import { pickAndUploadImage } from "../../src/utils/upload";

type Contact = { id: string; value: string };

export default function ShopSetupScreen() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [phones, setPhones] = useState<Contact[]>([{ id: "1", value: "" }]);
  const [emails, setEmails] = useState<Contact[]>([{ id: "1", value: "" }]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<"banner" | "logo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  async function pick(kind: "banner" | "logo") {
    setUploading(kind);
    setError(null);
    try {
      const url = await pickAndUploadImage(kind === "banner" ? [16, 9] : [1, 1]);
      if (url) {
        if (kind === "banner") setBannerUrl(url);
        else setLogoUrl(url);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function save(skip = false) {
    if (!skip && !canSave) {
      setError("Shop / Your name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const contacts = [
        ...phones
          .filter((p) => p.value.trim())
          .map((p) => ({ kind: "phone" as const, value: p.value.trim() })),
        ...emails
          .filter((e) => e.value.trim())
          .map((e) => ({ kind: "email" as const, value: e.value.trim() })),
      ];
      const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
      const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || undefined;
      const pincodeMatch = address.match(/\b\d{6}\b/);
      await api("/api/shops/me", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim() || "My Shop",
          description: description.trim() || undefined,
          addressLine: address.trim() || undefined,
          city,
          pincode: pincodeMatch?.[0],
          bannerUrl: bannerUrl || undefined,
          logoUrl: logoUrl || undefined,
          contacts: contacts.length ? contacts : undefined,
        }),
      });
      await refreshMe();
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save shop");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.step}>Step 2 of 2</Text>
          <Text style={styles.h1}>Set up your profile</Text>
        </View>
        <Pressable onPress={() => save(true)}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.mediaBlock}>
          <Pressable style={styles.banner} onPress={() => pick("banner")}>
            {bannerUrl ? (
              <Image source={{ uri: mediaUrl(bannerUrl) }} style={StyleSheet.absoluteFillObject} />
            ) : (
              <Text style={styles.slotText}>
                {uploading === "banner" ? "Uploading…" : "Add cover banner"}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.avatarWrap} onPress={() => pick("logo")}>
            {logoUrl ? (
              <Image source={{ uri: mediaUrl(logoUrl) }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{uploading === "logo" ? "…" : "Photo"}</Text>
              </View>
            )}
            <View style={styles.cam}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
        </View>

        <Label>Shop / Your name</Label>
        <Field value={name} onChangeText={setName} placeholder="e.g. Greenfield Traders" />

        <Label>Description</Label>
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="Tell buyers what you sell, since when, certifications…"
          multiline
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />

        <Label>Address</Label>
        <Field
          value={address}
          onChangeText={setAddress}
          placeholder="Shop no, street, area, city, PIN"
          multiline
          style={{ minHeight: 74, textAlignVertical: "top" }}
        />

        <View style={styles.rowBetween}>
          <Label>Phone numbers</Label>
          <Text style={styles.added}>{phones.filter((p) => p.value.trim()).length} added</Text>
        </View>
        {phones.map((p, idx) => (
          <View key={p.id} style={styles.contactRow}>
            <Ionicons name="call-outline" size={18} color={colors.muted} />
            <Field
              style={{ flex: 1, marginTop: 0 }}
              value={p.value}
              onChangeText={(t) =>
                setPhones((list) => list.map((x) => (x.id === p.id ? { ...x, value: t } : x)))
              }
              placeholder="+91 98xxx xxxxx"
              keyboardType="phone-pad"
            />
            {phones.length > 1 ? (
              <Pressable onPress={() => setPhones((list) => list.filter((x) => x.id !== p.id))}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          style={styles.addBtn}
          onPress={() => setPhones((list) => [...list, { id: String(Date.now()), value: "" }])}
        >
          <Text style={styles.addText}>Add another phone</Text>
        </Pressable>

        <View style={styles.rowBetween}>
          <Label>Email addresses</Label>
          <Text style={styles.added}>{emails.filter((e) => e.value.trim()).length} added</Text>
        </View>
        {emails.map((e) => (
          <View key={e.id} style={styles.contactRow}>
            <Ionicons name="mail-outline" size={18} color={colors.muted} />
            <Field
              style={{ flex: 1, marginTop: 0 }}
              value={e.value}
              onChangeText={(t) =>
                setEmails((list) => list.map((x) => (x.id === e.id ? { ...x, value: t } : x)))
              }
              placeholder="you@business.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emails.length > 1 ? (
              <Pressable onPress={() => setEmails((list) => list.filter((x) => x.id !== e.id))}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          style={styles.addBtn}
          onPress={() => setEmails((list) => [...list, { id: String(Date.now()), value: "" }])}
        >
          <Text style={styles.addText}>Add another email</Text>
        </Pressable>

        <ErrorText>{error}</ErrorText>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Save & continue"
          onPress={() => save(false)}
          loading={loading}
          disabled={!canSave}
          height={56}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  step: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  h1: { fontSize: 24, fontFamily: font.bold, color: colors.ink, letterSpacing: -0.4 },
  skip: { fontSize: 15, fontFamily: font.bold, color: colors.accent, marginTop: 18 },
  scroll: { paddingHorizontal: 24, paddingBottom: 24 },
  mediaBlock: { marginBottom: 54 },
  banner: {
    height: 140,
    borderRadius: 20,
    backgroundColor: colors.rail,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.dash,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  slotText: { fontFamily: font.semibold, color: colors.muted },
  avatarWrap: { position: "absolute", left: 16, bottom: -46, width: 92 },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { fontFamily: font.semibold, color: colors.muted, fontSize: 13 },
  cam: {
    position: "absolute",
    right: 0,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  added: { fontSize: 12, fontFamily: font.semibold, color: colors.muted, marginBottom: 6 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  addBtn: {
    marginTop: 10,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.dash,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontFamily: font.bold, color: colors.ink, fontSize: 14 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
