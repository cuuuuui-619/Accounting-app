import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  createRemoteLedger,
  ensureAnonymousSession,
  fetchRemoteRecords,
  joinRemoteLedger,
  pushRemoteMutation,
  removeRemoteSubscription,
  subscribeToRemoteLedger,
} from "./cloud";
import {
  applyParsedActions,
  removeLoan,
  removeProject,
  removeTransaction,
  restoreTransaction,
  updateLoanState,
  updateProjectState,
} from "./domain";
import { initialState } from "./seed";
import {
  createId,
  diffLedgerStates,
  generateSyncCode,
  hashSyncCode,
  isValidSyncCode,
  mergePendingMutations,
  normalizeSyncCode,
  recordsToState,
  stateToRecords,
  type PendingMutation,
} from "./sync";
import type {
  Budget,
  LedgerState,
  Loan,
  LoanChanges,
  ParsedAction,
  Project,
  ProjectChanges,
  Transaction,
  TransactionChanges,
} from "./types";

const STORAGE_KEY = "moss-ledger-state-v1";
const CLOUD_CONFIG_KEY = "moss-ledger-cloud-v1";
const PENDING_KEY = "moss-ledger-pending-v1";

export type SyncStatus = "disabled" | "connecting" | "syncing" | "synced" | "offline" | "error";

type CloudConfig = { ledgerId: string; syncCode: string };

