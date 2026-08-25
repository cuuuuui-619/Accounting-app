import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, ChevronRight, CircleHelp, Cloud, CloudOff, Copy, Eye, EyeOff, FolderKanban, HandCoins, KeyRound, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, Trash2, Undo2, WalletCards } from "lucide-react-native";

import { Card, EmptyState, Field, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle } from "../components";
import { formatMoney, totals } from "../domain";
import { useLedger } from "../store";
import { colors, common } from "../theme";
import type { Budget, Transaction } from "../types";

export type ProfileRoute = "profile" | "projects" | "loans" | "budgets";

const menu = [
  { id: "projects" as const, title: "项目账本", detail: "独立记录副业、旅行或长期目标", icon: FolderKanban },
  { id: "loans" as const, title: "借贷垫付", detail: "跟踪谁欠谁、已还与未还", icon: HandCoins },
  { id: "budgets" as const, title: "预算管理", detail: "按分类设置月度上限", icon: SlidersHorizontal },
];

export function ProfileScreen({ onNavigate }: { onNavigate: (route: ProfileRoute) => void }) {
  const {
    state, resetDemo, syncStatus, syncCode, syncError, pendingCount, lastSyncAt,
    createSyncLedger, joinSyncLedger, syncNow,
  } = useLedger();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [feedback, setFeedback] = useState("");
  const cloudEnabled = Boolean(syncCode);
  const statusLabel = syncStatus === "synced" ? "已同步" : syncStatus === "syncing" ? "同步中" : syncStatus === "connecting" ? "连接中" : syncStatus === "offline" ? "离线待同步" : syncStatus === "error" ? "同步异常" : "仅本机";
  const StatusIcon = syncStatus === "synced" ? CheckCircle2 : syncStatus === "offline" || syncStatus === "error" ? CloudOff : Cloud;

  const createCloudLedger = async () => {
    setBusy(true); setFeedback("");
    try {
      await createSyncLedger();
      setShowCode(true);
      setFeedback("云账本已创建，请妥善保管同步码。");
    } catch {
      setFeedback("创建失败，本机记录仍已保留。");
    } finally { setBusy(false); }
  };
  const joinCloudLedger = async () => {
    setBusy(true); setFeedback("");
    try {
      await joinSyncLedger(joinCode);
      setJoinCode(""); setShowCode(false);
      setFeedback("已连接云账本。");
    } catch {
      setFeedback("同步码无效或网络不可用，请检查后重试。");
    } finally { setBusy(false); }
  };
  const copySyncCode = async () => {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
      setFeedback("同步码已复制。");
    } catch {
      setShowCode(true);
      setFeedback("请长按同步码进行复制。");
    }
  };
  return (
    <ScrollView contentContainerStyle={common.content}>
      <Card style={styles.heroCard}>
        <View style={styles.heroIcon}><WalletCards size={24} color={colors.white} /></View>
        <View style={styles.flex}><Text style={common.h2}>{cloudEnabled ? "云端账本" : "本地账本"}</Text><Text style={common.muted}>{state.transactions.length} 笔记录 · {statusLabel}</Text></View>
        {cloudEnabled ? <StatusIcon size={22} color={syncStatus === "synced" ? colors.income : colors.amber} /> : <ShieldCheck size={22} color={colors.income} />}
      </Card>
      <SectionTitle>云同步</SectionTitle>
      <Card>
        {cloudEnabled && syncCode ? (
          <View style={styles.formGap}>
            <View style={styles.syncHeading}>
              <View style={styles.syncIcon}><KeyRound size={19} color={colors.primary} /></View>
              <View style={styles.flex}><Text style={common.h3}>私密同步码</Text><Text style={common.muted}>等同于账本密码，请勿公开分享</Text></View>
            </View>
            <View style={styles.codeRow}>
              <Text selectable={showCode} style={styles.syncCode}>{showCode ? syncCode : "•••••-•••••-•••••-•••••"}</Text>
              <Pressable accessibilityLabel="复制同步码" onPress={copySyncCode} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><Copy size={18} color={colors.primary} /></Pressable>
            </View>
            <View style={styles.inlineButtons}>
              <View style={styles.flex}><SecondaryButton label={showCode ? "隐藏同步码" : "显示同步码"} onPress={() => setShowCode((value) => !value)} /></View>
              <View style={styles.flex}><PrimaryButton label="立即同步" icon={RefreshCw} disabled={busy || syncStatus === "syncing"} onPress={() => { setFeedback(""); void syncNow().catch(() => undefined); }} /></View>
            </View>
            <Text style={common.muted}>{pendingCount ? `${pendingCount} 项等待上传` : lastSyncAt ? `上次同步 ${new Date(lastSyncAt).toLocaleString("zh-CN", { hour12: false })}` : statusLabel}</Text>
          </View>
        ) : (
          <View style={styles.formGap}>
            <View><Text style={common.h3}>在所有设备查看同一本账</Text><Text style={[common.muted, { marginTop: 4 }]}>无需注册应用账号，使用私密同步码连接。</Text></View>
            <PrimaryButton label={busy ? "正在创建" : "创建云账本"} icon={Cloud} disabled={busy} onPress={createCloudLedger} />
            <View style={styles.orRow}><View style={styles.rule} /><Text style={common.muted}>或加入已有账本</Text><View style={styles.rule} /></View>
            <Field label="私密同步码" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" autoCorrect={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" />
            <SecondaryButton label={busy ? "正在连接" : "连接云账本"} onPress={joinCloudLedger} />
          </View>
        )}
        {feedback || syncError ? <Text style={styles.feedback}>{feedback || syncError}</Text> : null}
      </Card>
      <SectionTitle>管理工具</SectionTitle>
      <View style={styles.menuList}>
        {menu.map(({ id, title, detail, icon: Icon }) => (
          <Pressable key={id} onPress={() => onNavigate(id)} style={({ pressed }) => [common.card, styles.menuItem, pressed && styles.pressed]}>
            <View style={styles.menuIcon}><Icon size={20} color={colors.primary} /></View>
            <View style={styles.flex}><Text style={common.h3}>{title}</Text><Text style={common.muted}>{detail}</Text></View>
            <ChevronRight size={19} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <SectionTitle>关于数据</SectionTitle>
      <Card>
        <View style={styles.infoRow}><Settings2 size={18} color={colors.primary} /><Text style={[common.body, styles.flex]}>本机记录始终可用，启用云同步后会自动上传并实时更新。</Text></View>
        <View style={styles.infoRow}><CircleHelp size={18} color={colors.amber} /><Text style={[common.body, styles.flex]}>未启用云同步时，卸载 PWA 会清除本机数据。</Text></View>
        <View style={{ marginTop: 12 }}><SecondaryButton label="恢复演示数据" onPress={resetDemo} /></View>
      </Card>
    </ScrollView>
  );
}

export function ProjectsScreen() {
  const { state, addProject, addTransaction, deleteTransaction, restoreDeletedTransaction } = useLedger();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [recentlyDeleted, setRecentlyDeleted] = useState<Transaction | null>(null);

  const selectedProject = state.projects.find((item) => item.id === selected);
  const records = state.transactions.filter((item) => item.projectId === selected);
  const summary = totals(records);
  const add = () => {
    if (!name.trim()) return;
    addProject({ name: name.trim(), description: "独立项目收支账本", target: Number(target) || 0 });
    setName(""); setTarget(""); setShowForm(false);
  };
  const addProjectRecord = () => {
    if (!selectedProject || Number(amount) <= 0) return;
    addTransaction({ kind, amount: Number(amount), title: `${selectedProject.name}${kind === "income" ? "收入" : "投入"}`, category: kind === "income" ? "项目收入" : "项目投入", date: new Date().toISOString().slice(0, 10), projectId: selectedProject.id, channel: "项目账本" });
    setAmount("");
  };
  const requestDelete = (item: Transaction) => {
    const commit = () => {
      deleteTransaction(item.id);
      setRecentlyDeleted(item);
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm(`删除“${item.title}”这笔项目记录？`)) commit();
      return;
    }
    Alert.alert("删除项目记录？", `“${item.title}” ${formatMoney(item.amount)}`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: commit },
    ]);
  };

  if (selectedProject) {
    const completion = selectedProject.target ? Math.min(100, summary.income / selectedProject.target * 100) : 0;
    return (
      <ScrollView contentContainerStyle={common.content}>
        <Card><Text style={common.h2}>{selectedProject.name}</Text><Text style={[common.muted, { marginTop: 4 }]}>{selectedProject.description}</Text><View style={styles.metrics}><Metric label="累计投入" value={formatMoney(summary.expense)} /><Metric label="累计收入" value={formatMoney(summary.income)} /><Metric label="净收入" value={formatMoney(summary.balance)} /></View><ProgressBar value={completion} /><Text style={[common.muted, { marginTop: 7 }]}>回本进度 {Math.round(completion)}%</Text></Card>
        <Card style={styles.topGap}><Text style={common.h3}>添加项目记录</Text><View style={styles.inlineButtons}><SecondaryButton label="记投入" onPress={() => setKind("expense")} /><SecondaryButton label="记收入" onPress={() => setKind("income")} /></View><View style={styles.formGap}><Field label={kind === "income" ? "收入金额" : "投入金额"} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" /><PrimaryButton label="保存项目记录" onPress={addProjectRecord} /></View></Card>
        <SectionTitle right={<SecondaryButton label="返回项目" onPress={() => setSelected(null)} />}>项目明细</SectionTitle>
        {recentlyDeleted ? <View style={styles.undoBanner}><Text style={[common.body, styles.flex]}>已删除“{recentlyDeleted.title}”</Text><Pressable accessibilityLabel="撤销删除" accessibilityRole="button" onPress={() => { restoreDeletedTransaction(recentlyDeleted); setRecentlyDeleted(null); }} style={styles.undoButton}><Undo2 size={17} color={colors.primary} /><Text style={styles.undoText}>撤销</Text></Pressable></View> : null}
        {records.length ? records.map((item) => <Card key={item.id} style={styles.record}><Text style={[common.body, styles.flex]}>{item.title}</Text><Text style={{ color: item.kind === "income" ? colors.income : colors.expense, fontWeight: "800" }}>{item.kind === "income" ? "+" : "-"}{formatMoney(item.amount)}</Text><Pressable accessibilityLabel={`删除${item.title}`} accessibilityRole="button" onPress={() => requestDelete(item)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}><Trash2 size={17} color={colors.expense} /></Pressable></Card>) : <Card><EmptyState title="还没有项目记录" detail="记下第一笔投入或收入后，回本进度会自动更新。" /></Card>}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={common.content}>
      <Card><Text style={common.h2}>项目账本</Text><Text style={[common.muted, { marginTop: 4 }]}>把副业、旅行、装修等收支从日常账本中单独看清。</Text><View style={{ marginTop: 14 }}><PrimaryButton label="新建项目" onPress={() => setShowForm((value) => !value)} /></View></Card>
      {showForm ? <Card style={styles.topGap}><View style={styles.formGap}><Field label="项目名称" value={name} onChangeText={setName} placeholder="例如：周末市集" /><Field label="回本目标" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" /><PrimaryButton label="创建项目" onPress={add} /></View></Card> : null}
      <SectionTitle>全部项目</SectionTitle>
      {state.projects.map((project) => {
        const recordsForProject = state.transactions.filter((item) => item.projectId === project.id);
        const summary = totals(recordsForProject);
        const completion = project.target ? Math.min(100, summary.income / project.target * 100) : 0;
        return <Card key={project.id} style={styles.projectCard}><Text style={common.h3}>{project.name}</Text><Text style={[common.muted, { marginTop: 3 }]}>{project.description}</Text><View style={styles.metrics}><Metric label="累计投入" value={formatMoney(summary.expense)} /><Metric label="累计收入" value={formatMoney(summary.income)} /><Metric label="净收入" value={formatMoney(summary.balance)} /></View><ProgressBar value={completion} /><View style={[styles.between, { marginTop: 8 }]}><Text style={common.muted}>{recordsForProject.length} 笔记录</Text><SecondaryButton label="查看条目" onPress={() => setSelected(project.id)} /></View></Card>;
      })}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

export function LoansScreen() {
  const { state, addLoan, toggleLoan } = useLedger();
  const [showForm, setShowForm] = useState(false);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const totalsByDirection = useMemo(() => ({ lent: state.loans.filter((item) => item.direction === "lent" && !item.settled).reduce((sum, item) => sum + item.amount - item.repaid, 0), borrowed: state.loans.filter((item) => item.direction === "borrowed" && !item.settled).reduce((sum, item) => sum + item.amount - item.repaid, 0) }), [state.loans]);
  const add = () => {
    if (!person.trim() || Number(amount) <= 0) return;
    addLoan({ person: person.trim(), direction: "lent", amount: Number(amount), repaid: 0, date: new Date().toISOString().slice(0, 10), settled: false });
    setPerson(""); setAmount(""); setShowForm(false);
  };
  return (
    <ScrollView contentContainerStyle={common.content}>
      <Card><Text style={common.h2}>借贷垫付</Text><Text style={[common.muted, { marginTop: 4 }]}>记录欠款与还款，结清状态一眼可见。</Text><View style={{ marginTop: 14 }}><PrimaryButton label="添加记录" onPress={() => setShowForm((value) => !value)} /></View></Card>
      <View style={styles.loanSummary}><Metric label="我借出去未收回" value={formatMoney(totalsByDirection.lent)} /><Metric label="我欠人未还" value={formatMoney(totalsByDirection.borrowed)} /></View>
      {showForm ? <Card style={styles.topGap}><View style={styles.formGap}><Field label="对方" value={person} onChangeText={setPerson} placeholder="姓名或称呼" /><Field label="金额" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" /><PrimaryButton label="保存借出记录" onPress={add} /></View></Card> : null}
      <View style={styles.filterRow}><Text style={styles.filterActive}>全部</Text><Text style={styles.filter}>未结清</Text><Text style={styles.filter}>已结清</Text></View>
      {state.loans.map((loan) => <Card key={loan.id} style={styles.loanCard}><View style={styles.flex}><Text style={common.h3}>{loan.direction === "lent" ? "借给" : "借自"} {loan.person}</Text><Text style={common.muted}>{loan.date} · {loan.settled ? "已结清" : "未结清"}</Text></View><Text style={styles.loanAmount}>{formatMoney(loan.amount - loan.repaid)}</Text><SecondaryButton label={loan.settled ? "恢复" : "结清"} onPress={() => toggleLoan(loan.id)} /></Card>)}
    </ScrollView>
  );
}

export function BudgetsScreen() {
  const { state, setBudgets } = useLedger();
  const [draft, setDraft] = useState<Budget[]>(state.budgets);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(state.budgets);
  }, [state.budgets]);

  const total = draft.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const update = (category: string, value: string) => setDraft((items) => items.map((item) => item.category === category ? { ...item, amount: Number(value) || 0 } : item));
  return (
    <ScrollView contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
      <Card><View style={styles.budgetHero}><SlidersHorizontal size={22} color={colors.primary} /><View style={styles.flex}><Text style={common.h2}>各分类月度预算配置</Text><Text style={common.muted}>超过分类预算时会在概览中醒目提示。</Text></View></View><Text style={[common.muted, { marginTop: 14 }]}>月度预算上限合计</Text><Text style={styles.budgetTotal}>{formatMoney(total)}</Text><PrimaryButton label="保存配置" onPress={() => { setBudgets(draft); setSaved(true); }} /></Card>
      {saved ? <View style={styles.savedBadge}><Text style={styles.savedText}>配置已保存</Text></View> : null}
      <SectionTitle>分类上限</SectionTitle>
      {draft.map((item) => <Card key={item.category} style={styles.budgetRow}><View style={styles.flex}><Text style={common.h3}>{item.category}</Text><Text style={common.muted}>月度配额</Text></View><View style={styles.budgetInput}><Text style={styles.currency}>¥</Text><View style={styles.budgetField}><Field label="" value={String(item.amount)} onChangeText={(value) => { setSaved(false); update(item.category, value); }} keyboardType="decimal-pad" /></View></View></Card>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
  heroCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  menuList: { gap: 9 },
  menuItem: { minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
  syncHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  syncIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  codeRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  syncCode: { flex: 1, minWidth: 0, color: colors.ink, fontWeight: "800", fontSize: 14 },
  iconAction: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  feedback: { marginTop: 12, color: colors.primary, fontWeight: "700", fontSize: 12 },
  topGap: { marginTop: 12 },
  formGap: { gap: 14 },
  inlineButtons: { flexDirection: "row", gap: 8, marginTop: 12 },
  metrics: { flexDirection: "row", gap: 7, marginVertical: 14 },
  metric: { flex: 1, borderRadius: 7, backgroundColor: colors.surfaceMuted, paddingVertical: 10, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", minWidth: 0 },
  metricLabel: { fontSize: 10, color: colors.muted, textAlign: "center" },
  metricValue: { fontSize: 12, color: colors.ink, fontWeight: "800", marginTop: 3, textAlign: "center" },
  projectCard: { marginBottom: 10 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  record: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  deleteButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.expenseSoft, alignItems: "center", justifyContent: "center" },
  undoBanner: { minHeight: 50, paddingHorizontal: 13, borderRadius: 8, backgroundColor: colors.amberSoft, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  undoButton: { minWidth: 76, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  undoText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  loanSummary: { flexDirection: "row", gap: 8, marginTop: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginVertical: 14 },
  filter: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, color: colors.muted, backgroundColor: colors.surfaceMuted, fontSize: 12 },
  filterActive: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, color: colors.white, backgroundColor: colors.primary, fontSize: 12, fontWeight: "700" },
  loanCard: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  loanAmount: { color: colors.expense, fontWeight: "800", fontSize: 14 },
  budgetHero: { flexDirection: "row", alignItems: "center", gap: 11 },
  budgetTotal: { fontSize: 26, lineHeight: 34, fontWeight: "800", color: colors.ink, marginVertical: 4 },
  savedBadge: { alignSelf: "center", backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  savedText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 },
  budgetInput: { width: 132, flexDirection: "row", alignItems: "center", gap: 6 },
  budgetField: { flex: 1, minWidth: 0 },
  currency: { fontSize: 15, color: colors.muted, fontWeight: "700" },
});
