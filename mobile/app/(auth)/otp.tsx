import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, ErrorText } from "../../src/components/ui";
import { colors, font } from "../../src/theme";
import { digitsOnly } from "../../src/utils/money";

export default function OtpScreen() {
  const router = useRouter();
  const { setSession } = useAuth();
  const params = useLocalSearchParams<{
    phone: string;
    resendAfterSeconds?: string;
    demoOtp?: string;
    hint?: string;
  }>();
  const phone = params.phone ?? "";
  const demoOtp = params.demoOtp || "000000";
  const showDemoHint = Boolean(params.demoOtp || params.hint);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(Number(params.resendAfterSeconds ?? 30));
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0 || success) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, success]);

  async function verify(nextCode: string) {
    if (nextCode.length !== 6 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ token: string; isNewUser: boolean }>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code: nextCode }),
      });
      const me = await setSession(data.token);
      setSuccess(true);
      // brief success state like prototype, then route
      setTimeout(() => {
        if (data.isNewUser || (me && !me.onboarded)) {
          router.replace("/(onboarding)/shop-setup");
        } else {
          router.replace("/(tabs)");
        }
      }, 900);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify");
      setLoading(false);
    }
  }

  async function resend() {
    if (seconds > 0) return;
    setError(null);
    try {
      const data = await api<{ resendAfterSeconds: number }>("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setSeconds(data.resendAfterSeconds);
      setCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not resend");
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.success}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={styles.successTitle}>You're verified</Text>
          <Text style={styles.successSub}>{phone} is now confirmed. Welcome aboard.</Text>
          <Button
            title="Get started"
            height={58}
            onPress={() => router.replace("/(onboarding)/shop-setup")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const boxes = Array.from({ length: 6 }, (_, i) => code[i] ?? "");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.wrap}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.h1}>
          Verification{"\n"}code
        </Text>
        <Text style={styles.sub}>
          Enter the 6-digit code sent to{"\n"}
          <Text style={styles.phoneBold}>{phone}</Text>
        </Text>
        {showDemoHint ? (
          <Text style={styles.demoHint}>
            Demo mode — use OTP <Text style={styles.phoneBold}>{demoOtp}</Text>
          </Text>
        ) : null}

        <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
          {boxes.map((d, i) => (
            <View key={i} style={[styles.box, code.length === i && styles.boxActive]}>
              <Text style={styles.digit}>{d}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => {
            const d = digitsOnly(t).slice(0, 6);
            setCode(d);
            if (d.length === 6) void verify(d);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={styles.hidden}
        />

        <View style={styles.resendRow}>
          <Text style={styles.didnt}>Didn't get it?</Text>
          <Pressable onPress={resend} disabled={seconds > 0}>
            <Text style={[styles.resend, seconds <= 0 && { color: colors.accent }]}>
              {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
            </Text>
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>
        <Button
          title={loading ? "Enter 6-digit code" : "Verify"}
          onPress={() => verify(code)}
          loading={loading}
          disabled={code.length !== 6}
          height={58}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, paddingHorizontal: 26, paddingTop: 12 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
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
    marginBottom: 34,
  },
  phoneBold: { color: colors.ink, fontFamily: font.semibold },
  demoHint: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  boxes: { flexDirection: "row", gap: 9, marginBottom: 26 },
  box: {
    flex: 1,
    height: 60,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  digit: { fontSize: 24, fontFamily: font.bold, color: colors.ink },
  hidden: { position: "absolute", opacity: 0, height: 0, width: 0 },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: "auto" as unknown as number,
  },
  didnt: { fontSize: 14, color: colors.muted, fontFamily: font.medium },
  resend: { fontSize: 14, fontFamily: font.bold, color: colors.muted },
  success: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  check: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: font.bold,
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  successSub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 250,
    fontFamily: font.medium,
    marginBottom: 8,
  },
});
