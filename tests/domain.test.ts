import assert from "node:assert/strict";
import test from "node:test";

import { applyParsedActions, chineseNumberToValue, parseNaturalLanguage, periodTransactions, removeTransaction, restoreTransaction, totals } from "../src/domain.ts";
import { initialState } from "../src/seed.ts";

test("converts common Chinese money expressions", () => {
  assert.equal(chineseNumberToValue("六千"), 6000);
  assert.equal(chineseNumberToValue("五百"), 500);
  assert.equal(chineseNumberToValue("三十八"), 38);
  assert.equal(chineseNumberToValue("一千五"), 1500);
});

test("parses multiple voice bookkeeping actions", () => {
  const actions = parseNaturalLanguage("午饭38元，然后老王向我借了五百，这个月工资到账六千元", "2026-08-23");
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((item) => item.type), ["transaction", "loan", "transaction"]);
  assert.equal(actions[0]?.type === "transaction" && actions[0].value.amount, 38);
  assert.equal(actions[1]?.type === "loan" && actions[1].value.person, "老王");
  assert.equal(actions[2]?.type === "transaction" && actions[2].value.kind, "income");
});

test("parses a category budget", () => {
  const actions = parseNaturalLanguage("餐饮预算六百元", "2026-08-23");
  assert.deepEqual(actions, [{ type: "budget", value: { category: "餐饮美食", amount: 600 } }]);
});

test("recognizes voice-entered details, income or expense, and categories", () => {
  const actions = parseNaturalLanguage("午饭38元，地铁4元，工资到账8000元，买药68元", "2026-08-24");
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? {
    title: action.value.title,
    category: action.value.category,
    kind: action.value.kind,
    amount: action.value.amount,
  } : null), [
    { title: "午饭", category: "餐饮美食", kind: "expense", amount: 38 },
    { title: "地铁", category: "交通出行", kind: "expense", amount: 4 },
    { title: "工资", category: "工资收入", kind: "income", amount: 8000 },
    { title: "买药", category: "医疗健康", kind: "expense", amount: 68 },
  ]);
});

test("extracts merchant and a following detail clause into the transaction note", () => {
  const [action] = parseNaturalLanguage("在盒马买水果86.5元，给孩子准备的", "2026-08-24");
  assert.equal(action?.type, "transaction");
  if (action?.type !== "transaction") return;
  assert.equal(action.value.title, "水果");
  assert.equal(action.value.category, "餐饮美食");
  assert.equal(action.value.note, "盒马 · 给孩子准备的");
});

test("extracts destination, explicit notes, people, and income details", () => {
  const scenarios = [
    { input: "坐地铁去公司4元", title: "地铁", category: "交通出行", note: "去公司" },
    { input: "午饭38元备注和同事聚餐", title: "午饭", category: "餐饮美食", note: "和同事聚餐" },
    { input: "给客户打车花了36元", title: "打车", category: "交通出行", note: "给客户" },
    { input: "工资到账8000元，八月工资", title: "工资", category: "工资收入", note: "八月工资" },
  ];

  for (const scenario of scenarios) {
    const [action] = parseNaturalLanguage(scenario.input, "2026-08-24");
    assert.equal(action?.type, "transaction");
    if (action?.type !== "transaction") continue;
    assert.equal(action.value.title, scenario.title);
    assert.equal(action.value.category, scenario.category);
    assert.equal(action.value.note, scenario.note);
  }
});

test("leaves the note empty when the voice entry has no extra detail", () => {
  const [action] = parseNaturalLanguage("咖啡28元", "2026-08-24");
  assert.equal(action?.type, "transaction");
  if (action?.type !== "transaction") return;
  assert.equal(action.value.note, undefined);
});

test("does not attach a following no-amount clause to a loan", () => {
  const actions = parseNaturalLanguage("老王向我借了五百元，月底归还", "2026-08-24");
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.type, "loan");
  if (actions[0]?.type !== "loan") return;
  assert.equal("note" in actions[0].value, false);
});

test("uses the base day by default and resolves relative voice dates", () => {
  const actions = parseNaturalLanguage("咖啡28元，今天午饭38元，昨天打车20元，前天买药16元", "2026-08-24");
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? action.value.date : null), [
    "2026-08-24",
    "2026-08-24",
    "2026-08-23",
    "2026-08-22",
  ]);
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? action.value.note : null), [
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
});

