export type TransactionKind = "expense" | "income";

export type TransactionAccount = "微信" | "支付宝" | "银行卡" | "现金" | "其他";

export type Transaction = {
  id: string;
  kind: TransactionKind;
  amount: number;
  title: string;
  category: string;
  date: string;
  account?: TransactionAccount;
  note?: string;
  channel?: string;
  projectId?: string;
  createdAt: string;
};

export type TransactionChanges = Pick<Transaction, "kind" | "amount" | "title" | "category" | "date" | "account" | "note">;

export type Budget = {
  category: string;
  amount: number;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  target: number;
};

export type Loan = {
  id: string;
  person: string;
  direction: "lent" | "borrowed";
  amount: number;
  repaid: number;
  date: string;
  settled: boolean;
};

export type LedgerState = {
  transactions: Transaction[];
  budgets: Budget[];
  projects: Project[];
  loans: Loan[];
};

export type ParsedAction =
  | { type: "transaction"; value: Omit<Transaction, "id" | "createdAt"> }
  | { type: "loan"; value: Omit<Loan, "id"> }
  | { type: "budget"; value: Budget };