type LedgerContextValue = {
  state: LedgerState;
  ready: boolean;
  syncStatus: SyncStatus;
  syncCode: string | null;
  syncError: string;
  pendingCount: number;
  lastSyncAt: string | null;
  createSyncLedger: () => Promise<string>;
  joinSyncLedger: (code: string) => Promise<void>;
  syncNow: () => Promise<void>;
  addTransaction: (value: Omit<Transaction, "id" | "createdAt">) => void;
  updateTransaction: (id: string, changes: TransactionChanges) => void;
  deleteTransaction: (id: string) => void;
  restoreDeletedTransaction: (transaction: Transaction) => void;
  addLoan: (value: Omit<Loan, "id">) => void;
  updateLoan: (id: string, changes: LoanChanges) => void;
  deleteLoan: (id: string) => void;
  repayLoan: (id: string, amount: number) => void;
  toggleLoan: (id: string) => void;
  addProject: (value: Omit<Project, "id">) => void;
  updateProject: (id: string, changes: ProjectChanges) => void;
  deleteProject: (id: string) => void;
  setBudgets: (budgets: Budget[]) => void;
  applyActions: (actions: ParsedAction[]) => void;
  resetDemo: () => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

function isLedgerState(value: unknown): value is LedgerState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LedgerState>;
  return Array.isArray(candidate.transactions) && Array.isArray(candidate.budgets) && Array.isArray(candidate.projects) && Array.isArray(candidate.loans);
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("invalid_sync_code")) return "同步码不存在，请检查后重试。";
  if (message.includes("ledger_access_denied")) return "当前设备无权访问这个账本。";
  if (!isOnline()) return "当前离线，记录已保存在本机，联网后会自动同步。";
  return "云同步暂时不可用，本机记录不会丢失，请稍后重试。";
}

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LedgerState>(initialState);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("disabled");
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const stateRef = useRef(state);
  const configRef = useRef<CloudConfig | null>(null);
  const queueRef = useRef<PendingMutation[]>([]);
  const flushingRef = useRef<Promise<void> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const replaceState = useCallback((next: LedgerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const persistQueue = useCallback(async () => {
    setPendingCount(queueRef.current.length);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(queueRef.current));
  }, []);

  const refreshFromCloud = useCallback(async () => {
    const config = configRef.current;
    if (!config || queueRef.current.length > 0) return;
    const records = await fetchRemoteRecords(config.ledgerId);
    if (queueRef.current.length > 0) return;
    const remoteState = recordsToState(records);
    
    const remoteTxIds = new Set(remoteState.transactions.map((t) => t.id));
    const localNewTxs = stateRef.current.transactions.filter((t) => !remoteTxIds.has(t.id));
    const remoteLoanIds = new Set(remoteState.loans.map((l) => l.id));
    const localNewLoans = stateRef.current.loans.filter((l) => !remoteLoanIds.has(l.id));
    const remoteProjectIds = new Set(remoteState.projects.map((p) => p.id));
    const localNewProjects = stateRef.current.projects.filter((p) => !remoteProjectIds.has(p.id));

    const mergedState: LedgerState = {
      transactions: [...localNewTxs, ...remoteState.transactions],
      budgets: remoteState.budgets.length > 0 ? remoteState.budgets : stateRef.current.budgets,
      projects: [...localNewProjects, ...remoteState.projects],
      loans: [...localNewLoans, ...remoteState.loans],
    };

    replaceState(mergedState);
    const syncedAt = new Date().toISOString();
    setLastSyncAt(syncedAt);
    setSyncStatus("synced");
    setSyncError("");
  }, [replaceState]);

  const startSubscription = useCallback(async (ledgerId: string) => {
    await removeRemoteSubscription(channelRef.current);
    channelRef.current = subscribeToRemoteLedger(
      ledgerId,
      () => { if (queueRef.current.length === 0) void refreshFromCloud().catch(() => undefined); },
      (status) => {
        if (status === "SUBSCRIBED" && queueRef.current.length === 0) setSyncStatus("synced");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSyncStatus(isOnline() ? "error" : "offline");
      },
    );
  }, [refreshFromCloud]);

  const flushQueue = useCallback(async (): Promise<void> => {
    if (flushingRef.current) return flushingRef.current;
    const config = configRef.current;
    if (!config) return;
    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    const task = (async () => {
      try {
        setSyncStatus(queueRef.current.length ? "syncing" : "connecting");
        await ensureAnonymousSession();
        while (true) {
          while (queueRef.current.length) {
            const mutation = queueRef.current[0];
            if (!mutation) break;
            await pushRemoteMutation(config.ledgerId, mutation);
            if (queueRef.current[0] === mutation) queueRef.current.shift();
            await persistQueue();
          }
          await refreshFromCloud();
          if (queueRef.current.length === 0) break;
        }
      } catch (error) {
        setSyncStatus(isOnline() ? "error" : "offline");
        setSyncError(errorMessage(error));
      } finally {
        flushingRef.current = null;
      }
    })();
    flushingRef.current = task;
    return task;
  }, [persistQueue, refreshFromCloud]);

  const enqueueMutations = useCallback((mutations: PendingMutation[]) => {
    if (!configRef.current || mutations.length === 0) return;
    queueRef.current = mergePendingMutations(queueRef.current, mutations);
    void persistQueue().then(() => flushQueue());
  }, [flushQueue, persistQueue]);

  const updateLocalState = useCallback((updater: (current: LedgerState) => LedgerState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      enqueueMutations(diffLedgerStates(current, next, new Date().toISOString()));
      return next;
    });
  }, [enqueueMutations]);

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(CLOUD_CONFIG_KEY),
      AsyncStorage.getItem(PENDING_KEY),
    ]).then(async ([savedState, savedConfig, savedQueue]) => {
      let local = initialState;
      try {
        const parsed = savedState ? JSON.parse(savedState) : null;
        if (isLedgerState(parsed)) local = parsed;
      } catch { /* Keep valid defaults. */ }
      if (!active) return;
      replaceState(local);

      try {
        const parsedConfig = savedConfig ? JSON.parse(savedConfig) as CloudConfig : null;
        if (parsedConfig?.ledgerId && parsedConfig.syncCode) {
          configRef.current = parsedConfig;
          setSyncCode(parsedConfig.syncCode);
          setSyncStatus("connecting");
        }
      } catch { /* Ignore invalid cloud configuration. */ }
      try {
        const parsedQueue = savedQueue ? JSON.parse(savedQueue) as PendingMutation[] : [];
        if (Array.isArray(parsedQueue)) queueRef.current = parsedQueue;
      } catch { /* Ignore invalid pending queue. */ }
      setPendingCount(queueRef.current.length);
      setReady(true);

      if (configRef.current) {
        await startSubscription(configRef.current.ledgerId);
        await flushQueue();
      }
    }).catch(() => setReady(true));

    const handleOnline = () => {
      void flushQueue();
      if (configRef.current) {
        void startSubscription(configRef.current.ledgerId);
      }
    };
    if (typeof globalThis.addEventListener === "function") globalThis.addEventListener("online", handleOnline);
    return () => {
      active = false;
      if (typeof globalThis.removeEventListener === "function") globalThis.removeEventListener("online", handleOnline);
      void removeRemoteSubscription(channelRef.current);
    };
  }, [flushQueue, replaceState, startSubscription]);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [ready, state]);

  const createSyncLedger = useCallback(async () => {
    setSyncStatus("connecting");
    setSyncError("");
    try {
      await ensureAnonymousSession();
      const code = generateSyncCode();
      const ledgerId = await createRemoteLedger(await hashSyncCode(code));
      const config = { ledgerId, syncCode: code };
      configRef.current = config;
      setSyncCode(code);
      await AsyncStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
      queueRef.current = stateToRecords(stateRef.current, new Date().toISOString()).map((item) => ({
        recordType: item.recordType,
        recordId: item.recordId,
        payload: item.payload,
        deleted: false,
        updatedAt: item.updatedAt,
      }));
      await persistQueue();
      await startSubscription(ledgerId);
      await flushQueue();
      return code;
    } catch (error) {
      setSyncStatus(isOnline() ? "error" : "offline");
      setSyncError(errorMessage(error));
      throw error;
    }
  }, [flushQueue, persistQueue, startSubscription]);

  const joinSyncLedger = useCallback(async (rawCode: string) => {
    const code = normalizeSyncCode(rawCode);
    if (!isValidSyncCode(code)) throw new Error("invalid_sync_code");
    setSyncStatus("connecting");
    setSyncError("");
    try {
      await ensureAnonymousSession();
      const ledgerId = await joinRemoteLedger(await hashSyncCode(code));
      const config = { ledgerId, syncCode: code };
      configRef.current = config;
      setSyncCode(code);
      queueRef.current = [];
      await Promise.all([
        AsyncStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config)),
        persistQueue(),
      ]);
      replaceState(recordsToState(await fetchRemoteRecords(ledgerId)));
      setLastSyncAt(new Date().toISOString());
      setSyncStatus("synced");
      await startSubscription(ledgerId);
    } catch (error) {
      setSyncStatus(isOnline() ? "error" : "offline");
      setSyncError(errorMessage(error));
      throw error;
    }
  }, [persistQueue, replaceState, startSubscription]);

  const syncNow = useCallback(async () => {
    if (!configRef.current) {
      await createSyncLedger();
      return;
    }
    setSyncError("");
    await flushQueue();
    if (queueRef.current.length === 0) await refreshFromCloud();
  }, [createSyncLedger, flushQueue, refreshFromCloud]);

  const addTransaction = useCallback((value: Omit<Transaction, "id" | "createdAt">) => {
    updateLocalState((current) => ({ ...current, transactions: [{ ...value, id: createId("tx"), createdAt: new Date().toISOString() }, ...current.transactions] }));
  }, [updateLocalState]);
  const updateTransaction = useCallback((id: string, changes: TransactionChanges) => {
    updateLocalState((current) => ({ ...current, transactions: current.transactions.map((item) => item.id === id ? { ...item, ...changes } : item) }));
  }, [updateLocalState]);
  const deleteTransaction = useCallback((id: string) => updateLocalState((current) => removeTransaction(current, id)), [updateLocalState]);
  const restoreDeletedTransaction = useCallback((transaction: Transaction) => updateLocalState((current) => restoreTransaction(current, transaction)), [updateLocalState]);
  const addLoan = useCallback((value: Omit<Loan, "id">) => updateLocalState((current) => ({ ...current, loans: [{ ...value, id: createId("loan") }, ...current.loans] })), [updateLocalState]);
  const updateLoan = useCallback((id: string, changes: LoanChanges) => updateLocalState((current) => updateLoanState(current, id, changes)), [updateLocalState]);
  const deleteLoan = useCallback((id: string) => updateLocalState((current) => removeLoan(current, id)), [updateLocalState]);
  const repayLoan = useCallback((id: string, amount: number) => {
    updateLocalState((current) => ({
      ...current,
      loans: current.loans.map((loan) => {
        if (loan.id !== id) return loan;
        const repaid = Math.min(loan.amount, Math.max(0, (loan.repaid || 0) + amount));
        return { ...loan, repaid, settled: repaid >= loan.amount };
      }),
    }));
  }, [updateLocalState]);
  const toggleLoan = useCallback((id: string) => updateLocalState((current) => ({ ...current, loans: current.loans.map((loan) => loan.id === id ? { ...loan, settled: !loan.settled, repaid: loan.settled ? 0 : loan.amount } : loan) })), [updateLocalState]);

  const addProject = useCallback((value: Omit<Project, "id">) => updateLocalState((current) => ({ ...current, projects: [...current.projects, { ...value, id: createId("project") }] })), [updateLocalState]);
  const updateProject = useCallback((id: string, changes: ProjectChanges) => updateLocalState((current) => updateProjectState(current, id, changes)), [updateLocalState]);
  const deleteProject = useCallback((id: string) => updateLocalState((current) => removeProject(current, id)), [updateLocalState]);

  const setBudgets = useCallback((budgets: Budget[]) => updateLocalState((current) => ({ ...current, budgets })), [updateLocalState]);
  const applyActions = useCallback((actions: ParsedAction[]) => updateLocalState((current) => applyParsedActions(current, actions)), [updateLocalState]);
  const resetDemo = useCallback(() => updateLocalState(() => initialState), [updateLocalState]);

  const value = useMemo(() => ({
    state, ready, syncStatus, syncCode, syncError, pendingCount, lastSyncAt,
    createSyncLedger, joinSyncLedger, syncNow,
    addTransaction, updateTransaction, deleteTransaction, restoreDeletedTransaction,
    addLoan, updateLoan, deleteLoan, repayLoan, toggleLoan,
    addProject, updateProject, deleteProject,
    setBudgets, applyActions, resetDemo,
  }), [
    state, ready, syncStatus, syncCode, syncError, pendingCount, lastSyncAt,
    createSyncLedger, joinSyncLedger, syncNow,
    addTransaction, updateTransaction, deleteTransaction, restoreDeletedTransaction,
    addLoan, updateLoan, deleteLoan, repayLoan, toggleLoan,
    addProject, updateProject, deleteProject,
    setBudgets, applyActions, resetDemo,
  ]);
  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) throw new Error("useLedger must be used within LedgerProvider");
  return context;
}