test("resolves explicit Arabic and Chinese calendar dates", () => {
  const actions = parseNaturalLanguage("8月20日午饭38元，2025年12月31日奖金500元，二零二六年八月二十一号咖啡28元", "2026-08-24");
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? action.value.date : null), [
    "2026-08-20",
    "2025-12-31",
    "2026-08-21",
  ]);
});

test("keeps the base day for ambiguous or invalid date phrases", () => {
  const actions = parseNaturalLanguage("上周五午饭38元，2月30日咖啡28元", "2026-08-24");
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? action.value.date : null), [
    "2026-08-24",
    "2026-08-24",
  ]);
});

test("applies a resolved relative date to a voice-entered loan", () => {
  const [action] = parseNaturalLanguage("昨天老王向我借了五百元", "2026-08-24");
  assert.equal(action?.type, "loan");
  if (action?.type !== "loan") return;
  assert.equal(action.value.date, "2026-08-23");
});

test("recognizes explicit income direction and preserves its category", () => {
  const actions = parseNaturalLanguage("收到客户货款1200元，赚了300元，工资8000元，奖金500元，报销到账260元", "2026-08-24");
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? {
    kind: action.value.kind,
    category: action.value.category,
  } : null), [
    { kind: "income", category: "其它收入" },
    { kind: "income", category: "其它收入" },
    { kind: "income", category: "工资收入" },
    { kind: "income", category: "工资收入" },
    { kind: "income", category: "退款收入" },
  ]);
});

test("recognizes explicit expense direction without changing category rules", () => {
  const actions = parseNaturalLanguage("买日用品80元，付房租2000元，消费120元，转出给小李200元，花了60元，报销款转出给小李260元", "2026-08-24");
  assert.deepEqual(actions.map((action) => action.type === "transaction" ? {
    kind: action.value.kind,
    category: action.value.category,
  } : null), [
    { kind: "expense", category: "购物消费" },
    { kind: "expense", category: "居家缴费" },
    { kind: "expense", category: "其它" },
    { kind: "expense", category: "其它" },
    { kind: "expense", category: "其它" },
    { kind: "expense", category: "其它" },
  ]);
});

test("applies actions without mutating the previous state", () => {
  const before = initialState.transactions.length;
  const actions = parseNaturalLanguage("咖啡28元", "2026-08-23");
  const next = applyParsedActions(initialState, actions);
  assert.equal(initialState.transactions.length, before);
  assert.equal(next.transactions.length, before + 1);
  assert.equal(totals(next.transactions).expense, totals(initialState.transactions).expense + 28);
});

test("deletes and restores a transaction without changing the original state", () => {
  const target = initialState.transactions[0];
  assert.ok(target);
  const deleted = removeTransaction(initialState, target.id);
  assert.equal(deleted.transactions.some((item) => item.id === target.id), false);
  assert.equal(initialState.transactions.some((item) => item.id === target.id), true);
  const restored = restoreTransaction(deleted, target);
  assert.equal(restored.transactions[0]?.id, target.id);
});

test("uses different date ranges for month, term and year", () => {
  const base = initialState.transactions[0];
  assert.ok(base);
  const records = [
    { ...base, id: "aug", date: "2026-08-24" },
    { ...base, id: "jan", date: "2027-01-10" },
    { ...base, id: "feb", date: "2027-02-01" },
  ];
  const now = new Date("2026-08-24T12:00:00+08:00");
  assert.deepEqual(periodTransactions(records, "month", now).map((item) => item.id), ["aug"]);
  assert.deepEqual(periodTransactions(records, "term", now).map((item) => item.id), ["aug", "jan"]);
  assert.deepEqual(periodTransactions(records, "year", now).map((item) => item.id), ["aug"]);
});

test("accurately recognizes colloquial Chinese amounts and fractional units", () => {
  assert.equal(chineseNumberToValue("3块5"), 3.5);
  assert.equal(chineseNumberToValue("3块半"), 3.5);
  assert.equal(chineseNumberToValue("三块五"), 3.5);
  assert.equal(chineseNumberToValue("三块半"), 3.5);
  assert.equal(chineseNumberToValue("5毛"), 0.5);
  assert.equal(chineseNumberToValue("五毛"), 0.5);
  assert.equal(chineseNumberToValue("8角"), 0.8);
  assert.equal(chineseNumberToValue("八角"), 0.8);
  assert.equal(chineseNumberToValue("3块8毛5分"), 3.85);
  assert.equal(chineseNumberToValue("1.5万"), 15000);
  assert.equal(chineseNumberToValue("3.5千"), 3500);
  assert.equal(chineseNumberToValue("两万三"), 23000);
  assert.equal(chineseNumberToValue("两百五"), 250);
  assert.equal(chineseNumberToValue("一百零八块五"), 108.5);
  assert.equal(chineseNumberToValue("一百块零五分"), 100.05);
});

