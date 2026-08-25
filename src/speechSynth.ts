import type { ParsedAction } from "./types";

export function isSpeechSynthesisSupported(): boolean {
  return typeof globalThis !== "undefined" && typeof (globalThis as any).speechSynthesis !== "undefined";
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    try {
      (globalThis as any).speechSynthesis.cancel();
    } catch {
      // 忽略语音引擎异常
    }
  }
}

export function speakChinese(text: string, onEnd?: () => void): boolean {
  if (!isSpeechSynthesisSupported() || !text.trim()) return false;
  try {
    const synth = (globalThis as any).speechSynthesis;
    synth.cancel();

    const utterance = new (globalThis as any).SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function generateVoiceReply(
  actions: ParsedAction[],
  autoCommitted: boolean = true
): string {
  if (!actions || actions.length === 0) {
    return "抱歉，没有听清具体的账目或金额，您可以再说一次，例如：午饭38元用微信支付。";
  }

  const verb = autoCommitted ? "已为您记下" : "识别到";

  if (actions.length === 1) {
    const action = actions[0]!;
    if (action.type === "transaction") {
      const { kind, amount, category, title, account, note } = action.value;
      const accountPhrase = account ? `，使用${account}` : "";
      const notePhrase = note ? `，备注${note}` : "";
      const formattedAmount = `${amount}元`;

      if (kind === "income") {
        return `好的，${verb}一笔${category}收入 ${formattedAmount}${accountPhrase}${notePhrase}。`;
      }
      return `好的，${verb}一笔${category}消费 ${formattedAmount}（${title}）${accountPhrase}${notePhrase}。`;
    }

    if (action.type === "loan") {
      const { direction, person, amount } = action.value;
      const actionDirection = direction === "lent" ? `借给${person}` : `向${person}借入`;
      return `好的，${verb}${actionDirection} ${amount}元。`;
    }

    if (action.type === "budget") {
      const { category, amount } = action.value;
      return `好的，${verb}${category}月度预算 ${amount}元。`;
    }
  }

  // 多笔账目聚合总结
  let expenseSum = 0;
  let incomeSum = 0;
  let loanCount = 0;
  let budgetCount = 0;

  for (const act of actions) {
    if (act.type === "transaction") {
      if (act.value.kind === "income") incomeSum += act.value.amount;
      else expenseSum += act.value.amount;
    } else if (act.type === "loan") {
      loanCount++;
    } else if (act.type === "budget") {
      budgetCount++;
    }
  }

  const summaryParts: string[] = [];
  if (expenseSum > 0) summaryParts.push(`支出 ${Math.round(expenseSum * 100) / 100}元`);
  if (incomeSum > 0) summaryParts.push(`收入 ${Math.round(incomeSum * 100) / 100}元`);
  if (loanCount > 0) summaryParts.push(`${loanCount}笔借贷`);
  if (budgetCount > 0) summaryParts.push(`${budgetCount}项预算`);

  return `好的，${verb}共 ${actions.length} 笔记录，包含${summaryParts.join("、")}。`;
}
