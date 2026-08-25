import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Database, KeyRound, LogOut, RefreshCw, Trash2, TriangleAlert, UsersRound, WalletCards } from "lucide-react-native";

import { colors, common, shadows } from "../theme";
import {
  ADMIN_DELETE_CONFIRMATION,
  deleteAdminResource,
  requestAdminPage,
  type AdminDeleteResource,
  type AdminLedgerRow,
  type AdminPageResponse,
  type AdminRecordRow,
  type AdminResource,
  type AdminUserRow,
} from "./adminApi";

const tabs: Array<{ id: AdminResource; label: string }> = [
  { id: "users", label: "用户" },
  { id: "ledgers", label: "账本" },
  { id: "records", label: "记录" },
];

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
const shortId = (value: string) => value.length > 20 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;

function recordDetail(row: AdminRecordRow) {
  const payload = row.payload;
  const parts = [payload.title, payload.category, typeof payload.amount === "number" ? `¥${payload.amount}` : null, payload.note]
    .filter((item): item is string => typeof item === "string" && item.length > 0);
  return parts.length ? parts.join(" · ") : JSON.stringify(payload);
}

function LoginPanel({ busy, error, onLogin }: { busy: boolean; error: string; onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");
  return (
    <View style={styles.centered}>
      <View style={styles.loginPanel}>
        <View style={styles.loginIcon}><KeyRound size={22} color={colors.white} /></View>
        <Text style={common.h1}>管理端登录</Text>
        <Text style={styles.loginCopy}>输入服务端配置的管理员密码，查看用户与账本运行数据。</Text>
        <TextInput
          accessibilityLabel="管理员密码"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          onSubmitEditing={() => password && !busy && onLogin(password)}
          placeholder="管理员密码"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.passwordInput}
          value={password}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable disabled={!password || busy} onPress={() => onLogin(password)} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed, (!password || busy) && styles.disabled]}>
          {busy ? <ActivityIndicator size="small" color={colors.white} /> : <KeyRound size={17} color={colors.white} />}
          <Text style={styles.loginButtonText}>{busy ? "正在验证" : "进入管理端"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MobileNotice() {
  return (
    <View style={styles.centered}>
      <View style={styles.mobileNotice}>
        <Database size={30} color={colors.primary} />
        <Text style={common.h2}>请在电脑浏览器中打开</Text>
        <Text style={styles.loginCopy}>管理端为桌面数据表格设计，手机端继续使用记账功能即可。</Text>
      </View>
    </View>
  );
}

function DeleteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.deleteIconButton, pressed && styles.pressed]}><Trash2 size={17} color={colors.expense} /></Pressable>;
}

