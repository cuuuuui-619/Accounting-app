import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight, Save, Search, Sparkles, SquarePen, Trash2, Undo2 } from "lucide-react-native";

import { Card, Chip, EmptyState, Field, MoneySummary, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle, TransactionIcon } from "../components";
import { categorySpend, formatMoney, isValidDate, monthTransactions, parseNaturalLanguage, periodTransactions, totals } from "../domain";
import { useLedger } from "../store";
import { colors, common } from "../theme";
import type { ParsedAction, Transaction, TransactionAccount, TransactionKind } from "../types";

const transactionCategories: Record<TransactionKind, string[]> = {
  expense: ["餐饮美食", "交通出行", "购物消费", "休闲娱乐", "居家缴费", "医疗健康", "教育学习", "人情往来", "其它"],
  income: ["工资收入", "兼职收入", "投资理财", "报销退款", "人情往来", "其它收入"],
};

const accounts: TransactionAccount[] = ["微信", "支付宝", "银行卡", "现金", "其他"];

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function shiftMonth(value: string, offset: number) {
  const [year = 2026, month = 1] = value.split("-").map(Number);
  return formatMonth(new Date(year, month - 1 + offset, 1));
}

function Calendar({ month, activeDays, selectedDay, onShift, onSelectDay }: { month: string; activeDays: Set<number>; selectedDay: number | null; onShift: (offset: number) => void; onSelectDay: (day: number | null) => void }) {
  const [year = 2026, monthNumber = 1] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const days = new Date(year, monthNumber, 0).getDate();
  const slots = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  return (
    <Card>
      <View style={styles.calendarHeader}>
        <View style={styles.inline}><CalendarDays size={17} color={colors.primary} /><Text style={common.h3}>记账日历</Text></View>
        <View style={styles.inline}>
          <Pressable accessibilityLabel="上个月" accessibilityRole="button" onPress={() => onShift(-1)} style={styles.roundButton}><ChevronLeft size={17} color={colors.ink} /></Pressable>
          <Text style={styles.monthLabel}>{month}</Text>
          <Pressable accessibilityLabel="下个月" accessibilityRole="button" onPress={() => onShift(1)} style={styles.roundButton}><ChevronRight size={17} color={colors.ink} /></Pressable>
        </View>
      </View>
      <View style={styles.weekRow}>{["日", "一", "二", "三", "四", "五", "六"].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
      <View style={styles.calendarGrid}>
        {slots.map((day, index) => (
          <Pressable accessibilityLabel={day ? `${day}日` : undefined} accessibilityRole="button" disabled={!day} onPress={() => day && onSelectDay(selectedDay === day ? null : day)} key={`${day}-${index}`} style={({ pressed }) => [styles.day, Boolean(day && activeDays.has(day)) && styles.dayActive, selectedDay === day && styles.daySelected, pressed && styles.dayPressed]}>
            <Text style={[styles.dayText, Boolean(day && activeDays.has(day)) && styles.dayTextActive]}>{day ?? ""}</Text>
            {day && activeDays.has(day) ? <View style={styles.dayDot} /> : null}
          </Pressable>
        ))}
      </View>
      <Text style={[common.muted, { marginTop: 9 }]}>有圆点的日期已有记录，点按日期可筛选当天账目。</Text>
    </Card>
  );
}

export function DetailsScreen() {
  const { state, updateTransaction, deleteTransaction, restoreDeletedTransaction } = useLedger();
  const [month, setMonth] = useState(formatMonth(new Date()));
  const [kind, setKind] = useState<"all" | TransactionKind>("all");
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editKind, setEditKind] = useState<TransactionKind>("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAccount, setEditAccount] = useState<TransactionAccount | undefined>(undefined);
  const [editNote, setEditNote] = useState("");
  const monthly = useMemo(() => monthTransactions(state.transactions, month), [state.transactions, month]);
  const filtered = useMemo(() => monthly.filter((item) => (kind === "all" || item.kind === kind) && (selectedDay === null || Number(item.date.slice(8, 10)) === selectedDay) && `${item.title}${item.category}${item.note ?? ""}`.includes(query.trim())), [monthly, kind, query, selectedDay]);
  const summary = useMemo(() => totals(monthly), [monthly]);
  const activeDays = useMemo(() => new Set(monthly.map((item) => Number(item.date.slice(8, 10)))), [monthly]);
  const editAmountValue = Number(editAmount.replace(",", "."));
  const canSaveEdit = Boolean(editingTransaction && editAmountValue > 0 && editTitle.trim() && editCategory.trim() && isValidDate(editDate));

  const beginEdit = (item: Transaction) => {
    setEditingTransaction(item);
    setEditKind(item.kind);
    setEditAmount(String(item.amount));
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditDate(item.date);
    setEditAccount(item.account);
    setEditNote(item.note ?? "");
  };

  const cancelEdit = () => {
    setEditingTransaction(null);
  };

  const saveEdit = () => {
    if (!editingTransaction || !canSaveEdit) return;
    updateTransaction(editingTransaction.id, {
      kind: editKind,
      amount: editAmountValue,
      title: editTitle.trim(),
      category: editCategory.trim(),
      date: editDate,
      account: editAccount,
      note: editNote.trim() || undefined,
    });
    setEditingTransaction(null);
  };

  const requestDelete = (item: Transaction) => {
    const commit = () => {
      deleteTransaction(item.id);
      setRecentlyDeleted(item);
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm(`删除“${item.title}”这笔记录？`)) commit();
      return;
    }
    Alert.alert("删除这笔记录？", `“${item.title}” ${formatMoney(item.amount)}`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: commit },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
      <View style={styles.searchBox}><Search size={17} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="搜索账目、分类或备注" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
      <Calendar month={month} activeDays={activeDays} selectedDay={selectedDay} onSelectDay={setSelectedDay} onShift={(offset) => { setSelectedDay(null); setMonth((value) => shiftMonth(value, offset)); }} />
      <MoneySummary {...summary} />
      <View style={styles.chips}><Chip label="全部" active={kind === "all"} onPress={() => setKind("all")} /><Chip label="支出" active={kind === "expense"} onPress={() => setKind("expense")} /><Chip label="收入" active={kind === "income"} onPress={() => setKind("income")} /></View>
      {selectedDay !== null ? <View style={styles.chips}><Chip label={`已筛选 ${selectedDay} 日，点按清除`} active onPress={() => setSelectedDay(null)} /></View> : null}
      <SectionTitle right={<Text style={common.muted}>{filtered.length} 笔记录</Text>}>账目明细</SectionTitle>
      {recentlyDeleted ? <View style={styles.undoBanner}><Text style={[common.body, styles.flex]}>已删除“{recentlyDeleted.title}”</Text><Pressable accessibilityLabel="撤销删除" accessibilityRole="button" onPress={() => { restoreDeletedTransaction(recentlyDeleted); setRecentlyDeleted(null); }} style={({ pressed }) => [styles.undoButton, pressed && styles.dayPressed]}><Undo2 size={17} color={colors.primary} /><Text style={styles.undoText}>撤销</Text></Pressable></View> : null}
      {filtered.length ? filtered.map((item) => (
        <Card key={item.id} style={styles.transactionCard}>
          <TransactionIcon kind={item.kind} />
          <View style={styles.flex}>
            <Text numberOfLines={1} style={common.h3}>{item.title}</Text>
            <Text numberOfLines={1} style={common.muted}>{item.category} · {item.date} · {item.account ?? "未设置账户"}</Text>
            {item.note ? <Text numberOfLines={1} style={styles.noteSummary}>{item.note}</Text> : null}
          </View>
          <View style={styles.amountColumn}><Text style={[styles.amount, { color: item.kind === "income" ? colors.income : colors.ink }]}>{item.kind === "income" ? "+" : "-"}{formatMoney(item.amount)}</Text><Text style={common.muted}>{item.channel ?? "手动记账"}</Text></View>
          <View style={styles.transactionActions}>
            <Pressable accessibilityLabel={`编辑${item.title}`} accessibilityRole="button" hitSlop={4} onPress={() => beginEdit(item)} style={({ pressed }) => [styles.editButton, pressed && styles.dayPressed]}><SquarePen size={17} color={colors.primary} /></Pressable>
            <Pressable accessibilityLabel={`删除${item.title}`} accessibilityRole="button" hitSlop={4} onPress={() => requestDelete(item)} style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}><Trash2 size={17} color={colors.expense} /></Pressable>
          </View>
        </Card>
      )) : <Card><EmptyState title="这个月还没有匹配记录" detail="点按记账或麦克风，第一笔记录会立即出现在这里。" /></Card>}
      <Modal visible={Boolean(editingTransaction)} transparent animationType="slide" onRequestClose={cancelEdit}>
        <KeyboardAvoidingView style={styles.editBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.editSheet}>
            <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
              <Text style={common.h2}>修改记账</Text>
              <View style={[styles.segment, styles.editSegment]}><Chip label="支出" active={editKind === "expense"} onPress={() => setEditKind("expense")} /><Chip label="收入" active={editKind === "income"} onPress={() => setEditKind("income")} /></View>
              <View style={styles.formGap}>
                <Field label="金额" value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder="0.00" />
                <Field label="名称 / 商户" value={editTitle} onChangeText={setEditTitle} placeholder="账目名称" />
                <Field label="分类" value={editCategory} onChangeText={setEditCategory} placeholder="账目分类" />
                <View style={styles.chips}>{transactionCategories[editKind].map((item) => <Chip key={item} label={item} active={editCategory === item} onPress={() => setEditCategory(item)} />)}</View>
                <Field label="日期" value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
                <Text style={styles.fieldLabel}>账户</Text>{/* label="账户" */}
                <View style={styles.chips}>{accounts.map((item) => <Chip key={item} label={item} active={editAccount === item} onPress={() => setEditAccount(editAccount === item ? undefined : item)} />)}</View>
                <Field label="备注" value={editNote} onChangeText={setEditNote} placeholder="可选" multiline />
                <View style={styles.editActions}><View style={styles.flex}><SecondaryButton label="取消" onPress={cancelEdit} /></View><View style={styles.flex}><PrimaryButton label="保存修改" icon={Save} onPress={saveEdit} disabled={!canSaveEdit} /></View></View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

export function OverviewScreen() {
  const { state } = useLedger();
  const [period, setPeriod] = useState<"month" | "term" | "year">("month");
  const month = useMemo(() => formatMonth(new Date()), []);
  const current = useMemo(() => periodTransactions(state.transactions, period), [state.transactions, period]);
  const summary = useMemo(() => totals(current), [current]);
  const budgetMultiplier = period === "month" ? 1 : period === "term" ? 6 : 12;
  const budgetTotal = useMemo(() => state.budgets.reduce((sum, item) => sum + item.amount, 0) * budgetMultiplier, [state.budgets, budgetMultiplier]);
  const ratio = budgetTotal ? (summary.expense / budgetTotal) * 100 : 0;
  const categoryData = useMemo(() => {
    const spendByCategory = new Map<string, number>();
    for (const item of current) {
      if (item.kind === "expense") {
        spendByCategory.set(item.category, (spendByCategory.get(item.category) ?? 0) + item.amount);
      }
    }
    return state.budgets.map((budget) => ({
      ...budget,
      spent: Math.round((spendByCategory.get(budget.category) ?? 0) * 100) / 100,
    }));
  }, [state.budgets, current]);
  const max = useMemo(() => Math.max(1, ...categoryData.map((item) => item.spent)), [categoryData]);

  return (
    <ScrollView contentContainerStyle={common.content}>
      <View style={styles.segment}>{(["month", "term", "year"] as const).map((value) => <Chip key={value} label={{ month: "月度", term: "学期", year: "年度" }[value]} active={period === value} onPress={() => setPeriod(value)} />)}</View>
      <Card>
        <Text style={common.h2}>{period === "month" ? `${month} 月度财务概览` : period === "term" ? "本学期财务概览" : `${new Date().getFullYear()} 年度财务概览`}</Text>
        <Text style={[common.muted, { marginTop: 4 }]}>收入、支出、预算与结余集中在一个页面。</Text>
      </Card>
      <Card style={styles.blockGap}>
        <SectionTitle><>{period === "month" ? "月度" : period === "term" ? "学期" : "年度"}总预算消耗进度</></SectionTitle>
        <Text style={styles.heroMoney}>{formatMoney(summary.expense)} <Text style={common.muted}>/ {formatMoney(budgetTotal)}</Text></Text>
        <ProgressBar value={ratio} tone={ratio > 90 ? "expense" : ratio > 70 ? "amber" : "primary"} />
        <View style={styles.between}><Text style={common.muted}>已使用 {Math.round(ratio)}%</Text><Text style={common.muted}>剩余 {formatMoney(Math.max(0, budgetTotal - summary.expense))}</Text></View>
      </Card>
      <MoneySummary {...summary} />
      <Card style={styles.blockGap}>
        <Text style={common.h2}>{period === "month" ? "本月" : period === "term" ? "本学期" : "本年"}消费总结</Text>
        <Text style={[common.body, { marginTop: 10 }]}>本期共有 {current.length} 笔记录，支出 {formatMoney(summary.expense)}，收入 {formatMoney(summary.income)}。{ratio < 70 ? "预算节奏稳定，可以继续保持。" : "预算使用较快，建议优先检查高支出分类。"}</Text>
      </Card>
      <SectionTitle>各分类支出</SectionTitle>
      <Card>
        {categoryData.map((item) => (
          <View key={item.category} style={styles.chartRow}>
            <View style={styles.between}><Text style={common.body}>{item.category}</Text><Text style={styles.chartValue}>{formatMoney(item.spent)}</Text></View>
            <View style={styles.chartTrack}><View style={[styles.chartBar, { width: `${item.spent / max * 100}%` }]} /></View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

export function AddRecordScreen({ onSaved }: { onSaved: () => void }) {
  const { addTransaction } = useLedger();
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(transactionCategories.expense[0] ?? "餐饮美食");
  const [date, setDate] = useState(localDateValue());
  const [account, setAccount] = useState<TransactionAccount | undefined>(undefined);
  const [note, setNote] = useState("");

  const amountValue = Number(amount.replace(",", "."));
  const canSave = Boolean(amountValue > 0 && title.trim() && category.trim() && isValidDate(date));

  const handleKindChange = (nextKind: TransactionKind) => {
    setKind(nextKind);
    setCategory(transactionCategories[nextKind][0] ?? (nextKind === "expense" ? "餐饮美食" : "工资收入"));
  };

  const save = () => {
    if (!canSave) return;
    addTransaction({ kind, amount: amountValue, title: title.trim(), category, date, account, note: note.trim() || undefined, channel: "手动记账" });
    setAmount("");
    setTitle("");
    setNote("");
    onSaved();
  };

  return (
    <ScrollView contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={common.h2}>记一笔</Text>
        <Text style={[common.muted, { marginTop: 4 }]}>金额和名称是必填项，其余使用常用默认值。</Text>
        <View style={[styles.segment, { marginTop: 16 }]}>
          <Chip label="支出" active={kind === "expense"} onPress={() => handleKindChange("expense")} />
          <Chip label="收入" active={kind === "income"} onPress={() => handleKindChange("income")} />
        </View>
        <View style={styles.formGap}>
          <Field label="金额" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Field label="名称 / 商户" value={title} onChangeText={setTitle} placeholder="例如：午餐、工资" returnKeyType="done" />
          <Text style={styles.fieldLabel}>分类</Text>
          <View style={styles.chips}>
            {transactionCategories[kind].map((item) => (
              <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />
            ))}
          </View>
          <Field label="交易日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          <Text style={styles.fieldLabel}>账户</Text>
          <View style={styles.chips}>
            {accounts.map((item) => (
              <Chip key={item} label={item} active={account === item} onPress={() => setAccount(account === item ? undefined : item)} />
            ))}
          </View>
          <Field label="备注" value={note} onChangeText={setNote} placeholder="可选" multiline />
          <PrimaryButton label="保存这笔记录" onPress={save} disabled={!canSave} />
        </View>
      </Card>
    </ScrollView>
  );
}

function actionLabel(action: ParsedAction) {
  if (action.type === "transaction") {
    const account = action.value.account ? ` · 账户：${action.value.account}` : "";
    const note = action.value.note ? ` · 备注：${action.value.note}` : "";
    return `${action.value.kind === "income" ? "收入 (+)" : "支出 (-)"} · ${action.value.title} · ${action.value.category} · ${formatMoney(action.value.amount)} · ${action.value.date}${account}${note}`;
  }
  if (action.type === "loan") return `借贷 · ${action.value.direction === "borrowed" ? "借入 (+)" : "借出 (-)"} · ${action.value.person} · ${formatMoney(action.value.amount)} · ${action.value.date}`;
  return `预算 · ${action.value.category} · ${formatMoney(action.value.amount)}`;
}

export function AssistantScreen({ draft, setDraft, listening, onListen, speechMessage }: { draft: string; setDraft: (value: string) => void; listening: boolean; onListen: () => void; speechMessage?: string }) {
  const { applyActions, syncCode } = useLedger();
  const [saved, setSaved] = useState(false);
  const actions = useMemo(() => parseNaturalLanguage(draft), [draft]);
  const apply = () => { applyActions(actions); setSaved(true); setDraft(""); };
  return (
    <ScrollView contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={styles.assistantTitle}><View style={styles.spark}><Sparkles size={20} color={colors.primary} /></View><View style={styles.flex}><Text style={common.h2}>自然语言记账</Text><Text style={common.muted}>一句话可以同时识别多笔收支、借贷和分类预算。</Text></View></View>
        <View style={styles.formGap}>
          <Field label="说出来，或直接输入" multiline value={draft} onChangeText={(value) => { setSaved(false); setDraft(value); }} placeholder="例如：午饭38元，然后老王向我借了500元，这个月工资到账6000元" />
          <PrimaryButton label={listening ? "停止识别" : "开始语音识别"} onPress={onListen} />
          {speechMessage ? <Text style={styles.speechMessage}>{speechMessage}</Text> : null}
        </View>
      </Card>
      {saved ? <View style={styles.success}><Text style={styles.successText}>已写入账本</Text></View> : null}
      <SectionTitle>识别预览</SectionTitle>
      <Card>
        {actions.length ? actions.map((action, index) => <View key={`${actionLabel(action)}-${index}`} style={styles.previewRow}><View style={styles.previewIndex}><Text style={styles.previewIndexText}>{index + 1}</Text></View><Text style={[common.body, styles.flex]}>{actionLabel(action)}</Text></View>) : <EmptyState title="等待一句话" detail="识别结果会先在这里预览，确认后才写入本地账本。" />}
        {actions.length ? <View style={{ marginTop: 14 }}><PrimaryButton label={`确认写入 ${actions.length} 条`} onPress={apply} /></View> : null}
      </Card>
      <Text style={[common.muted, styles.privacyNote]}>语音由当前浏览器或系统听写能力处理；{syncCode ? "确认后的账目会同步到私有云账本。" : "确认后的账目仅保存在当前设备。"}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: "row", alignItems: "center", gap: 7 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  searchBox: { minHeight: 46, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, marginBottom: 12, gap: 9 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, minHeight: 44 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  monthLabel: { minWidth: 62, textAlign: "center", fontSize: 13, fontWeight: "800", color: colors.ink },
  roundButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  weekRow: { flexDirection: "row" },
  weekText: { width: "14.2857%", textAlign: "center", color: colors.muted, fontSize: 11, paddingVertical: 5 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.2857%", height: 44, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  dayActive: { backgroundColor: colors.primarySoft },
  dayText: { color: colors.muted, fontSize: 12 },
  dayTextActive: { color: colors.primary, fontWeight: "800" },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, position: "absolute", bottom: 4 },
  daySelected: { borderWidth: 1, borderColor: colors.primary },
  dayPressed: { opacity: 0.65 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  transactionCard: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 9 },
  amountColumn: { alignItems: "flex-end", gap: 2 },
  amount: { fontSize: 14, fontWeight: "800" },
  transactionActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  editButton: { width: 40, height: 44, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  deleteButton: { width: 40, height: 44, borderRadius: 8, backgroundColor: colors.expenseSoft, alignItems: "center", justifyContent: "center" },
  deletePressed: { backgroundColor: "#EDCFC9", transform: [{ scale: 0.96 }] },
  undoBanner: { minHeight: 50, paddingHorizontal: 13, borderRadius: 8, backgroundColor: colors.amberSoft, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  undoButton: { minWidth: 76, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  undoText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  segment: { flexDirection: "row", gap: 8, marginBottom: 12 },
  blockGap: { marginTop: 12 },
  heroMoney: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: 12 },
  chartRow: { gap: 7, marginBottom: 14 },
  chartTrack: { height: 20, backgroundColor: colors.surfaceMuted, borderRadius: 5, overflow: "hidden" },
  chartBar: { height: "100%", backgroundColor: colors.primary, borderRadius: 5 },
  chartValue: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  formGap: { gap: 14, marginTop: 16 },
  editBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,34,30,0.38)" },
  editSheet: { width: "100%", maxWidth: 560, maxHeight: "92%", alignSelf: "center", borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: colors.surface },
  editContent: { padding: 18, paddingBottom: 28 },
  editSegment: { marginTop: 16, marginBottom: 0 },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  assistantTitle: { flexDirection: "row", gap: 12, alignItems: "center" },
  spark: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  previewRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  previewIndex: { width: 26, height: 26, borderRadius: 7, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  previewIndexText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  success: { alignSelf: "center", backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, marginTop: 12 },
  successText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  privacyNote: { textAlign: "center", marginTop: 14, paddingHorizontal: 18 },
  speechMessage: { color: colors.amber, fontSize: 12, lineHeight: 17, textAlign: "center" },
  noteSummary: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
