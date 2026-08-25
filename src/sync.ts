import type { Budget, LedgerState, Loan, Project, Transaction } from "./types";

export type RecordType = "transaction" | "budget" | "project" | "loan";

export type CloudRecord = {
  recordType: RecordType;
  recordId: string;
  payload: Record<string, unknown> | null;
  deletedAt?: string | null;
  updatedAt: string;
};

export type PendingMutation = {
  recordType: RecordType;
  recordId: string;
  payload: Record<string, unknown> | null;
  deleted: boolean;
  updatedAt: string;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECORD_ORDER: Record<RecordType, number> = { transaction: 0, budget: 1, project: 2, loan: 3 };
const BUDGET_ORDER = ["餐饮美食", "交通出行", "购物消费", "休闲娱乐", "居家缴费"];

export function normalizeSyncCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  return compact.match(/.{1,5}/g)?.join("-") ?? "";
}

export function isValidSyncCode(value: string): boolean {
  return /^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/.test(normalizeSyncCode(value));
}

export function generateSyncCode(bytes?: Uint8Array): string {
  const source = bytes ?? globalThis.crypto.getRandomValues(new Uint8Array(15));
  if (source.length < 15) throw new Error("At least 15 random bytes are required");
  let code = "";
  for (let index = 0; index < 20; index += 1) {
    const byte = source[index % source.length] ?? 0;
    code += CODE_ALPHABET[(byte + index * 17) % CODE_ALPHABET.length];
  }
  return normalizeSyncCode(code);
}

export async function hashSyncCode(value: string): Promise<string> {
  const normalized = normalizeSyncCode(value).replaceAll("-", "");
  if (!isValidSyncCode(normalized)) throw new Error("invalid_sync_code");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function record(recordType: RecordType, recordId: string, payload: Record<string, unknown>, updatedAt: string): CloudRecord {
  return { recordType, recordId, payload, updatedAt, deletedAt: null };
}

export function stateToRecords(state: LedgerState, updatedAt: string): CloudRecord[] {
  return [
    ...state.transactions.map((item) => record("transaction", item.id, item, updatedAt)),
    ...state.budgets.map((item) => record("budget", item.category, item, updatedAt)),
    ...state.projects.map((item) => record("project", item.id, item, updatedAt)),
    ...state.loans.map((item) => record("loan", item.id, item, updatedAt)),
  ];
}

function activePayloads(records: CloudRecord[], type: RecordType): Record<string, unknown>[] {
  return records
    .filter((item) => item.recordType === type && !item.deletedAt && item.payload)
    .sort((left, right) => left.recordId.localeCompare(right.recordId))
    .map((item) => item.payload as Record<string, unknown>);
}

export function recordsToState(records: CloudRecord[]): LedgerState {
  const transactions = activePayloads(records, "transaction") as Transaction[];
  transactions.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const budgets = activePayloads(records, "budget") as Budget[];
  budgets.sort((left, right) => {
    const leftIndex = BUDGET_ORDER.indexOf(left.category);
    const rightIndex = BUDGET_ORDER.indexOf(right.category);
    if (leftIndex < 0 && rightIndex < 0) return left.category.localeCompare(right.category);
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  });
  return {
    transactions,
    budgets,
    projects: activePayloads(records, "project") as Project[],
    loans: activePayloads(records, "loan") as Loan[],
  };
}

function keyOf(record: Pick<CloudRecord, "recordType" | "recordId">): string {
  return `${record.recordType}:${record.recordId}`;
}

export function diffLedgerStates(before: LedgerState, after: LedgerState, updatedAt: string): PendingMutation[] {
  const previous = new Map(stateToRecords(before, updatedAt).map((item) => [keyOf(item), item]));
  const next = new Map(stateToRecords(after, updatedAt).map((item) => [keyOf(item), item]));
  const mutations: PendingMutation[] = [];

  for (const [key, current] of next) {
    const prior = previous.get(key);
    if (!prior || JSON.stringify(prior.payload) !== JSON.stringify(current.payload)) {
      mutations.push({ recordType: current.recordType, recordId: current.recordId, payload: current.payload, deleted: false, updatedAt });
    }
  }
  for (const [key, prior] of previous) {
    if (!next.has(key)) {
      mutations.push({ recordType: prior.recordType, recordId: prior.recordId, payload: null, deleted: true, updatedAt });
    }
  }
  return mutations.sort((left, right) => RECORD_ORDER[left.recordType] - RECORD_ORDER[right.recordType] || left.recordId.localeCompare(right.recordId));
}

export function mergePendingMutations(current: PendingMutation[], incoming: PendingMutation[]): PendingMutation[] {
  const merged = new Map<string, PendingMutation>();
  for (const mutation of [...current, ...incoming]) {
    const key = keyOf(mutation);
    const existing = merged.get(key);
    if (!existing || mutation.updatedAt >= existing.updatedAt) merged.set(key, mutation);
  }
  return [...merged.values()].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
}