function DataTable({ data, onDelete }: { data: AdminPageResponse; onDelete: (resource: AdminDeleteResource, id: string) => void }) {
  if (data.rows.length === 0) return <View style={styles.empty}><Text style={common.h3}>暂无数据</Text><Text style={common.muted}>这一页没有可显示的记录。</Text></View>;

  if (data.resource === "users") {
    return <View style={styles.table}>{(data.rows as AdminUserRow[]).map((row) => <View key={row.id} style={styles.tableRow}>
      <Text style={[styles.cell, styles.idCell]} selectable>{shortId(row.id)}</Text>
      <Text style={[styles.cell, styles.typeCell]}>{row.isAnonymous ? "匿名用户" : "注册用户"}</Text>
      <Text style={[styles.cell, styles.flexCell]} numberOfLines={1}>{row.email ?? "未绑定邮箱"}</Text>
      <Text style={[styles.cell, styles.dateCell]}>{dateTime(row.createdAt)}</Text>
      <Text style={[styles.cell, styles.dateCell]}>{dateTime(row.lastSignInAt)}</Text>
      <View style={styles.actionCell}><DeleteButton label={`删除用户 ${row.id}`} onPress={() => onDelete("users", row.id)} /></View>
    </View>)}</View>;
  }
  if (data.resource === "ledgers") {
    return <View style={styles.table}>{(data.rows as AdminLedgerRow[]).map((row) => <View key={row.id} style={styles.tableRow}>
      <Text style={[styles.cell, styles.idCell]} selectable>{shortId(row.id)}</Text>
      <Text style={[styles.cell, styles.flexCell]} selectable>{shortId(row.createdBy)}</Text>
      <Text style={[styles.cell, styles.countCell]}>{row.memberCount}</Text>
      <Text style={[styles.cell, styles.countCell]}>{row.activeRecordCount}</Text>
      <Text style={[styles.cell, styles.dateCell]}>{dateTime(row.createdAt)}</Text>
      <View style={styles.actionCell}><DeleteButton label={`删除账本 ${row.id}`} onPress={() => onDelete("ledgers", row.id)} /></View>
    </View>)}</View>;
  }
  return <View style={styles.table}>{(data.rows as AdminRecordRow[]).map((row) => <View key={`${row.ledgerId}:${row.recordType}:${row.recordId}`} style={styles.tableRow}>
    <Text style={[styles.cell, styles.idCell]} selectable>{shortId(row.ledgerId)}</Text>
    <Text style={[styles.cell, styles.typeCell]}>{row.recordType}</Text>
    <Text style={[styles.cell, styles.idCell]} selectable>{shortId(row.recordId)}</Text>
    <Text style={[styles.cell, styles.detailCell]} numberOfLines={2}>{recordDetail(row)}</Text>
    <Text style={[styles.cell, styles.dateCell]}>{dateTime(row.updatedAt)}</Text>
  </View>)}</View>;
}

function HeaderRow({ resource }: { resource: AdminResource }) {
  const labels = resource === "users"
    ? [["用户 ID", styles.idCell], ["类型", styles.typeCell], ["账号", styles.flexCell], ["创建时间", styles.dateCell], ["最近登录", styles.dateCell], ["操作", styles.actionCell]] as const
    : resource === "ledgers"
      ? [["账本 ID", styles.idCell], ["创建者", styles.flexCell], ["成员", styles.countCell], ["有效记录", styles.countCell], ["创建时间", styles.dateCell], ["操作", styles.actionCell]] as const
      : [["账本 ID", styles.idCell], ["类型", styles.typeCell], ["记录 ID", styles.idCell], ["内容明细", styles.detailCell], ["更新时间", styles.dateCell]] as const;
  return <View style={styles.tableHeader}>{labels.map(([label, style]) => <Text key={label} style={[styles.headerCell, style]}>{label}</Text>)}</View>;
}

type DeleteTarget = { resource: AdminDeleteResource; id: string };

function DeleteDialog({ target, busy, error, onCancel, onConfirm }: { target: DeleteTarget | null; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const [typedId, setTypedId] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  if (!target) return null;
  const confirmed = typedId === target.id && typedConfirmation === ADMIN_DELETE_CONFIRMATION;
  const cascade = target.resource === "users"
    ? "级联影响：该用户创建的账本、成员关系，以及由该用户更新的相关记录可能一并永久删除。"
    : "级联影响：该账本的全部成员关系与全部记账记录将一并永久删除。";
  return <Modal animationType="fade" transparent visible onRequestClose={onCancel}>
    <View style={styles.modalBackdrop}>
      <View style={styles.deleteDialog}>
        <View style={styles.warningIcon}><TriangleAlert size={22} color={colors.expense} /></View>
        <Text style={common.h2}>永久删除{target.resource === "users" ? "用户" : "账本"}</Text>
        <Text style={styles.dangerCopy}>此操作无法撤销。{cascade}</Text>
        <View style={styles.targetBox}><Text style={common.muted}>目标完整 UUID</Text><Text selectable style={styles.targetId}>{target.id}</Text></View>
        <TextInput accessibilityLabel="输入完整 UUID" autoCapitalize="none" autoCorrect={false} onChangeText={setTypedId} placeholder="输入完整 UUID" placeholderTextColor={colors.muted} style={styles.confirmInput} value={typedId} />
        <TextInput accessibilityLabel="输入永久删除确认词" autoCorrect={false} onChangeText={setTypedConfirmation} placeholder={`输入“${ADMIN_DELETE_CONFIRMATION}”`} placeholderTextColor={colors.muted} style={styles.confirmInput} value={typedConfirmation} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.dialogActions}>
          <Pressable disabled={busy} onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>取消</Text></Pressable>
          <Pressable disabled={!confirmed || busy} onPress={onConfirm} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, (!confirmed || busy) && styles.disabled]}>
            {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Trash2 size={17} color={colors.white} />}
            <Text style={styles.dangerButtonText}>永久删除</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

