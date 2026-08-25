import type { LedgerState } from "./types";

const now = new Date();
const iso = (offset = 0) => {
  const date = new Date(now);
  date.setDate(now.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const baseTime = now.getTime();

export const initialState: LedgerState = {
  transactions: [
    { id: "seed-1", kind: "expense", amount: 38, title: "奶茶两杯", category: "餐饮美食", date: iso(0), channel: "语音记账", createdAt: new Date(baseTime - 1000).toISOString() },
    { id: "seed-2", kind: "income", amount: 6000, title: "工资", category: "薪资收入", date: iso(-1), channel: "语音记账", createdAt: new Date(baseTime - 2000).toISOString() },
    { id: "seed-3", kind: "expense", amount: 25, title: "打车", category: "交通出行", date: iso(-1), channel: "语音记账", createdAt: new Date(baseTime - 3000).toISOString() },
  ],
  budgets: [
    { category: "餐饮美食", amount: 800 },
    { category: "交通出行", amount: 300 },
    { category: "购物消费", amount: 500 },
    { category: "休闲娱乐", amount: 300 },
    { category: "居家缴费", amount: 600 },
  ],
  projects: [
    { id: "project-1", name: "柠檬摊", description: "周末小摊的投入与收益", target: 160 },
  ],
  loans: [
    { id: "loan-1", person: "老王", direction: "lent", amount: 500, repaid: 0, date: iso(0), settled: false },
  ],
};
