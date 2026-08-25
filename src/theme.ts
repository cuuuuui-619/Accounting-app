/* finesse | register=h5 | morph=A-app-shell | palette=warm-neutral+forest+coral | type=system-800-400 | material=quiet-paper | SOUL=6 SPECTACLE=3 DENSITY=7 */
import { Platform, StyleSheet } from "react-native";

export const colors = {
  canvas: "#F4F4EF",
  surface: "#FCFCF8",
  surfaceMuted: "#E9EEE5",
  ink: "#18201D",
  muted: "#68716C",
  line: "#D9DED7",
  primary: "#245746",
  primarySoft: "#DCE9DF",
  expense: "#C55447",
  expenseSoft: "#F5E2DE",
  income: "#21744A",
  amber: "#B67523",
  amberSoft: "#F4E8D1",
  white: "#FEFEFB",
};

export const shadows = Platform.select({
  ios: {
    shadowColor: "#183026",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 3 },
  default: { boxShadow: "0 8px 24px rgba(24, 48, 38, 0.08)" },
});

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 16, paddingBottom: 132 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadows,
  },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.ink },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.ink },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink },
  muted: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
