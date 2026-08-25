import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  CircleDollarSign,
  ListFilter,
  Mic,
  Plus,
  ReceiptText,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react-native";

import { colors, common, shadows } from "./theme";

export function AppHeader({ title = "苔账", subtitle, back, onBack, action }: { title?: string; subtitle?: string; back?: boolean; onBack?: () => void; action?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable accessibilityLabel="返回" hitSlop={10} onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.brandMark}><WalletCards size={20} color={colors.white} /></View>
      )}
      <View style={styles.headerText}>
        <Text style={back ? common.h2 : common.h1}>{title}</Text>
        {subtitle ? <Text style={common.muted}>{subtitle}</Text> : null}
      </View>
      {action ?? <View style={styles.iconButton} />}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[common.card, styles.cardPadding, style]}>{children}</View>;
}

export function PrimaryButton({ label, icon: Icon = Plus, onPress, disabled }: { label: string; icon?: LucideIcon; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, disabled && styles.disabled]}>
      <Icon size={17} color={colors.white} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} />
    </View>
  );
}

export function MoneySummary({ expense, income, balance }: { expense: number; income: number; balance: number }) {
  const values = [
    ["本期支出", expense, colors.expense],
    ["本期收入", income, colors.income],
    ["净结余", balance, balance >= 0 ? colors.primary : colors.expense],
  ] as const;
  return (
    <View style={[common.card, styles.moneySummary]}>
      {values.map(([label, value, color], index) => (
        <View key={label} style={[styles.moneyCell, index > 0 && styles.moneyDivider]}>
          <Text style={common.muted}>{label}</Text>
          <Text style={[styles.moneyValue, { color }]}>{value < 0 ? "-" : ""}¥{Math.abs(value).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</Text>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "amber" | "expense" }) {
  const barColor = tone === "amber" ? colors.amber : tone === "expense" ? colors.expense : colors.primary;
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: barColor }]} /></View>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <CircleDollarSign size={30} color={colors.primary} />
      <Text style={common.h3}>{title}</Text>
      <Text style={[common.muted, styles.centerText]}>{detail}</Text>
    </View>
  );
}

export type MainTab = "details" | "overview" | "add" | "assistant" | "profile";

const tabs: { id: MainTab; label: string; icon: LucideIcon }[] = [
  { id: "details", label: "明细", icon: ListFilter },
  { id: "overview", label: "概览", icon: BarChart3 },
  { id: "add", label: "记账", icon: Plus },
  { id: "assistant", label: "AI", icon: Bot },
  { id: "profile", label: "我的", icon: UserRound },
];

export function BottomNav({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  return (
    <View style={styles.navWrap}>
      {tabs.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(id)} style={({ pressed }) => [styles.navItem, selected && styles.navActive, pressed && styles.pressed]}>
            <Icon size={19} color={selected ? colors.primary : colors.muted} strokeWidth={selected ? 2.4 : 1.8} />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FloatingMic({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={listening ? "停止语音记账" : "开始语音记账"} onPress={onPress} style={({ pressed }) => [styles.mic, listening && styles.micListening, pressed && styles.buttonPressed]}>
      {listening ? <View style={styles.stopSquare} /> : <Mic size={23} color={colors.white} />}
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <View style={styles.sectionTitle}><Text style={common.h2}>{children}</Text>{right}</View>;
}

export function TransactionIcon({ kind }: { kind: "expense" | "income" }) {
  return <View style={[styles.transactionIcon, { backgroundColor: kind === "income" ? colors.primarySoft : colors.expenseSoft }]}><ReceiptText size={18} color={kind === "income" ? colors.income : colors.expense} /></View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 74, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  headerText: { flex: 1 },
  brandMark: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  cardPadding: { padding: 16 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  secondaryButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  buttonPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  chip: { minHeight: 36, paddingHorizontal: 13, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: colors.white },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 48, borderRadius: 8, backgroundColor: colors.surfaceMuted, paddingHorizontal: 14, fontSize: 15, color: colors.ink, borderWidth: 1, borderColor: "transparent" },
  multiline: { minHeight: 100, paddingTop: 13, textAlignVertical: "top" },
  moneySummary: { flexDirection: "row", overflow: "hidden", marginTop: 12 },
  moneyCell: { flex: 1, alignItems: "center", paddingVertical: 13, gap: 5 },
  moneyDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  moneyValue: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  progressTrack: { height: 7, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 28 },
  centerText: { textAlign: "center" },
  navWrap: { position: "absolute", left: 12, right: 12, bottom: 10, height: 72, borderRadius: 8, backgroundColor: "rgba(252,252,248,0.98)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, ...shadows },
  navItem: { flex: 1, height: 54, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 3 },
  navActive: { backgroundColor: colors.primarySoft },
  navLabel: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  navLabelActive: { color: colors.primary, fontWeight: "800" },
  mic: { position: "absolute", right: 20, bottom: 94, width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows },
  micListening: { backgroundColor: colors.expense },
  stopSquare: { width: 15, height: 15, borderRadius: 3, backgroundColor: colors.white },
  sectionTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 10 },
  transactionIcon: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