test("accurately parses amounts, categories, accounts, and dates in voice bookkeeping", () => {
  const actions = parseNaturalLanguage(
    "昨晚在海底捞吃火锅消费了280元用微信支付的，今天早上买包子豆浆3块5付现金，前天在淘宝买羽绒服699元用支付宝，刚才兼职收入稿费500元已到账银行卡",
    "2026-08-25"
  );
  assert.equal(actions.length, 4);

  assert.equal(actions[0]?.type, "transaction");
  if (actions[0]?.type === "transaction") {
    assert.equal(actions[0].value.title, "火锅");
    assert.equal(actions[0].value.category, "餐饮美食");
    assert.equal(actions[0].value.amount, 280);
    assert.equal(actions[0].value.date, "2026-08-24");
    assert.equal(actions[0].value.account, "微信");
    assert.equal(actions[0].value.note, "海底捞");
  }

  assert.equal(actions[1]?.type, "transaction");
  if (actions[1]?.type === "transaction") {
    assert.equal(actions[1].value.title, "包子");
    assert.equal(actions[1].value.category, "餐饮美食");
    assert.equal(actions[1].value.amount, 3.5);
    assert.equal(actions[1].value.date, "2026-08-25");
    assert.equal(actions[1].value.account, "现金");
    assert.equal(actions[1].value.note, "豆浆");
  }

  assert.equal(actions[2]?.type, "transaction");
  if (actions[2]?.type === "transaction") {
    assert.equal(actions[2].value.title, "羽绒服");
    assert.equal(actions[2].value.category, "购物消费");
    assert.equal(actions[2].value.amount, 699);
    assert.equal(actions[2].value.date, "2026-08-23");
    assert.equal(actions[2].value.account, "支付宝");
    assert.equal(actions[2].value.note, "淘宝");
  }

  assert.equal(actions[3]?.type, "transaction");
  if (actions[3]?.type === "transaction") {
    assert.equal(actions[3].value.title, "稿费");
    assert.equal(actions[3].value.category, "兼职收入");
    assert.equal(actions[3].value.kind, "income");
    assert.equal(actions[3].value.amount, 500);
    assert.equal(actions[3].value.date, "2026-08-25");
    assert.equal(actions[3].value.account, "银行卡");
  }
});

test("accurately recognizes account increase (加钱/收入) vs account decrease (减钱/支出)", () => {
  const testCases = [
    // Account Increase (收入/增加/加钱)
    { input: "账户增加了500元", kind: "income", amount: 500 },
    { input: "微信钱包多了100元", kind: "income", amount: 100 },
    { input: "存入银行卡2000元", kind: "income", amount: 2000 },
    { input: "收到客户付款1200元", kind: "income", amount: 1200 },
    { input: "收到老王转账300元", kind: "income", amount: 300 },
    { input: "卖了旧手机800元", kind: "income", amount: 800 },
    { input: "收红包200元", kind: "income", amount: 200 },
    { input: "微信抢红包50元", kind: "income", amount: 50 },
    { input: "彩票中奖1000元", kind: "income", amount: 1000 },
    { input: "基金分红200元", kind: "income", amount: 200 },
    { input: "收到退款80元", kind: "income", amount: 80 },
    { input: "报销款到账500元", kind: "income", amount: 500 },

    // Account Decrease (支出/减少/减钱)
    { input: "账户减少了200元", kind: "expense", amount: 200 },
    { input: "话费扣了30元", kind: "expense", amount: 30 },
    { input: "取现500元", kind: "expense", amount: 500 },
    { input: "转账给老王500元", kind: "expense", amount: 500 },
    { input: "给小李发红包100元", kind: "expense", amount: 100 },
    { input: "买了二手手机800元", kind: "expense", amount: 800 },
    { input: "充值话费100元", kind: "expense", amount: 100 },
    { input: "交房租2500元", kind: "expense", amount: 2500 },
    { input: "退款转出给客户50元", kind: "expense", amount: 50 },
    { input: "违章罚款200元", kind: "expense", amount: 200 },
  ];

  for (const item of testCases) {
    const [action] = parseNaturalLanguage(item.input, "2026-08-25");
    assert.equal(action?.type, "transaction", `Failed on input: ${item.input}`);
    if (action?.type === "transaction") {
      assert.equal(action.value.kind, item.kind, `Wrong kind on input: ${item.input}`);
      assert.equal(action.value.amount, item.amount, `Wrong amount on input: ${item.input}`);
    }
  }
});

