import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, ErrorText } from "../../src/components/ui";
import { colors, font } from "../../src/theme";
import { digitsOnly } from "../../src/utils/money";

const KEYS: { label: string; sub?: string }[] = [
  { label: "1" },
  { label: "2", sub: "ABC" },
  { label: "3", sub: "DEF" },
  { label: "4", sub: "GHI" },
  { label: "5", sub: "JKL" },
  { label: "6", sub: "MNO" },
  { label: "7", sub: "PQRS" },
  { label: "8", sub: "TUV" },
  { label: "9", sub: "WXYZ" },
  { label: "" },
  { label: "0" },
  { label: "⌫" },
];

function formatIn(d: string) {
  return d.replace(/(\d{5})(\d)/, "$1 $2");
}

export default function PhoneScreen() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = digitsOnly(phone).slice(0, 10);
  const canContinue = digits.length >= 10;
  const display = digits ? formatIn(digits) : "";

  function onKey(label: string) {
    if (label === "⌫") {
      setPhone((p) => p.slice(0, -1));
      return;
    }
    if (!label || digits.length >= 10) return;
    setPhone((p) => p + label);
  }

  async function onContinue() {
    setError(null);
    setLoading(true);
    try {
      const data = await api<{
        phone: string;
        resendAfterSeconds: number;
        demoOtp?: string;
        hint?: string;
      }>("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: data.phone,
          resendAfterSeconds: String(data.resendAfterSeconds),
          demoOtp: data.demoOtp ?? "",
          hint: data.hint ?? "",
        },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.glyph}>
          <Ionicons name="phone-portrait-outline" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.h1}>
          Enter your{"\n"}phone number
        </Text>
        <Text style={styles.sub}>
          We'll text you a code to verify it's really you. Standard rates may apply.
        </Text>

        <View style={styles.row}>
          <View style={styles.dial}>
            <Text style={styles.flag}>🇮🇳</Text>
            <Text style={styles.dialText}>+91</Text>
          </View>
          <View style={[styles.phoneBox, digits.length > 0 && styles.phoneActive]}>
            <Text style={[styles.phoneText, !digits && { color: colors.placeholder }]}>
              {display || "98xxx xxxxx"}
            </Text>
            {digits.length > 0 && digits.length < 10 ? <View style={styles.caret} /> : null}
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <ErrorText>{error}</ErrorText>

        <Text style={styles.terms}>
          By continuing you agree to our <Text style={styles.termsBold}>Terms</Text> &{" "}
          <Text style={styles.termsBold}>Privacy Policy</Text>.
        </Text>

        <Button
          title="Continue"
          onPress={onContinue}
          loading={loading}
          disabled={!canContinue || demoLoading}
          height={58}
        />
        <View style={{ height: 10 }} />
        <Button
          title={demoLoading ? "Signing in…" : "Demo: Rajat & Company"}
          onPress={async () => {
            setError(null);
            setDemoLoading(true);
            try {
              const data = await api<{ token: string }>("/api/auth/dev-login", {
                method: "POST",
                body: JSON.stringify({ phone: "9810817196" }),
              });
              await setSession(data.token);
              router.replace("/(tabs)");
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Demo login failed — is the API running?");
            } finally {
              setDemoLoading(false);
            }
          }}
          loading={demoLoading}
          disabled={loading}
          variant="outline"
          height={52}
        />
      </View>

      <View style={styles.keypad}>
        {KEYS.map((k, i) => (
          <Pressable
            key={`${k.label}-${i}`}
            style={styles.key}
            onPress={() => onKey(k.label)}
            disabled={!k.label}
          >
            <Text style={styles.keyLabel}>{k.label}</Text>
            {k.sub ? <Text style={styles.keySub}>{k.sub}</Text> : null}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: 26, paddingTop: 24 },
  glyph: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  h1: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: font.bold,
    color: colors.ink,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.medium,
    color: colors.muted,
    maxWidth: 280,
    marginBottom: 30,
  },
  row: { flexDirection: "row", gap: 10 },
  dial: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    height: 60,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  flag: { fontSize: 20 },
  dialText: { fontSize: 17, fontFamily: font.semibold, color: colors.ink },
  phoneBox: {
    flex: 1,
    height: 60,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  phoneActive: { borderColor: colors.accent },
  phoneText: {
    fontSize: 20,
    fontFamily: font.semibold,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  caret: {
    width: 2,
    height: 24,
    backgroundColor: colors.accent,
    marginLeft: 2,
  },
  terms: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 14,
    fontFamily: font.medium,
  },
  termsBold: { color: colors.ink, fontFamily: font.semibold },
  keypad: {
    backgroundColor: colors.padBg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  key: {
    width: "31.5%",
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  keyLabel: { fontSize: 25, fontFamily: font.medium, color: colors.ink },
  keySub: {
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 1.5,
    color: colors.muted,
    marginTop: 2,
  },
});
