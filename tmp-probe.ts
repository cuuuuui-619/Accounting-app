import { parseNaturalLanguage } from "./src/domain.ts";
const BASE = "2026-08-25";
const fmt = (input: string) => {
  const out = parseNaturalLanguage(input, BASE);
  return out.map((a) => a.type === "transaction"
    ? `TX{${a.value.kind} ${a.value.amount} "${a.value.title}" [${a.value.category}] ${a.value.date}${a.value.note ? ` note="${a.value.note}"` : ""}}`
    : a.type === "loan"
      ? `LOAN{${a.value.direction} ${a.value.person} ${a.value.amount} ${a.value.date}}`
      : `BUDGET{${a.value.category} ${a.value.amount}}`).join(" | ") || "(EMPTY)";
};
const list = [
  "花呗返现50元",
  "花呗红包返现50元",
  "支付宝退款99元",
  "微信支付退款99元",
  "购买理财收益到账300元",
  "付款失败退回200元",
  "工资花了8000元",
  "买东西报销500元",
  "转出给小李200元",
  "花呗还款1200元",
  "还花呗1200元",
  "一百零五元买书",
  "买书一百零五元",
  "买书两百零八元",
  "打车一千零五十元",
  "今天早上买早餐花了十二块然后打车到公司二十三块中午吃饭三十八",
  "早饭8块午饭25块晚饭30块",
  "找零五分",
  "买菜五分钱",
  "地铁4元打车30元",
  "大前天超市100元",
  "去年12月31日奖金5000元",
  "明年1月1号红包100元",
  "早上八点买早餐12元",
  "下午三点喝奶茶18元",
  "晚上7点吃饭68元",
  "五点半买咖啡28元",
  "打车30元车牌1234",
  "咖啡28元喝了2杯",
  "午饭38元和同事3个人",
  "买菜50元找零2块",
];
for (const s of list) console.log(`PROBE| ${s}\n  ACT  ${fmt(s)}`);