test("accurately distinguishes loan direction (借入 vs 借出)", () => {
  const [lent1] = parseNaturalLanguage("借给老王五百元", "2026-08-25");
  assert.equal(lent1?.type, "loan");
  if (lent1?.type === "loan") {
    assert.equal(lent1.value.direction, "lent");
    assert.equal(lent1.value.person, "老王");
    assert.equal(lent1.value.amount, 500);
  }

  const [lent2] = parseNaturalLanguage("昨天老王向我借了五百元", "2026-08-25");
  assert.equal(lent2?.type, "loan");
  if (lent2?.type === "loan") {
    assert.equal(lent2.value.direction, "lent");
    assert.equal(lent2.value.person, "老王");
  }

  const [borrowed1] = parseNaturalLanguage("我向老王借了五百元", "2026-08-25");
  assert.equal(borrowed1?.type, "loan");
  if (borrowed1?.type === "loan") {
    assert.equal(borrowed1.value.direction, "borrowed");
    assert.equal(borrowed1.value.person, "老王");
    assert.equal(borrowed1.value.amount, 500);
  }

  const [borrowed2] = parseNaturalLanguage("老王借给我五百元", "2026-08-25");
  assert.equal(borrowed2?.type, "loan");
  if (borrowed2?.type === "loan") {
    assert.equal(borrowed2.value.direction, "borrowed");
    assert.equal(borrowed2.value.person, "老王");
  }
});

test("accurately recognizes direct +/- and 加/减 spoken phrases and compound sentences", () => {
  // Direct 加/减 and +/- phrases
  const directCases = [
    { input: "加500", kind: "income", amount: 500 },
    { input: "加五百", kind: "income", amount: 500 },
    { input: "加钱500", kind: "income", amount: 500 },
    { input: "+500", kind: "income", amount: 500 },
    { input: "+ 500", kind: "income", amount: 500 },
    { input: "微信加500", kind: "income", amount: 500, account: "微信" },
    { input: "微信+500", kind: "income", amount: 500, account: "微信" },
    { input: "微信进了500", kind: "income", amount: 500, account: "微信" },
    { input: "微信进500", kind: "income", amount: 500, account: "微信" },
    { input: "减200", kind: "expense", amount: 200 },
    { input: "减两百", kind: "expense", amount: 200 },
    { input: "减钱200", kind: "expense", amount: 200 },
    { input: "-200", kind: "expense", amount: 200 },
    { input: "- 200", kind: "expense", amount: 200 },
    { input: "支付宝减200", kind: "expense", amount: 200, account: "支付宝" },
    { input: "支付宝-200", kind: "expense", amount: 200, account: "支付宝" },
    { input: "微信出了200", kind: "expense", amount: 200, account: "微信" },
    { input: "微信出200", kind: "expense", amount: 200, account: "微信" },
    { input: "出账200元", kind: "expense", amount: 200 },
    { input: "入账500元", kind: "income", amount: 500 },
  ];

  for (const item of directCases) {
    const [action] = parseNaturalLanguage(item.input, "2026-08-25");
    assert.equal(action?.type, "transaction", `Failed on input: ${item.input}`);
    if (action?.type === "transaction") {
      assert.equal(action.value.kind, item.kind, `Wrong kind on input: ${item.input}`);
      assert.equal(action.value.amount, item.amount, `Wrong amount on input: ${item.input}`);
      if (item.account) {
        assert.equal(action.value.account, item.account, `Wrong account on input: ${item.input}`);
      }
    }
  }

  // Continuous speech phrases separated by space or conjunctions
  const compoundActions1 = parseNaturalLanguage("加500 减200", "2026-08-25");
  assert.equal(compoundActions1.length, 2);
  assert.equal(compoundActions1[0]?.type === "transaction" && compoundActions1[0].value.kind, "income");
  assert.equal(compoundActions1[0]?.type === "transaction" && compoundActions1[0].value.amount, 500);
  assert.equal(compoundActions1[1]?.type === "transaction" && compoundActions1[1].value.kind, "expense");
  assert.equal(compoundActions1[1]?.type === "transaction" && compoundActions1[1].value.amount, 200);

  const compoundActions2 = parseNaturalLanguage("微信加500 支付宝减200", "2026-08-25");
  assert.equal(compoundActions2.length, 2);
  assert.equal(compoundActions2[0]?.type === "transaction" && compoundActions2[0].value.account, "微信");
  assert.equal(compoundActions2[0]?.type === "transaction" && compoundActions2[0].value.kind, "income");
  assert.equal(compoundActions2[1]?.type === "transaction" && compoundActions2[1].value.account, "支付宝");
  assert.equal(compoundActions2[1]?.type === "transaction" && compoundActions2[1].value.kind, "expense");

  const compoundActions3 = parseNaturalLanguage("+500 -200", "2026-08-25");
  assert.equal(compoundActions3.length, 2);
  assert.equal(compoundActions3[0]?.type === "transaction" && compoundActions3[0].value.kind, "income");
  assert.equal(compoundActions3[1]?.type === "transaction" && compoundActions3[1].value.kind, "expense");
});

