import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initialState } from "../src/seed.ts";
import { diffLedgerStates, recordsToState, stateToRecords } from "../src/sync.ts";

test("editing produces one cloud upsert with the original record identity", () => {
  const target = initialState.transactions[0];
  assert.ok(target);
  const edited = {
    ...target,
    kind: "income" as const,
    amount: 188.5,
    title: "报销到账",
    category: "报销收入",
    date: "2026-08-20",
    account: "银行卡" as const,
    note: "客户项目交通费",
  };
  const next = {
    ...initialState,
    transactions: initialState.transactions.map((item) => item.id === target.id ? edited : item),
  };

  const mutations = diffLedgerStates(initialState, next, "2026-08-24T08:00:00.000Z");

  assert.equal(mutations.length, 1);
  assert.equal(mutations[0]?.recordType, "transaction");
  assert.equal(mutations[0]?.recordId, target.id);
  assert.equal(mutations[0]?.deleted, false);
  assert.equal(mutations[0]?.payload?.id, target.id);
  assert.equal(mutations[0]?.payload?.createdAt, target.createdAt);
  assert.equal(mutations[0]?.payload?.account, "银行卡");
  assert.equal(mutations[0]?.payload?.note, "客户项目交通费");
});

test("legacy transactions without an account still round-trip through cloud records", () => {
  const records = stateToRecords(initialState, "2026-08-24T08:00:00.000Z");
  const restored = recordsToState(records);
  assert.equal(restored.transactions.length, initialState.transactions.length);
  assert.equal(restored.transactions.every((item) => item.account === undefined), true);
});

test("transaction types allow an optional account without exposing identity fields to edits", () => {
  const source = readFileSync("src/types.ts", "utf8");
  assert.match(source, /export type TransactionAccount = "微信" \| "支付宝" \| "银行卡" \| "现金" \| "其他"/);
  assert.match(source, /account\?: TransactionAccount/);
  assert.match(source, /TransactionChanges = Pick<Transaction, "kind" \| "amount" \| "title" \| "category" \| "date" \| "account" \| "note">/);
});

test("store exposes an in-place transaction update through the existing sync pipeline", () => {
  const source = readFileSync("src/store.tsx", "utf8");
  assert.match(source, /updateTransaction: \(id: string, changes: TransactionChanges\) => void/);
  assert.match(source, /const updateTransaction = useCallback/);
  assert.match(source, /transactions: current\.transactions\.map\(\(item\) => item\.id === id \? \{ \.\.\.item, \.\.\.changes \} : item\)/);
  assert.match(source, /addTransaction, updateTransaction, deleteTransaction, restoreDeletedTransaction/);
});

test("details screen provides complete edit, cancel, delete, and restore controls", () => {
  const source = readFileSync("src/screens/MainScreens.tsx", "utf8");
  assert.match(source, /accessibilityLabel=\{`编辑\$\{item\.title\}`\}/);
  assert.match(source, /updateTransaction\(editingTransaction\.id, \{/);
  for (const label of ["金额", "名称 / 商户", "分类", "日期", "账户", "备注"]) {
    assert.match(source, new RegExp(`label="${label}"`));
  }
  assert.match(source, /transactionCategories\[editKind\]\.map/);
  assert.match(source, /accounts\.map\(\(item\) => <Chip key=\{item\} label=\{item\} active=\{editAccount === item\}/);
  assert.match(source, /account: editAccount/);
  assert.match(source, /label="支出" active=\{editKind === "expense"\}/);
  assert.match(source, /label="收入" active=\{editKind === "income"\}/);
  assert.match(source, /label="取消" onPress=\{cancelEdit\}/);
  assert.match(source, /label="保存修改"/);
  assert.match(source, /deleteTransaction\(item\.id\)/);
  assert.match(source, /restoreDeletedTransaction\(recentlyDeleted\)/);
});

test("the existing add-record screen captures complete bookkeeping details", () => {
  const source = readFileSync("src/screens/MainScreens.tsx", "utf8");
  assert.match(source, /const transactionCategories: Record<TransactionKind, string\[]>/);
  for (const category of ["餐饮美食", "医疗健康", "教育学习", "工资收入", "报销退款", "投资理财"]) {
    assert.match(source, new RegExp(`"${category}"`));
  }
  assert.match(source, /const accounts: TransactionAccount\[] = \["微信", "支付宝", "银行卡", "现金", "其他"\]/);
  assert.match(source, /function localDateValue\(date = new Date\(\)\)/);
  assert.match(source, /date\.getTimezoneOffset\(\)/);
  assert.match(source, /const \[date, setDate\] = useState\(localDateValue\(\)\)/);
  assert.match(source, /isValidDate\(date\)/);
  assert.match(source, /transactionCategories\[kind\]\.map/);
  for (const label of ["金额", "名称 / 商户", "交易日期", "账户", "备注"]) {
    assert.match(source, new RegExp(`label="${label}"`));
  }
  assert.match(source, /addTransaction\(\{ kind, amount: amountValue, title: title\.trim\(\), category, date, account, note: note\.trim\(\) \|\| undefined, channel: "手动记账" \}\)/);
});

test("details cards show account and a one-line note summary with a legacy fallback", () => {
  const source = readFileSync("src/screens/MainScreens.tsx", "utf8");
  assert.match(source, /item\.account \?\? "未设置账户"/);
  assert.match(source, /item\.note \? <Text numberOfLines=\{1\} style=\{styles\.noteSummary\}>\{item\.note\}<\/Text> : null/);
});

test("voice preview shows the resolved transaction date before saving", () => {
  const source = readFileSync("src/screens/MainScreens.tsx", "utf8");
  assert.match(source, /return `\$\{action\.value\.kind[\s\S]{0,300}\$\{action\.value\.date\}/);
});
