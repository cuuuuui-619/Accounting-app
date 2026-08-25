import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FolderKanban,
  HandCoins,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  SquarePen,
  Trash2,
  Undo2,
  WalletCards,
  X,
} from "lucide-react-native";

import { Badge, Card, EmptyState, Field, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle } from "../components";
import { formatMoney, getOverallBudget, totals } from "../domain";
import { useLedger } from "../store";
import { colors, common, shadows } from "../theme";
import type { Budget, Loan, Project, Transaction } from "../types";

export type ProfileRoute = "profile" | "projects" | "loans" | "budgets";

const menu = [
  { id: "projects" as const, title: "项目账本", detail: "独立记录副业、旅行或长期目标", icon: FolderKanban },
  { id: "loans" as const, title: "借贷垫付", detail: "跟踪谁欠谁、还款进度与结清状态", icon: HandCoins },
  { id: "budgets" as const, title: "预算管理", detail: "可设置独立总预算与各分类上限", icon: SlidersHorizontal },
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
    if (!joinCode.trim()) return;
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
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(syncCode);
        setFeedback("同步码已复制。");
      } else {
        setShowCode(true);
        setFeedback("请长按同步码进行复制。");
      }
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
              <Text selectable style={styles.syncCode}>{showCode ? syncCode : "•••••-•••••-•••••-•••••"}</Text>
              <Pressable accessibilityLabel={showCode ? "隐藏" : "查看"} hitSlop={8} onPress={() => setShowCode((value) => !value)} style={styles.iconAction}>{showCode ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}</Pressable>
              <Pressable accessibilityLabel="复制同步码" hitSlop={8} onPress={copySyncCode} style={styles.iconAction}><Copy size={18} color={colors.primary} /></Pressable>
            </View>
            <View style={styles.inlineButtons}><View style={styles.flex}><PrimaryButton label={busy ? "同步中..." : "立即同步"} icon={RefreshCw} onPress={() => syncNow().catch(() => undefined)} disabled={busy} /></View></View>
          </View>
        ) : (
          <View style={styles.formGap}>
            <PrimaryButton label={busy ? "正在开启..." : "开启云同步"} icon={Cloud} onPress={createCloudLedger} disabled={busy} />
            <View style={styles.orRow}><View style={styles.rule} /><Text style={common.muted}>或使用同步码加入已有账本</Text><View style={styles.rule} /></View>
            <Field label="同步码" value={joinCode} onChangeText={setJoinCode} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoCapitalize="characters" />
            <SecondaryButton label={busy ? "正在连接..." : "连接云账本"} onPress={joinCloudLedger} />
          </View>
        )}
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </Card>
      <SectionTitle>功能专区</SectionTitle>
      <View style={styles.menuList}>
        {menu.map(({ id, title, detail, icon: Icon }) => (
          <Pressable key={id} onPress={() => onNavigate(id)} style={({ pressed }) => [common.card, styles.menuItem, pressed && styles.pressed]}>
            <View style={styles.menuIcon}><Icon size={20} color={colors.primary} /></View>
            <View style={styles.flex}><Text style={common.h3}>{title}</Text><Text style={[common.muted, { marginTop: 2 }]}>{detail}</Text></View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <SectionTitle>系统维护</SectionTitle>
      <Card><Text style={common.h3}>重置演示数据</Text><Text style={[common.muted, { marginVertical: 6 }]}>恢复初始预置的记账、项目与预算样本。</Text><SecondaryButton label="恢复演示账本" onPress={resetDemo} /></Card>
    </ScrollView>
  );
}

export function ProjectsScreen() {
  const { state, addProject, updateProject, deleteProject, addTransaction, deleteTransaction, restoreDeletedTransaction } = useLedger();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [description, setDescription] = useState("");

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [recentlyDeleted, setRecentlyDeleted] = useState<Transaction | null>(null);

  const selectedProject = state.projects.find((item) => item.id === selected);
  const records = state.transactions.filter((item) => item.projectId === selected);
  const summary = totals(records);

  const handleAdd = () => {
    if (!name.trim()) return;
    addProject({
      name: name.trim(),
      description: description.trim() || "独立项目收支账本",
      target: Number(target) || 0,
    });
    setName(""); setTarget(""); setDescription(""); setShowAddForm(false);
  };

  const beginEdit = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditTarget(String(project.target || ""));
    setEditDescription(project.description || "");
  };

  const handleSaveEdit = () => {
    if (!editingProject || !editName.trim()) return;
    updateProject(editingProject.id, {
      name: editName.trim(),
      target: Number(editTarget) || 0,
      description: editDescription.trim() || "独立项目收支账本",
    });
    setEditingProject(null);
  };

  const requestDeleteProject = (project: Project) => {
    const commit = () => {
      deleteProject(project.id);
      if (selected === project.id) setSelected(null);
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm(`确定删除项目“${project.name}”？关联的账目仍将保留。`)) commit();
      return;
    }
    Alert.alert("删除项目", `确定删除“${project.name}”？\n关联的账目记录将自动解除项目关联。`, [
      { text: "取消", style: "cancel" },
      { text: "确定删除", style: "destructive", onPress: commit },
    ]);
  };

  const addProjectRecord = () => {
    if (!selectedProject || Number(amount) <= 0) return;
    addTransaction({
      kind,
      amount: Number(amount),
      title: `${selectedProject.name}${kind === "income" ? "收入" : "投入"}`,
      category: kind === "income" ? "项目收入" : "项目投入",
      date: new Date().toISOString().slice(0, 10),
      projectId: selectedProject.id,
      channel: "项目账本",
    });
    setAmount("");
  };

  const requestDeleteRecord = (item: Transaction) => {
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
    const completion = selectedProject.target ? Math.min(100, (summary.income / selectedProject.target) * 100) : 0;
    return (
      <ScrollView contentContainerStyle={common.content}>
        <Card>
          <View style={styles.between}>
            <Text style={common.h2}>{selectedProject.name}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable hitSlop={8} onPress={() => beginEdit(selectedProject)} style={styles.iconAction}><SquarePen size={18} color={colors.primary} /></Pressable>
              <Pressable hitSlop={8} onPress={() => requestDeleteProject(selectedProject)} style={styles.iconAction}><Trash2 size={18} color={colors.expense} /></Pressable>
            </View>
          </View>
          <Text style={[common.muted, { marginTop: 4 }]}>{selectedProject.description}</Text>
          <View style={styles.metrics}>
            <Metric label="累计投入" value={formatMoney(summary.expense)} />
            <Metric label="累计收入" value={formatMoney(summary.income)} />
            <Metric label="净收益" value={formatMoney(summary.balance)} />
          </View>
          {selectedProject.target > 0 ? (
            <>
              <ProgressBar value={completion} />
              <View style={[styles.between, { marginTop: 7 }]}>
                <Text style={common.muted}>目标：{formatMoney(selectedProject.target)}</Text>
                <Text style={[common.muted, { fontWeight: "700", color: colors.primary }]}>回本进度 {Math.round(completion)}%</Text>
              </View>
            </>
          ) : null}
        </Card>

        <Card style={styles.topGap}>
          <Text style={common.h3}>快速记录项目收支</Text>
          <View style={styles.inlineButtons}>
            <Pressable style={[styles.flex, { paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: kind === "expense" ? colors.primary : colors.surfaceMuted }]} onPress={() => setKind("expense")}>
              <Text style={{ color: kind === "expense" ? colors.white : colors.ink, fontWeight: "700" }}>记投入</Text>
            </Pressable>
            <Pressable style={[styles.flex, { paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: kind === "income" ? colors.primary : colors.surfaceMuted }]} onPress={() => setKind("income")}>
              <Text style={{ color: kind === "income" ? colors.white : colors.ink, fontWeight: "700" }}>记收入</Text>
            </Pressable>
          </View>
          <View style={styles.formGap}>
            <Field label={kind === "income" ? "收入金额" : "投入金额"} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <PrimaryButton label="保存项目条目" onPress={addProjectRecord} />
          </View>
        </Card>

        <SectionTitle right={<SecondaryButton label="返回项目列表" onPress={() => setSelected(null)} />}>项目明细 ({records.length})</SectionTitle>
        {recentlyDeleted ? (
          <View style={styles.undoBanner}>
            <Text style={[common.body, styles.flex]}>已删除“{recentlyDeleted.title}”</Text>
            <Pressable accessibilityLabel="撤销删除" accessibilityRole="button" onPress={() => { restoreDeletedTransaction(recentlyDeleted); setRecentlyDeleted(null); }} style={styles.undoButton}>
              <Undo2 size={17} color={colors.primary} />
              <Text style={styles.undoText}>撤销</Text>
            </Pressable>
          </View>
        ) : null}
        {records.length ? records.map((item) => (
          <Card key={item.id} style={styles.recordCard}>
            <View style={styles.flex}>
              <Text style={common.h3}>{item.title}</Text>
              <Text style={common.muted}>{item.date} · {item.category}</Text>
            </View>
            <Text style={{ color: item.kind === "income" ? colors.income : colors.expense, fontWeight: "800", fontSize: 15 }}>
              {item.kind === "income" ? "+" : "-"}{formatMoney(item.amount)}
            </Text>
            <Pressable accessibilityLabel={`删除${item.title}`} accessibilityRole="button" onPress={() => requestDeleteRecord(item)} style={styles.deleteMiniButton}>
              <Trash2 size={16} color={colors.expense} />
            </Pressable>
          </Card>
        )) : <Card><EmptyState title="还没有项目明细" detail="记下第一笔投入或收入后，回本进度会自动计算更新。" /></Card>}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={common.content}>
      <Card>
        <Text style={common.h2}>项目账本</Text>
        <Text style={[common.muted, { marginTop: 4 }]}>把副业、旅行、装修、副业市集等收支从日常账本中单独看清。</Text>
        <View style={{ marginTop: 14 }}><PrimaryButton label={showAddForm ? "取消新建" : "新建项目"} icon={showAddForm ? X : Plus} onPress={() => setShowAddForm((value) => !value)} /></View>
      </Card>

      {showAddForm ? (
        <Card style={styles.topGap}>
          <View style={styles.formGap}>
            <Field label="项目名称" value={name} onChangeText={setName} placeholder="例如：周末手作市集" />
            <Field label="回本目标 (可选)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" />
            <Field label="项目描述 (可选)" value={description} onChangeText={setDescription} placeholder="一句话描述此项目的目标" />
            <PrimaryButton label="创建项目" onPress={handleAdd} />
          </View>
        </Card>
      ) : null}

      <SectionTitle>全部项目 ({state.projects.length})</SectionTitle>
      {state.projects.map((project) => {
        const recordsForProject = state.transactions.filter((item) => item.projectId === project.id);
        const summary = totals(recordsForProject);
        const completion = project.target ? Math.min(100, (summary.income / project.target) * 100) : 0;
        return (
          <Card key={project.id} style={styles.projectCard}>
            <View style={styles.between}>
              <View style={styles.flex}>
                <Text style={common.h2}>{project.name}</Text>
                <Text style={[common.muted, { marginTop: 2 }]}>{project.description}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable hitSlop={8} onPress={() => beginEdit(project)} style={styles.iconAction}><SquarePen size={18} color={colors.primary} /></Pressable>
                <Pressable hitSlop={8} onPress={() => requestDeleteProject(project)} style={styles.iconAction}><Trash2 size={18} color={colors.expense} /></Pressable>
              </View>
            </View>

            <View style={styles.metrics}>
              <Metric label="累计投入" value={formatMoney(summary.expense)} />
              <Metric label="累计收入" value={formatMoney(summary.income)} />
              <Metric label="净收益" value={formatMoney(summary.balance)} />
            </View>

            {project.target > 0 ? (
              <>
                <ProgressBar value={completion} />
                <View style={[styles.between, { marginTop: 6 }]}>
                  <Text style={common.muted}>目标：{formatMoney(project.target)}</Text>
                  <Text style={[common.muted, { color: colors.primary, fontWeight: "700" }]}>{Math.round(completion)}%</Text>
                </View>
              </>
            ) : null}

            <View style={[styles.between, { marginTop: 12 }]}>
              <Text style={common.muted}>{recordsForProject.length} 笔关联记录</Text>
              <SecondaryButton label="进入项目明细" onPress={() => setSelected(project.id)} />
            </View>
          </Card>
        );
      })}

      <Modal visible={Boolean(editingProject)} transparent animationType="slide" onRequestClose={() => setEditingProject(null)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={common.h2}>编辑项目</Text>
            <View style={[styles.formGap, { marginTop: 14 }]}>
              <Field label="项目名称" value={editName} onChangeText={setEditName} placeholder="项目名称" />
              <Field label="回本目标" value={editTarget} onChangeText={setEditTarget} keyboardType="decimal-pad" placeholder="0.00" />
              <Field label="项目描述" value={editDescription} onChangeText={setEditDescription} placeholder="项目描述" />
              <View style={styles.inlineButtons}>
                <View style={styles.flex}><SecondaryButton label="取消" onPress={() => setEditingProject(null)} /></View>
                <View style={styles.flex}><PrimaryButton label="保存修改" icon={Save} onPress={handleSaveEdit} /></View>
              </View>
            </View>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function LoansScreen() {
  const { state, addLoan, updateLoan, deleteLoan, repayLoan, toggleLoan } = useLedger();
  const [showAddForm, setShowAddForm] = useState(false);
  const [direction, setDirection] = useState<"lent" | "borrowed">("lent");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [filter, setFilter] = useState<"all" | "lent" | "borrowed" | "active" | "settled">("all");

  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editPerson, setEditPerson] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editRepaid, setEditRepaid] = useState("");
  const [editDirection, setEditDirection] = useState<"lent" | "borrowed">("lent");
  const [editDate, setEditDate] = useState("");

  const [repayingLoan, setRepayingLoan] = useState<Loan | null>(null);
  const [repayInput, setRepayInput] = useState("");

  const totalsByDirection = useMemo(() => ({
    lent: state.loans.filter((item) => item.direction === "lent" && !item.settled).reduce((sum, item) => sum + item.amount - (item.repaid || 0), 0),
    borrowed: state.loans.filter((item) => item.direction === "borrowed" && !item.settled).reduce((sum, item) => sum + item.amount - (item.repaid || 0), 0),
  }), [state.loans]);

  const handleAdd = () => {
    if (!person.trim() || Number(amount) <= 0) return;
    addLoan({
      person: person.trim(),
      direction,
      amount: Number(amount),
      repaid: 0,
      date: new Date().toISOString().slice(0, 10),
      settled: false,
    });
    setPerson(""); setAmount(""); setShowAddForm(false);
  };

  const beginEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setEditPerson(loan.person);
    setEditAmount(String(loan.amount));
    setEditRepaid(String(loan.repaid || 0));
    setEditDirection(loan.direction);
    setEditDate(loan.date);
  };

  const handleSaveEdit = () => {
    if (!editingLoan || !editPerson.trim() || Number(editAmount) <= 0) return;
    const numAmount = Number(editAmount);
    const numRepaid = Math.min(numAmount, Number(editRepaid) || 0);
    updateLoan(editingLoan.id, {
      person: editPerson.trim(),
      amount: numAmount,
      repaid: numRepaid,
      direction: editDirection,
      date: editDate || editingLoan.date,
      settled: numRepaid >= numAmount,
    });
    setEditingLoan(null);
  };

  const requestDeleteLoan = (loan: Loan) => {
    const commit = () => deleteLoan(loan.id);
    if (Platform.OS === "web") {
      if (globalThis.confirm(`确定删除与“${loan.person}”的这笔借贷记录？`)) commit();
      return;
    }
    Alert.alert("删除借贷记录", `确定删除与“${loan.person}”的这笔记录 (${formatMoney(loan.amount)})？`, [
      { text: "取消", style: "cancel" },
      { text: "确定删除", style: "destructive", onPress: commit },
    ]);
  };

  const handleQuickRepay = () => {
    if (!repayingLoan || Number(repayInput) <= 0) return;
    repayLoan(repayingLoan.id, Number(repayInput));
    setRepayingLoan(null);
    setRepayInput("");
  };

  const filteredLoans = useMemo(() => {
    return state.loans.filter((item) => {
      if (filter === "lent") return item.direction === "lent";
      if (filter === "borrowed") return item.direction === "borrowed";
      if (filter === "active") return !item.settled;
      if (filter === "settled") return item.settled;
      return true;
    });
  }, [state.loans, filter]);

  return (
    <ScrollView contentContainerStyle={common.content}>
      <Card>
        <Text style={common.h2}>借贷垫付</Text>
        <Text style={[common.muted, { marginTop: 4 }]}>清晰记录谁欠谁、还款进度与结清状态。</Text>
        <View style={{ marginTop: 14 }}>
          <PrimaryButton label={showAddForm ? "取消添加" : "添加借贷记录"} icon={showAddForm ? X : Plus} onPress={() => setShowAddForm((value) => !value)} />
        </View>
      </Card>

      <View style={styles.loanSummary}>
        <Metric label="待收回 (他人欠我)" value={formatMoney(totalsByDirection.lent)} />
        <Metric label="待还清 (我欠他人)" value={formatMoney(totalsByDirection.borrowed)} />
      </View>

      {showAddForm ? (
        <Card style={styles.topGap}>
          <View style={styles.formGap}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.flex, { paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: direction === "lent" ? colors.primary : colors.surfaceMuted }]} onPress={() => setDirection("lent")}>
                <Text style={{ color: direction === "lent" ? colors.white : colors.ink, fontWeight: "700" }}>我借出 (应收款)</Text>
              </Pressable>
              <Pressable style={[styles.flex, { paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: direction === "borrowed" ? colors.primary : colors.surfaceMuted }]} onPress={() => setDirection("borrowed")}>
                <Text style={{ color: direction === "borrowed" ? colors.white : colors.ink, fontWeight: "700" }}>我借入 (应还款)</Text>
              </Pressable>
            </View>
            <Field label="对方姓名 / 称呼" value={person} onChangeText={setPerson} placeholder="姓名或称呼" />
            <Field label="借贷总金额" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <PrimaryButton label={`保存${direction === "lent" ? "借出" : "借入"}记录`} onPress={handleAdd} />
          </View>
        </Card>
      ) : null}

      <View style={styles.filterRow}>
        {(["all", "active", "settled", "lent", "borrowed"] as const).map((key) => {
          const labels = { all: "全部", active: "未结清", settled: "已结清", lent: "我借出的", borrowed: "我借入的" };
          const active = filter === key;
          return (
            <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{labels[key]}</Text>
            </Pressable>
          );
        })}
      </View>

      {filteredLoans.length ? filteredLoans.map((loan) => {
        const remaining = Math.max(0, loan.amount - (loan.repaid || 0));
        const progress = loan.amount > 0 ? Math.min(100, ((loan.repaid || 0) / loan.amount) * 100) : 0;
        const isLent = loan.direction === "lent";

        return (
          <Card key={loan.id} style={styles.loanCardItem}>
            <View style={styles.between}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge label={isLent ? "借出" : "借入"} tone={isLent ? "primary" : "amber"} />
                <Text style={common.h3}>{loan.person}</Text>
              </View>
              <Badge label={loan.settled ? "已结清" : `待还 ${formatMoney(remaining)}`} tone={loan.settled ? "income" : "expense"} />
            </View>

            <View style={[styles.between, { marginTop: 12 }]}>
              <Text style={common.muted}>总金额：{formatMoney(loan.amount)}</Text>
              <Text style={common.muted}>已还：{formatMoney(loan.repaid || 0)}</Text>
            </View>

            <View style={{ marginTop: 8 }}>
              <ProgressBar value={progress} tone={loan.settled ? "income" : "primary"} />
            </View>

            <View style={[styles.between, { marginTop: 12 }]}>
              <Text style={common.muted}>{loan.date}</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                {!loan.settled ? (
                  <Pressable style={styles.repayButton} onPress={() => { setRepayingLoan(loan); setRepayInput(String(remaining)); }}>
                    <Text style={styles.repayButtonText}>记还款</Text>
                  </Pressable>
                ) : null}
                <SecondaryButton label={loan.settled ? "恢复未结清" : "一键结清"} onPress={() => toggleLoan(loan.id)} />
                <Pressable hitSlop={6} onPress={() => beginEdit(loan)} style={styles.iconAction}><SquarePen size={18} color={colors.primary} /></Pressable>
                <Pressable hitSlop={6} onPress={() => requestDeleteLoan(loan)} style={styles.iconAction}><Trash2 size={18} color={colors.expense} /></Pressable>
              </View>
            </View>
          </Card>
        );
      }) : <Card><EmptyState title="暂无借贷记录" detail="点按上方按钮可快速记录一笔新的借贷或垫付。" /></Card>}

      <Modal visible={Boolean(editingLoan)} transparent animationType="slide" onRequestClose={() => setEditingLoan(null)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={common.h2}>编辑借贷记录</Text>
            <View style={[styles.formGap, { marginTop: 14 }]}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={[styles.flex, { paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: editDirection === "lent" ? colors.primary : colors.surfaceMuted }]} onPress={() => setEditDirection("lent")}>
                  <Text style={{ color: editDirection === "lent" ? colors.white : colors.ink, fontWeight: "700" }}>我借出</Text>
                </Pressable>
                <Pressable style={[styles.flex, { paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: editDirection === "borrowed" ? colors.primary : colors.surfaceMuted }]} onPress={() => setEditDirection("borrowed")}>
                  <Text style={{ color: editDirection === "borrowed" ? colors.white : colors.ink, fontWeight: "700" }}>我借入</Text>
                </Pressable>
              </View>
              <Field label="对方姓名" value={editPerson} onChangeText={setEditPerson} />
              <Field label="借贷总额" value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
              <Field label="已还金额" value={editRepaid} onChangeText={setEditRepaid} keyboardType="decimal-pad" />
              <Field label="日期" value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" />
              <View style={styles.inlineButtons}>
                <View style={styles.flex}><SecondaryButton label="取消" onPress={() => setEditingLoan(null)} /></View>
                <View style={styles.flex}><PrimaryButton label="保存修改" icon={Save} onPress={handleSaveEdit} /></View>
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      <Modal visible={Boolean(repayingLoan)} transparent animationType="fade" onRequestClose={() => setRepayingLoan(null)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={common.h2}>登记还款 ({repayingLoan?.person})</Text>
            <Text style={[common.muted, { marginTop: 4 }]}>
              借贷总额 {formatMoney(repayingLoan?.amount || 0)}，当前待还 {formatMoney(Math.max(0, (repayingLoan?.amount || 0) - (repayingLoan?.repaid || 0)))}
            </Text>
            <View style={[styles.formGap, { marginTop: 14 }]}>
              <Field label="本次还款金额" value={repayInput} onChangeText={setRepayInput} keyboardType="decimal-pad" placeholder="0.00" />
              <View style={styles.inlineButtons}>
                <View style={styles.flex}><SecondaryButton label="取消" onPress={() => setRepayingLoan(null)} /></View>
                <View style={styles.flex}><PrimaryButton label="确认入账" icon={Check} onPress={handleQuickRepay} /></View>
              </View>
            </View>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

const BudgetItemRow = React.memo(function BudgetItemRow({
  category,
  initialAmount,
  onAmountChange,
}: {
  category: string;
  initialAmount: number;
  onAmountChange: (category: string, value: string) => void;
}) {
  const [val, setVal] = useState(String(initialAmount || ""));

  useEffect(() => {
    setVal(initialAmount > 0 ? String(initialAmount) : "");
  }, [initialAmount]);

  return (
    <Card style={styles.budgetRow}>
      <View style={styles.flex}>
        <Text style={common.h3}>{category}</Text>
        <Text style={common.muted}>{initialAmount > 0 ? `月度上限 ${formatMoney(initialAmount)}` : "未设上限"}</Text>
      </View>
      <View style={styles.budgetInput}>
        <Text style={styles.currency}>¥</Text>
        <View style={styles.budgetField}>
          <Field
            label=""
            value={val}
            placeholder="0"
            onChangeText={(value) => {
              setVal(value);
              onAmountChange(category, value);
            }}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </Card>
  );
});

export function BudgetsScreen() {
  const { state, setBudgets } = useLedger();
  const [draft, setDraft] = useState<Budget[]>(state.budgets);
  const [totalBudgetInput, setTotalBudgetInput] = useState("");
  const [saved, setSaved] = useState(false);

  const defaultCategories = ["餐饮美食", "交通出行", "购物消费", "休闲娱乐", "居家缴费", "医疗健康", "教育学习", "人情往来"];

  useEffect(() => {
    setDraft(state.budgets);
    const overall = state.budgets.find((b) => b.category === "总预算");
    if (overall && overall.amount > 0) {
      setTotalBudgetInput(String(overall.amount));
    } else {
      const sum = state.budgets.filter((b) => b.category !== "总预算").reduce((s, i) => s + i.amount, 0);
      setTotalBudgetInput(sum > 0 ? String(sum) : "");
    }
  }, [state.budgets]);

  const updateCategory = useCallback((category: string, value: string) => {
    setSaved(false);
    setDraft((items) => {
      const existing = items.find((i) => i.category === category);
      const amount = Number(value) || 0;
      if (existing) {
        return items.map((i) => (i.category === category ? { ...i, amount } : i));
      }
      return [...items, { category, amount }];
    });
  }, []);

  const handleSave = () => {
    const totalAmount = Number(totalBudgetInput) || 0;
    const nextBudgets: Budget[] = [];

    if (totalAmount > 0) {
      nextBudgets.push({ category: "总预算", amount: totalAmount });
    }

    for (const cat of defaultCategories) {
      const match = draft.find((d) => d.category === cat);
      if (match && match.amount > 0) {
        nextBudgets.push({ category: cat, amount: match.amount });
      }
    }

    setBudgets(nextBudgets);
    setSaved(true);
  };

  const categoriesToRender = useMemo(() => {
    return defaultCategories.map((cat) => {
      const match = draft.find((d) => d.category === cat);
      return { category: cat, amount: match ? match.amount : 0 };
    });
  }, [draft]);

  return (
    <ScrollView contentContainerStyle={common.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={styles.budgetHero}>
          <SlidersHorizontal size={24} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={common.h2}>月度总预算配置</Text>
            <Text style={common.muted}>即使不设置分类上限，设定总预算即可实时掌控开销。</Text>
          </View>
        </View>

        <View style={[styles.formGap, { marginTop: 16 }]}>
          <Field
            label="每月总预算上限"
            value={totalBudgetInput}
            onChangeText={(val) => {
              setSaved(false);
              setTotalBudgetInput(val);
            }}
            keyboardType="decimal-pad"
            placeholder="例如：5000.00"
          />
          <PrimaryButton label="保存预算配置" onPress={handleSave} />
        </View>
      </Card>

      {saved ? (
        <View style={styles.savedBadge}>
          <CheckCircle2 size={16} color={colors.primary} />
          <Text style={styles.savedText}>预算配置已成功保存并实时生效</Text>
        </View>
      ) : null}

      <SectionTitle>各分类月度预算 (可选细化)</SectionTitle>
      <Text style={[common.muted, { marginBottom: 12 }]}>
        可针对高频消费单独设置上限。未填写的分类将仅计入总预算统计。
      </Text>

      {categoriesToRender.map((item) => (
        <BudgetItemRow
          key={item.category}
          category={item.category}
          initialAmount={item.amount}
          onAmountChange={updateCategory}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
  heroCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows },
  menuList: { gap: 10 },
  menuItem: { minHeight: 76, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  menuIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
  syncHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  syncIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  codeRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 6, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  syncCode: { flex: 1, minWidth: 0, color: colors.ink, fontWeight: "800", fontSize: 14 },
  iconAction: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  feedback: { marginTop: 12, color: colors.primary, fontWeight: "700", fontSize: 13 },
  topGap: { marginTop: 14 },
  formGap: { gap: 14 },
  inlineButtons: { flexDirection: "row", gap: 10, marginTop: 10 },
  metrics: { flexDirection: "row", gap: 8, marginVertical: 14 },
  metric: { flex: 1, borderRadius: 10, backgroundColor: colors.surfaceMuted, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", minWidth: 0 },
  metricLabel: { fontSize: 11, color: colors.muted, textAlign: "center" },
  metricValue: { fontSize: 14, color: colors.ink, fontWeight: "800", marginTop: 4, textAlign: "center" },
  projectCard: { marginBottom: 12 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  recordCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: 14 },
  deleteMiniButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.expenseSoft, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  undoBanner: { minHeight: 50, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.amberSoft, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  undoButton: { minWidth: 76, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  undoText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  loanSummary: { flexDirection: "row", gap: 10, marginTop: 14 },
  filterRow: { flexDirection: "row", gap: 8, marginVertical: 14, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: colors.white, fontWeight: "700" },
  loanCardItem: { marginBottom: 12 },
  repayButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  repayButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  budgetHero: { flexDirection: "row", alignItems: "center", gap: 12 },
  savedBadge: { alignSelf: "center", backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  savedText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, padding: 14 },
  budgetInput: { width: 140, flexDirection: "row", alignItems: "center", gap: 6 },
  budgetField: { flex: 1, minWidth: 0 },
  currency: { fontSize: 15, color: colors.muted, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.4)", justifyContent: "center", padding: 20 },
  modalCard: { borderRadius: 18, padding: 20 },
});