test("accurately recognizes 他人给钱/长辈给钱 (income) vs 给他人/孝敬长辈 (expense)", () => {
  // User's specific scenario: "昨天爷爷给了我1000块钱"
  const [grandpaIncome] = parseNaturalLanguage("昨天爷爷给了我1000块钱", "2026-08-25");
  assert.equal(grandpaIncome?.type, "transaction");
  if (grandpaIncome?.type === "transaction") {
    assert.equal(grandpaIncome.value.kind, "income");
    assert.equal(grandpaIncome.value.amount, 1000);
    assert.equal(grandpaIncome.value.date, "2026-08-24");
    assert.equal(grandpaIncome.value.category, "人情往来");
    assert.equal(grandpaIncome.value.title, "爷爷");
    assert.equal(grandpaIncome.value.note, undefined);
  }

  // Giving money to grandpa: "我给了爷爷1000块钱" -> expense
  const [grandpaExpense] = parseNaturalLanguage("我给了爷爷1000块钱", "2026-08-25");
  assert.equal(grandpaExpense?.type, "transaction");
  if (grandpaExpense?.type === "transaction") {
    assert.equal(grandpaExpense.value.kind, "expense");
    assert.equal(grandpaExpense.value.amount, 1000);
    assert.equal(grandpaExpense.value.category, "人情往来");
    assert.equal(grandpaExpense.value.title, "爷爷");
  }

  // Mom giving living expenses: "妈妈给我转了500元生活费" -> income
  const [momIncome] = parseNaturalLanguage("妈妈给我转了500元生活费", "2026-08-25");
  assert.equal(momIncome?.type, "transaction");
  if (momIncome?.type === "transaction") {
    assert.equal(momIncome.value.kind, "income");
    assert.equal(momIncome.value.amount, 500);
    assert.equal(momIncome.value.category, "人情往来");
    assert.equal(momIncome.value.title, "生活费");
    assert.equal(momIncome.value.note, "妈妈");
  }

  // Friend sending red packet: "朋友送了我200元红包" -> income
  const [friendIncome] = parseNaturalLanguage("朋友送了我200元红包", "2026-08-25");
  assert.equal(friendIncome?.type, "transaction");
  if (friendIncome?.type === "transaction") {
    assert.equal(friendIncome.value.kind, "income");
    assert.equal(friendIncome.value.amount, 200);
    assert.equal(friendIncome.value.category, "人情往来");
    assert.equal(friendIncome.value.title, "红包");
    assert.equal(friendIncome.value.note, "朋友");
  }

  // User's specific scenario: "爷爷给我了1000块钱"
  const [grandpaIncome2] = parseNaturalLanguage("爷爷给我了1000块钱", "2026-08-25");
  assert.equal(grandpaIncome2?.type, "transaction");
  if (grandpaIncome2?.type === "transaction") {
    assert.equal(grandpaIncome2.value.kind, "income");
    assert.equal(grandpaIncome2.value.amount, 1000);
    assert.equal(grandpaIncome2.value.category, "人情往来");
    assert.equal(grandpaIncome2.value.title, "爷爷");
    assert.equal(grandpaIncome2.value.note, undefined);
  }

  // Red packet from grandpa: "爷爷发了我1000元红包" -> income
  const [grandpaPacket] = parseNaturalLanguage("爷爷发了我1000元红包", "2026-08-25");
  assert.equal(grandpaPacket?.type, "transaction");
  if (grandpaPacket?.type === "transaction") {
    assert.equal(grandpaPacket.value.kind, "income");
    assert.equal(grandpaPacket.value.amount, 1000);
    assert.equal(grandpaPacket.value.category, "人情往来");
    assert.equal(grandpaPacket.value.title, "红包");
    assert.equal(grandpaPacket.value.note, "爷爷");
  }
});




