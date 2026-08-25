/* finesse | modern-natural-palette | emerald-forest | 16px-radius | elegant-soft-shadow */
import { Platform, StyleSheet } from "react-native";

export const colors = {
  canvas: "#F6F8F5",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF4ED",
  surfaceElevated: "#FFFFFF",
  ink: "#121C18",
  inkLight: "#2D3E36",
  muted: "#6A7B73",
  line: "#E2E8E0",
  primary: "#185340",
  primaryHover: "#124233",
  primarySoft: "#E0EFE8",
  expense: "#D84A38",
  expenseSoft: "#FDEEEB",
  income: "#188255",
  incomeSoft: "#E3F5EC",
  amber: "#C67915",
  amberSoft: "#FDF2E0",
  white: "#FFFFFF",
};

export const shadows = Platform.select({
  ios: {
    shadowColor: "#143024",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: { boxShadow: "0 6px 20px -3px rgba(18, 48, 34, 0.06), 0 2px 6px -1px rgba(18, 48, 34, 0.03)" },
});

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 16, paddingBottom: 132 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows,
  },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.2 },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink },
  muted: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
