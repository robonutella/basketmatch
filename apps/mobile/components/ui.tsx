import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const colors = {
  ink: "#173126",
  muted: "#66746d",
  paper: "#f4f1e8",
  card: "#fffdf7",
  line: "#dcd8cc",
  brand: "#12372a",
  brand2: "#205c46",
  accent: "#e8b44f",
  danger: "#9d3f35",
  white: "#ffffff",
} as const;

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children, light = false }: PropsWithChildren<{ light?: boolean }>) {
  return <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>{children}</Text>;
}

export function SectionTitle({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionCopy}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Text style={styles.heading}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.muted}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={colors.white}
        trackColor={{ false: "#c7cbc7", true: colors.brand2 }}
        value={value}
      />
    </View>
  );
}

export function PillButton({
  children,
  onPress,
  selected = false,
  accessibilityLabel,
}: PropsWithChildren<{
  onPress: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
}>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillButton,
        selected && styles.pillButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.pillButtonText, selected && styles.pillButtonTextSelected]}>
        {children}
      </Text>
    </Pressable>
  );
}

export const uiStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 14,
  },
  heading: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: "rgba(23,49,38,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrow: {
    color: colors.brand2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  eyebrowLight: {
    color: colors.accent,
  },
  sectionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionCopy: {
    flex: 1,
  },
  heading: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  toggleRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  toggleCopy: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  pillButton: {
    backgroundColor: "transparent",
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  pillButtonSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  pillButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  pillButtonTextSelected: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.72,
  },
});
