import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { colors, font, radius, space } from "../theme";

export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

/** Alias used by several screens */
export function Subtitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Body style={style}>{children}</Body>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Field(props: TextInputProps & { well?: boolean; focused?: boolean }) {
  const { well, focused, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.placeholder}
      {...rest}
      style={[
        styles.input,
        well && styles.inputWell,
        focused && { borderColor: colors.accent },
        style,
      ]}
    />
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  height = 56,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger" | "accent" | "outline";
  height?: number;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: height, borderRadius: height >= 56 ? 18 : 16 },
        variant === "ghost" && styles.btnGhost,
        variant === "outline" && styles.btnOutline,
        variant === "danger" && styles.btnDanger,
        variant === "accent" && styles.btnAccent,
        pressed && !isDisabled && { opacity: 0.88 },
        isDisabled && { opacity: 0.32 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" || variant === "outline" ? colors.ink : colors.bg} />
      ) : (
        <Text
          style={[
            styles.btnText,
            (variant === "ghost" || variant === "outline") && { color: colors.ink },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  tone = "accent",
}: {
  label: string;
  tone?: "accent" | "feature" | "muted" | "surface";
}) {
  const bg =
    tone === "feature"
      ? colors.feature
      : tone === "muted"
        ? colors.rail
        : tone === "surface"
          ? "rgba(255,255,255,0.82)"
          : colors.accentSoft;
  const fg =
    tone === "feature"
      ? colors.featureInk
      : tone === "muted"
        ? colors.muted
        : tone === "surface"
          ? colors.ink
          : colors.accent;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function IconButton({
  onPress,
  children,
  size = 46,
}: {
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.iconBtn, { width: size, height: size, borderRadius: size > 44 ? 15 : 14 }]}
    >
      {children}
    </Pressable>
  );
}

export function ScreenPad({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: font.bold,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.medium,
    color: colors.muted,
  },
  label: {
    marginTop: space.md,
    marginBottom: 6,
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: font.medium,
    color: colors.ink,
    minHeight: 52,
  },
  inputWell: { backgroundColor: colors.well },
  error: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 14,
    fontFamily: font.medium,
  },
  btn: {
    marginTop: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnAccent: { backgroundColor: colors.accent },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: font.bold,
  },
  empty: { paddingVertical: 70, alignItems: "center" },
  emptyText: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  emptySub: { marginTop: 6, fontFamily: font.medium, fontSize: 14, color: colors.muted },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  chipText: { fontSize: 12, fontFamily: font.bold },
  iconBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
