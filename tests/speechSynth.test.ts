import assert from "node:assert/strict";
import test from "node:test";

import { generateVoiceReply, isSpeechSynthesisSupported, speakChinese, stopSpeaking } from "../src/speechSynth.ts";
import type { ParsedAction } from "../src/types.ts";

test("generates polite guide when no actions are recognized", () => {
  const reply = generateVoiceReply([]);
  assert.match(reply, /没有听清具体的账目或金额/);
});

test("generates natural voice reply for a single expense", () => {
  const actions: ParsedAction[] = [
    {
      type: "transaction",
      value: {
        kind: "expense",
        amount: 38,
        title: "肯德基",
        category: "餐饮美食",
        date: "2026-08-25",
        account: "微信",
        note: "午饭",
      },
    },
  ];

  const autoReply = generateVoiceReply(actions, true);
  assert.equal(autoReply, "好的，已为您记下一笔餐饮美食消费 38元（肯德基），使用微信，备注午饭。");

  const previewReply = generateVoiceReply(actions, false);
  assert.equal(previewReply, "好的，识别到一笔餐饮美食消费 38元（肯德基），使用微信，备注午饭。");
});

test("generates natural voice reply for a single income", () => {
  const actions: ParsedAction[] = [
    {
      type: "transaction",
      value: {
        kind: "income",
        amount: 6000,
        title: "工资",
        category: "工资收入",
        date: "2026-08-25",
        account: "银行卡",
      },
    },
  ];

  const reply = generateVoiceReply(actions, true);
  assert.equal(reply, "好的，已为您记下一笔工资收入收入 6000元，使用银行卡。");
});

test("generates natural voice reply for a loan action", () => {
  const actions: ParsedAction[] = [
    {
      type: "loan",
      value: {
        direction: "lent",
        person: "老王",
        amount: 500,
        repaid: 0,
        date: "2026-08-25",
        settled: false,
      },
    },
  ];

  const reply = generateVoiceReply(actions, true);
  assert.equal(reply, "好的，已为您记下借给老王 500元。");
});

test("generates aggregated voice reply for multiple compound actions", () => {
  const actions: ParsedAction[] = [
    {
      type: "transaction",
      value: { kind: "expense", amount: 35, title: "午饭", category: "餐饮美食", date: "2026-08-25" },
    },
    {
      type: "transaction",
      value: { kind: "expense", amount: 18, title: "打车", category: "交通出行", date: "2026-08-25" },
    },
    {
      type: "transaction",
      value: { kind: "income", amount: 200, title: "红包", category: "人情往来", date: "2026-08-25" },
    },
    {
      type: "loan",
      value: { direction: "lent", person: "张三", amount: 100, repaid: 0, date: "2026-08-25", settled: false },
    },
  ];

  const reply = generateVoiceReply(actions, true);
  assert.equal(reply, "好的，已为您记下共 4 笔记录，包含支出 53元、收入 200元、1笔借贷。");
});

test("handles speech synthesis safely in node environment", () => {
  // In Node.js environment without window/globalThis.speechSynthesis
  assert.equal(isSpeechSynthesisSupported(), false);
  assert.equal(speakChinese("测试语音"), false);
  assert.doesNotThrow(() => stopSpeaking());
});
