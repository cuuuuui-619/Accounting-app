import assert from "node:assert/strict";
import test from "node:test";

import {
  diffLedgerStates,
  generateSyncCode,
  isValidSyncCode,
  mergePendingMutations,
  recordsToState,
  stateToRecords,
} from "../src/sync.ts";
import { initialState } from "../src/seed.ts";

test("generates a readable high-entropy private sync code", () => {
  const bytes = Uint8Array.from({ length: 15 }, (_, index) => index);
  const code = generateSyncCode(bytes);
  assert.match(code, /^[A-Z2-9]{5}(?:-[A-Z2-9]{5}){3}$/);
  assert.equal(isValidSyncCode(code.toLowerCase()), true);
  assert.equal(isValidSyncCode("SHORT-CODE"), false);
});

test("maps every ledger collection to stable cloud records and back", () => {
  const records = stateToRecords(initialState, "2026-08-24T05:00:00.000Z");
  assert.equal(records.length, initialState.transactions.length + initialState.budgets.length + initialState.projects.length + initialState.loans.length);
  assert.deepEqual(recordsToState(records), initialState);
});

test("diff creates an idempotent tombstone for delete and an upsert for restore", () => {
  const target = initialState.transactions[0];
  assert.ok(target);
  const deletedState = { ...initialState, transactions: initialState.transactions.slice(1) };
  const deleted = diffLedgerStates(initialState, deletedState, "2026-08-24T05:01:00.000Z");
  assert.deepEqual(deleted, [{
    recordType: "transaction",
    recordId: target.id,
    payload: null,
    deleted: true,
    updatedAt: "2026-08-24T05:01:00.000Z",
  }]);

  const restored = diffLedgerStates(deletedState, initialState, "2026-08-24T05:02:00.000Z");
  assert.equal(restored[0]?.deleted, false);
  assert.deepEqual(restored[0]?.payload, target);
  assert.deepEqual(mergePendingMutations([...deleted, ...deleted], restored), restored);
});

test("remote tombstones are excluded while current records are reduced", () => {
  const records = stateToRecords(initialState, "2026-08-24T05:00:00.000Z");
  const target = records.find((record) => record.recordType === "transaction");
  assert.ok(target);
  const remote = records.map((record) => record === target ? { ...record, payload: null, deletedAt: "2026-08-24T05:03:00.000Z" } : record);
  const state = recordsToState(remote);
  assert.equal(state.transactions.some((item) => item.id === target.recordId), false);
});