export default function AdminApp() {
  const { width } = useWindowDimensions();
  const [password, setPassword] = useState("");
  const [resource, setResource] = useState<AdminResource>("users");
  const [data, setData] = useState<AdminPageResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async (nextPassword: string, nextResource: AdminResource, nextPage: number) => {
    setBusy(true);
    setError("");
    try {
      const response = await requestAdminPage(nextPassword, nextResource, nextPage);
      setPassword(nextPassword);
      setResource(nextResource);
      setData(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "管理数据读取失败。");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !data) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteAdminResource(password, deleteTarget.resource, deleteTarget.id, ADMIN_DELETE_CONFIRMATION);
      const deletedLabel = deleteTarget.resource === "users" ? "用户" : "账本";
      setDeleteTarget(null);
      setSuccess(`${deletedLabel}已永久删除。`);
      await load(password, resource, data.page);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "删除失败，请稍后重试。");
    } finally {
      setDeleteBusy(false);
    }
  }, [data, deleteTarget, load, password, resource]);

  if (width < 760) return <MobileNotice />;
  if (!password || !data) return <LoginPanel busy={busy} error={error} onLogin={(value) => void load(value, "users", 1)} />;

  const stats = [
    { label: "用户数量", value: data.stats.users, icon: UsersRound },
    { label: "账本数量", value: data.stats.ledgers, icon: WalletCards },
    { label: "有效记录", value: data.stats.activeRecords, icon: Database },
    { label: "成员关系", value: data.stats.members, icon: UsersRound },
  ];
  const lastPage = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        <View style={styles.brand}><View style={styles.brandIcon}><WalletCards size={20} color={colors.white} /></View><View><Text style={styles.brandTitle}>苔账管理端</Text><Text style={common.muted}>用户与数据管理控制台</Text></View></View>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="刷新数据" disabled={busy} onPress={() => void load(password, resource, data.page)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><RefreshCw size={19} color={colors.primary} /></Pressable>
          <Pressable onPress={() => { setPassword(""); setData(null); setError(""); }} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}><LogOut size={17} color={colors.expense} /><Text style={styles.logoutText}>退出</Text></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>{stats.map(({ label, value, icon: Icon }) => <View key={label} style={styles.statCard}><View style={styles.statTop}><Text style={common.muted}>{label}</Text><Icon size={18} color={colors.primary} /></View><Text style={styles.statValue}>{value.toLocaleString("zh-CN")}</Text></View>)}</View>
        <View style={styles.toolbar}>
          <View style={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.id} onPress={() => void load(password, tab.id, 1)} style={[styles.tab, resource === tab.id && styles.tabActive]}><Text style={[styles.tabText, resource === tab.id && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}</View>
          <Text style={common.muted}>共 {data.total.toLocaleString("zh-CN")} 条</Text>
        </View>
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <View style={styles.tableWrap}>
          <HeaderRow resource={resource} />
          {busy ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={common.muted}>正在读取...</Text></View> : <DataTable data={data} onDelete={(nextResource, id) => { setSuccess(""); setDeleteError(""); setDeleteTarget({ resource: nextResource, id }); }} />}
        </View>
        <View style={styles.pagination}>
          <Pressable disabled={busy || data.page <= 1} onPress={() => void load(password, resource, data.page - 1)} style={[styles.pageButton, (busy || data.page <= 1) && styles.disabled]}><Text style={styles.pageText}>上一页</Text></Pressable>
          <Text style={common.muted}>第 {data.page} / {lastPage} 页</Text>
          <Pressable disabled={busy || data.page >= lastPage} onPress={() => void load(password, resource, data.page + 1)} style={[styles.pageButton, (busy || data.page >= lastPage) && styles.disabled]}><Text style={styles.pageText}>下一页</Text></Pressable>
        </View>
      </ScrollView>
      <DeleteDialog key={deleteTarget?.id ?? "closed"} target={deleteTarget} busy={deleteBusy} error={deleteError} onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }} onConfirm={() => void confirmDelete()} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: "100%", backgroundColor: colors.canvas },
  centered: { flex: 1, minHeight: "100%", backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: 24 },
  loginPanel: { width: "100%", maxWidth: 420, padding: 28, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 14, ...shadows },
  loginIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  loginCopy: { fontSize: 14, lineHeight: 21, color: colors.muted },
  passwordInput: { height: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, color: colors.ink, paddingHorizontal: 14, fontSize: 15 },
  loginButton: { minHeight: 46, borderRadius: 8, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  loginButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  errorText: { color: colors.expense, fontSize: 13, lineHeight: 19 },
  mobileNotice: { width: "100%", maxWidth: 420, alignItems: "center", gap: 12, padding: 28, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  topbar: { minHeight: 72, paddingHorizontal: 28, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: colors.ink, fontSize: 18, lineHeight: 23, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  logoutButton: { height: 42, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 7 },
  logoutText: { color: colors.expense, fontSize: 13, fontWeight: "700" },
  content: { width: "100%", maxWidth: 1320, alignSelf: "center", paddingHorizontal: 28, paddingTop: 28, paddingBottom: 40 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: 160, borderRadius: 8, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statValue: { marginTop: 10, fontSize: 28, lineHeight: 34, fontWeight: "800", color: colors.ink },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  tabs: { flexDirection: "row", padding: 4, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  tab: { minWidth: 84, height: 36, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: colors.primary },
  inlineError: { marginBottom: 10, color: colors.expense, fontSize: 13 },
  successText: { marginBottom: 10, color: colors.income, fontSize: 13, fontWeight: "700" },
  tableWrap: { minWidth: 930, borderRadius: 8, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  table: { minHeight: 160 },
  tableHeader: { minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.line },
  tableRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerCell: { paddingHorizontal: 8, color: colors.muted, fontSize: 12, fontWeight: "700" },
  cell: { paddingHorizontal: 8, color: colors.ink, fontSize: 12, lineHeight: 18 },
  idCell: { width: 160 },
  typeCell: { width: 110 },
  countCell: { width: 90, textAlign: "center" },
  dateCell: { width: 178 },
  flexCell: { flex: 1, minWidth: 180 },
  detailCell: { flex: 1, minWidth: 300 },
  actionCell: { width: 64, alignItems: "center", justifyContent: "center" },
  deleteIconButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.expenseSoft, alignItems: "center", justifyContent: "center" },
  empty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 6 },
  loading: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 10 },
  pagination: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14 },
  pageButton: { height: 38, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pageText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(24,32,29,0.42)", alignItems: "center", justifyContent: "center", padding: 24 },
  deleteDialog: { width: "100%", maxWidth: 540, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 24, gap: 13, ...shadows },
  warningIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.expenseSoft, alignItems: "center", justifyContent: "center" },
  dangerCopy: { color: colors.expense, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  targetBox: { padding: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted, gap: 5 },
  targetId: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  confirmInput: { height: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, color: colors.ink, paddingHorizontal: 13, fontSize: 14 },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  cancelButton: { height: 42, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  dangerButton: { minWidth: 126, height: 42, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.expense, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  dangerButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
