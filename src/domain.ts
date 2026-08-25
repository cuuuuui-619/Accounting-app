import { createId } from "./sync.ts";
import type { LedgerState, ParsedAction, Transaction, TransactionAccount, TransactionKind } from "./types";

const CN_DIGITS: Record<string, number> = {
  "零": 0, "〇": 0, "○": 0, "一": 1, "二": 2, "两": 2, "俩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
};
const CN_UNITS: Record<string, number> = { "十": 10, "拾": 10, "百": 100, "佰": 100, "千": 1000, "仟": 1000, "万": 10000, "亿": 100000000 };

function parseChinesePositionalNumber(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);

  let total = 0;
  let section = 0;
  let digit = 0;
  let lastUnit = 1;
  let hasUnit = false;
  let afterZero = false;

  for (const char of trimmed) {
    if (char === "零" || char === "〇" || char === "○") {
      afterZero = true;
      digit = 0;
      continue;
    }
    if (char in CN_DIGITS) {
      digit = CN_DIGITS[char] ?? 0;
      continue;
    }
    const unit = CN_UNITS[char];
    if (!unit) continue;
    hasUnit = true;
    lastUnit = unit;
    afterZero = false;
    if (unit === 10000 || unit === 100000000) {
      section = (section + digit) * unit;
      total += section;
      section = 0;
    } else {
      section += (digit || 1) * unit;
    }
    digit = 0;
  }
  const colloquialTail = digit > 0 && lastUnit >= 100 && hasUnit && !afterZero ? digit * (lastUnit / 10) : digit;
  return total + section + colloquialTail;
}

export function chineseNumberToValue(input: string): number {
  const clean = input
    .replace(/^[+\-＋－加增减]/g, "")
    .replace(/[人民币¥￥\s]/g, "")
    .replace(/块钱/g, "块")
    .replace(/元/g, "块")
    .replace(/角/g, "毛");
  if (!clean) return 0;

  if (/^\d+(?:\.\d+)?$/.test(clean)) return Number(clean);

  const arabicWanMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(万|千)$/);
  if (arabicWanMatch) {
    const factor = arabicWanMatch[2] === "万" ? 10000 : 1000;
    return Math.round(Number(arabicWanMatch[1]) * factor * 100) / 100;
  }

  if (clean.includes("点")) {
    const [intPart = "", decPart = ""] = clean.split("点");
    const intVal = parseChinesePositionalNumber(intPart.replace(/块$/, ""));
    const cleanDec = decPart.replace(/块$/, "");
    let decVal = 0;
    if (/^\d+$/.test(cleanDec)) {
      decVal = Number(`0.${cleanDec}`);
    } else {
      let decStr = "";
      for (const char of cleanDec) {
        if (char in CN_DIGITS) {
          decStr += String(CN_DIGITS[char]);
        }
      }
      if (decStr) {
        decVal = Number(`0.${decStr}`);
      } else {
        const parsed = parseChinesePositionalNumber(cleanDec);
        decVal = Number(`0.${parsed}`);
      }
    }
    return Math.round((intVal + decVal) * 100) / 100;
  }

  if (/块半$/.test(clean)) {
    const mainStr = clean.slice(0, -2);
    const mainVal = parseChinesePositionalNumber(mainStr);
    return Math.round((mainVal + 0.5) * 100) / 100;
  }

  if (clean.includes("块")) {
    const [mainPart = "", subPart = ""] = clean.split("块");
    const mainVal = parseChinesePositionalNumber(mainPart);
    if (!subPart) return mainVal;

    let dime = 0;
    let cent = 0;
    const isLeadingZero = subPart.startsWith("零") || subPart.startsWith("〇") || subPart.startsWith("○");
    const cleanSub = subPart.replace(/^[零〇○]/, "");
    if (cleanSub.includes("毛")) {
      const [dimePart = "", centPart = ""] = cleanSub.split("毛");
      dime = parseChinesePositionalNumber(dimePart);
      if (centPart) {
        cent = parseChinesePositionalNumber(centPart.replace(/分$/, ""));
      }
    } else if (cleanSub.includes("分")) {
      cent = parseChinesePositionalNumber(cleanSub.replace(/分$/, ""));
    } else {
      if (isLeadingZero) {
        const subVal = /^\d+$/.test(cleanSub) ? Number(cleanSub) : parseChinesePositionalNumber(cleanSub);
        cent = subVal;
      } else if (/^\d+$/.test(cleanSub)) {
        if (cleanSub.length === 1) dime = Number(cleanSub);
        else if (cleanSub.length === 2) {
          dime = Number(cleanSub[0]);
          cent = Number(cleanSub[1]);
        }
      } else {
        const subVal = parseChinesePositionalNumber(cleanSub);
        if (subVal < 10) dime = subVal;
        else if (subVal < 100) {
          dime = Math.floor(subVal / 10);
          cent = subVal % 10;
        }
      }
    }
    return Math.round((mainVal + dime * 0.1 + cent * 0.01) * 100) / 100;
  }

  if (clean.includes("毛")) {
    const [dimePart = "", centPart = ""] = clean.split("毛");
    const dime = parseChinesePositionalNumber(dimePart);
    let cent = 0;
    if (centPart) {
      cent = parseChinesePositionalNumber(centPart.replace(/分$/, ""));
    }
    return Math.round((dime * 0.1 + cent * 0.01) * 100) / 100;
  }

  if (clean.endsWith("分")) {
    const cent = parseChinesePositionalNumber(clean.slice(0, -1));
    return Math.round(cent * 0.01 * 100) / 100;
  }

  return Math.round(parseChinesePositionalNumber(clean) * 100) / 100;
}

const amountPattern = /(?:[+\-＋－增减加])?\s*(?:人民币|[¥￥])?\s*(?:(?:\d+(?:\.\d+)?|[零一二两俩三四五六七八九十百千万]+(?:[点.]\s*[零一二两俩三四五六七八九\d]+)?)\s*(?:万|千|块钱|块|元)(?:\s*(?:半|(?:零\s*)?(?:\d+|[零一二两俩三四五六七八九]+)\s*(?:毛|角)?(?:\s*(?:\d+|[零一二两俩三四五六七八九]+)\s*分)?))|(?:\d+|[零一二两俩三四五六七八九]+)\s*(?:毛|角)(?:\s*(?:\d+|[零一二两俩三四五六七八九]+)\s*分)?|(?:\d+|[零一二两俩三四五六七八九]+)\s*分|(?:\d+(?:\.\d+)?|[零一二两俩三四五六七八九十百千万]+(?:[点.]\s*[零一二两俩三四五六七八九\d]+)?)\s*(?:元|块钱|块)?)/g;

export function extractAmounts(text: string): number[] {
  return [...text.matchAll(amountPattern)]
    .map((match) => chineseNumberToValue(match[0] ?? "0"))
    .filter((amount) => amount > 0);
}

type CategoryRule = { category: string; keywords: string[] };

const EXPENSE_RULES: CategoryRule[] = [
  {
    category: "餐饮美食",
    keywords: [
      "早餐", "早饭", "午餐", "午饭", "中餐", "中饭", "晚餐", "晚饭", "夜宵", "宵夜", "外卖", "餐饮", "吃饭", "下馆子", "请客", "聚餐", "堂食",
      "奶茶", "咖啡", "饮料", "喝茶", "下午茶", "可乐", "果汁", "冰淇淋", "甜品", "蛋糕", "面包", "点心", "零食", "小吃", "水果",
      "买菜", "菜场", "蔬菜", "猪肉", "牛肉", "羊肉", "鸡蛋", "海鲜", "火锅", "烧烤", "烤肉", "炸鸡", "汉堡", "披萨", "面条", "米线", "螺蛳粉", "快餐", "寿司", "包子", "油条", "豆浆", "饺子",
      "海底捞", "星巴克", "瑞幸", "喜茶", "奈雪", "蜜雪冰城", "麦当劳", "肯德基", "盒马", "叮咚买菜",
    ],
  },
  {
    category: "交通出行",
    keywords: [
      "打车", "出租车", "网约车", "滴滴", "曹操", "高德打车", "拼车", "顺风车", "快车", "专车",
      "地铁", "公交", "公交车", "巴士", "乘车", "刷卡", "乘车码", "轮渡",
      "高铁", "动车", "火车", "飞机", "机票", "航班", "船票", "车票", "12306",
      "加油", "充电", "停车", "停车费", "过路费", "高速费", "ETC", "洗车", "修车", "保养", "年检", "罚单", "违章",
      "共享单车", "单车", "哈啰", "美团单车", "电动车", "租车", "代驾",
    ],
  },
  {
    category: "医疗健康",
    keywords: [
      "买药", "药店", "医药", "配药", "处方", "药房", "感冒药", "消炎药", "止痛药", "胃药", "口罩", "创可贴", "消毒",
      "医院", "看病", "门诊", "急诊", "挂号", "挂号费", "体检", "化验", "检查", "抽血", "拍片", "CT", "住院",
      "牙医", "牙科", "补牙", "拔牙", "洗牙", "正畸", "视力", "配镜", "眼镜", "隐形眼镜", "心理咨询", "中医", "针灸",
    ],
  },
  {
    category: "居家缴费",
    keywords: [
      "房租", "租房", "物业", "物业费", "水费", "电费", "燃气", "燃气费", "煤气", "天然气", "暖气", "暖气费",
      "话费", "电话费", "手机充值", "网费", "宽带", "宽带费", "电视费",
      "保洁", "家政", "阿姨", "钟点工", "维修", "换锁", "开锁", "疏通", "搬家", "装修", "家具", "沙发", "床", "家居", "日杂", "五金",
    ],
  },
  {
    category: "教育学习",
    keywords: [
      "学费", "课程", "书本", "买书", "课本", "教材", "考试", "报名费", "培训", "补习", "辅导班", "网课", "考研", "考公", "考证", "驾校", "学车", "文具", "打印", "复印",
    ],
  },
  {
    category: "休闲娱乐",
    keywords: [
      "电影", "影院", "看电影", "电影票", "剧场", "话剧", "音乐会", "演唱会", "演出", "门票", "展览", "游乐园", "迪士尼", "环球影城",
      "游戏", "充值", "抽卡", "皮肤", "Steam", "Switch", "PlayStation", "网吧", "网咖", "电竞",
      "KTV", "唱歌", "酒吧", "清吧", "剧本杀", "密室", "桌游", "洗浴", "温泉", "按摩", "捏脚", "足疗", "SPA", "采耳",
      "旅游", "旅行", "住宿", "酒店", "民宿", "景点", "门票",
      "健身", "健身房", "游泳", "瑜伽", "私教", "运动", "羽毛球", "篮球", "足球", "滑雪", "滑冰", "骑行", "钓鱼",
      "宠物", "猫粮", "狗粮", "猫砂", "宠物医院", "驱虫", "疫苗",
      "会员", "VIP", "爱奇艺", "腾讯视频", "优酷", "B站", "网易云", "QQ音乐", "Spotify", "订阅",
    ],
  },
  {
    category: "人情往来",
    keywords: [
      "红包", "礼物", "送礼", "份子钱", "礼金", "压岁钱", "随礼", "结婚随礼", "满月礼", "白事", "请客", "犒劳", "答谢", "孝敬父母", "孝敬长辈", "孝敬",
      "长辈", "爷爷", "奶奶", "外公", "外婆", "爸爸", "妈妈", "父母", "叔叔", "阿姨", "舅舅", "姑姑", "伯伯", "婶婶", "生活费", "零花钱", "过节费",
    ],
  },
  {
    category: "购物消费",
    keywords: [
      "羽绒服", "衣服", "裤子", "鞋", "帽子", "裙子", "外套", "T恤", "卫衣", "衬衫", "内衣", "袜子", "包", "背包", "皮带", "首饰", "手表", "项链", "耳环", "戒指",
      "日用品", "纸巾", "洗发水", "沐浴露", "洗衣液", "牙膏", "护肤品", "化妆品", "口红", "面膜", "防晒", "香水",
      "数码", "手机", "iPhone", "华为", "小米", "电脑", "笔记本", "iPad", "平板", "耳机", "充电器", "键盘", "鼠标", "家电", "冰箱", "洗衣机", "空调", "电视",
      "淘宝", "京东", "拼多多", "唯品会", "天猫", "得物", "闲鱼", "抖音商城",
      "超市", "便利店", "商场", "百货", "山姆", "Costco", "屈臣氏",
      "购物", "网购", "买了", "购买",
    ],
  },
];

const INCOME_RULES: CategoryRule[] = [
  { category: "工资收入", keywords: ["奖金", "年终奖", "季度奖", "绩效", "提成", "补贴", "津贴", "加班费", "工资", "薪资", "薪水", "发工资"] },
  { category: "兼职收入", keywords: ["稿费", "讲课费", "咨询费", "跑腿", "劳务费", "佣金", "副业", "外快", "兼职"] },
  { category: "理财收益", keywords: ["利息", "分红", "收益", "基金", "股票", "投资", "理财", "结息", "房租收入", "租金收入"] },
  { category: "退款收入", keywords: ["报销", "退款", "返现", "押金退还", "差价退款", "补贴到账"] },
  {
    category: "人情往来",
    keywords: [
      "压岁钱", "红包", "份子钱", "礼金", "过节费", "零花钱", "生活费", "压岁",
      "爷爷", "奶奶", "外公", "外婆", "爸爸", "妈妈", "父母", "长辈", "叔叔", "阿姨", "舅舅", "姑姑", "伯伯", "婶婶",
      "亲友赠予", "长辈给的",
    ],
  },
];

function matchRule(text: string, rules: CategoryRule[]): { category: string; title: string } | null {
  for (const rule of rules) {
    const title = rule.keywords.find((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
    if (title) return { category: rule.category, title };
  }
  return null;
}

function classify(text: string): { kind: TransactionKind; category: string; title: string } {
  const trimmed = text.trim();

  // Explicit "+" or "-" (e.g. "+500", "-200", "微信+500", "支付宝-200", "+ 50", "- 30")
  if (/[+＋]/.test(trimmed)) {
    const income = matchRule(trimmed, INCOME_RULES);
    return { kind: "income", category: income?.category ?? "其它收入", title: income?.title ?? "收入" };
  }
  if (/[\-－]/.test(trimmed)) {
    const expense = matchRule(trimmed, EXPENSE_RULES);
    return expense ? { kind: "expense", ...expense } : { kind: "expense", category: "其它", title: "支出" };
  }

  // Priority 1: Strong incoming / Receiving money / Given to me by elders/others / Income
  // E.g., "爷爷给了我1000块钱", "妈妈给我转了500", "朋友送了我红包", "收到客户付款", "收到货款", "进账", "到账", "存入", "赚了"
  const strongIncomePattern = /(?:给了我|给我了|给我的?|转给我|转了我|打给我|汇给我|发给我|送给我|塞给我|寄给我|还给我|付给我|结给我|转账给我|(?:长辈|父母|爸妈|爸爸|妈妈|爷爷|奶奶|外公|外婆|叔叔|阿姨|姑姑|舅舅|朋友|同学|同事|领导|老板|客户|亲戚)(?:给|转|发|送|打|汇|塞|还|付|结)(?:了|我|了我|给我)|收到.*(?:付款|货款|款项|转账|红包|退款|还款|生活费|零花钱|钱)|收款|收钱|收了|收回|收下|收账|收\s*[\d零一二两俩三四五六七八九十百千万]|进账|进帐|入账|入帐|到账|到帐|到手|进钱|进了|进\s*[\d零一二两俩三四五六七八九十百千万]|回款|转入|转进|汇入|账户增加|增加了?|加钱|加款|加\s*[\d零一二两俩三四五六七八九十百千万]|多了|存入|存款|存钱|存了|赚(?:了|到)?|盈利|获利|净赚|卖(?:了|出)?|售出|变卖|中奖|抢红包|抢到|收红包|发工资|发薪水|发了奖金|发了补贴|发了年终奖)/;
  if (strongIncomePattern.test(trimmed)) {
    const income = matchRule(trimmed, INCOME_RULES);
    return { kind: "income", category: income?.category ?? "其它收入", title: income?.title ?? "收入" };
  }

  // Priority 2: Strong outgoing money / Transfer-out / Gifts / Deductions / Spending
  const strongExpensePattern = /(?:转出|转走|汇出|转账?给(?!我)|汇款给(?!我)|给[\u4e00-\u9fa5A-Za-z0-9_]+转|发红包|送红包|包红包|随份子|随礼|送礼|退款转出|报销款转出|出账|出帐|出了\s*[\d零一二两俩三四五六七八九十百千万]|出\s*[\d零一二两俩三四五六七八九十百千万]|我(?:给|转|发|送|打|付)(?!了我|给我)|孝敬)/;
  if (strongExpensePattern.test(trimmed)) {
    const expense = matchRule(trimmed, EXPENSE_RULES);
    return expense ? { kind: "expense", ...expense } : { kind: "expense", category: "其它", title: "支出" };
  }

  // Priority 3: General Expense direction words (Account decrease / spending / deducting / paying)
  const expenseDirection = /(?:账户减少|减少了?|减钱|减\s*[\d零一二两俩三四五六七八九十百千万]|少了|少掉|扣(?:款|费|除|了)?|自动扣款|自动扣费|花(?:了|费|去|掉)?|用(?:了|掉|去)?|买(?:了)?|购买|付(?:了|款|钱)?|支付|付款|付\s*[\d零一二两俩三四五六七八九十百千万]|消费(?:了)?|支出|充值|交(?:了|纳|清)?|缴(?:了|纳|清)?|缴纳|付清|买单|结账|续费|罚款|被罚|赔偿|违约金|丢了|亏(?:了|损)?|取现|取款|取了|取\s*[\d零一二两俩三四五六七八九十百千万])/.test(trimmed);

  // Priority 4: General Income direction words (Salary / Refunds / Dividends / Benefits)
  const incomeDirection = /(?:收入|收益|发工资|提成|奖金|补贴|津贴|退款|报销|返现|退还|退回|利息|分红|结息)/.test(trimmed);

  if (expenseDirection && !incomeDirection) {
    const expense = matchRule(trimmed, EXPENSE_RULES);
    return expense ? { kind: "expense", ...expense } : { kind: "expense", category: "其它", title: "支出" };
  }

  const income = matchRule(trimmed, INCOME_RULES);
  if (income || incomeDirection) {
    if (/转出|转走|扣款|扣费|支出|花费|付/.test(trimmed) && !/收到|进账|到账|退款|报销|加|存|给了我|转给我/.test(trimmed)) {
      return { kind: "expense", category: "其它", title: "支出" };
    }
    return { kind: "income", category: income?.category ?? "其它收入", title: income?.title ?? "收入" };
  }

  const expense = matchRule(trimmed, EXPENSE_RULES);
  if (expense) return { kind: "expense", ...expense };
  return { kind: "expense", category: "其它", title: "日常记录" };
}

type DateParts = { year: number; month: number; day: number };

function localDateKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function datePartsFromKey(date: string): DateParts | undefined {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidDate(parts) ? parts : undefined;
}

export function isValidDate(value: DateParts | string): boolean {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    return isValidDate({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
  }
  const { year, month, day } = value;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateKey({ year, month, day }: DateParts): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calendarNumberToValue(input: string): number {
  if (/^\d+$/.test(input)) return Number(input);
  const normalized = input.replace(/[〇○]/g, "零").replace(/两/g, "二");
  if (/^[零一二三四五六七八九]+$/.test(normalized)) {
    return Number([...normalized].map((digit) => CN_DIGITS[digit] ?? 0).join(""));
  }
  return chineseNumberToValue(normalized);
}

function removeDateMatch(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return `${text.slice(0, start)} ${text.slice(start + match[0].length)}`.trim();
}

function shiftDate(date: DateParts, days: number): string {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return dateKey({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}

function resolveEntryDate(text: string, fallbackDate: string): { entry: string; date: string } {
  const fallbackParts = datePartsFromKey(fallbackDate);
  if (!fallbackParts) return { entry: text, date: fallbackDate };

  const fullDate = text.match(/([0-9零〇○一二两三四五六七八九十百千万]{2,4})年\s*([0-9零〇○一二两三四五六七八九十百千万]{1,3})月\s*([0-9零〇○一二两三四五六七八九十百千万]{1,3})(?:日|号)/);
  if (fullDate) {
    const parts = {
      year: calendarNumberToValue(fullDate[1] ?? "0"),
      month: calendarNumberToValue(fullDate[2] ?? "0"),
      day: calendarNumberToValue(fullDate[3] ?? "0"),
    };
    return isValidDate(parts)
      ? { entry: removeDateMatch(text, fullDate), date: dateKey(parts) }
      : { entry: text, date: fallbackDate };
  }

  const monthDay = text.match(/([0-9零〇○一二两三四五六七八九十]{1,3})月\s*([0-9零〇○一二两三四五六七八九十]{1,3})(?:日|号)/);
  if (monthDay) {
    const parts = {
      year: fallbackParts.year,
      month: calendarNumberToValue(monthDay[1] ?? "0"),
      day: calendarNumberToValue(monthDay[2] ?? "0"),
    };
    return isValidDate(parts)
      ? { entry: removeDateMatch(text, monthDay), date: dateKey(parts) }
      : { entry: text, date: fallbackDate };
  }

  const relativeDate = text.match(/大前天|大前日|前天早上|前天上午|前天中午|前天下午|前天晚上|前天|前日|昨天早上|昨天上午|昨天中午|昨天下午|昨天晚上|昨晚|昨夜|昨早|昨天|昨日|今天早上|今天上午|今天中午|今天下午|今天晚上|今早|今晚|今晨|今天|今日|刚才|刚刚|明天早上|明天上午|明天中午|明天下午|明天晚上|明天|明日|后天|后日/);
  if (relativeDate) {
    const matched = relativeDate[0];
    let offset = 0;
    if (/大前天|大前日/.test(matched)) offset = -3;
    else if (/前天|前日/.test(matched)) offset = -2;
    else if (/昨天|昨日|昨晚|昨夜|昨早/.test(matched)) offset = -1;
    else if (/明天|明日/.test(matched)) offset = 1;
    else if (/后天|后日/.test(matched)) offset = 2;
    return { entry: removeDateMatch(text, relativeDate), date: shiftDate(fallbackParts, offset) };
  }

  return { entry: text, date: fallbackDate };
}

function accountingAmount(text: string): number | undefined {
  const matches = [...text.matchAll(amountPattern)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const raw = match?.[0]?.trim() ?? "";
    if (!raw) continue;
    const end = (match?.index ?? 0) + raw.length;
    const followingText = text.slice(end).trimStart();
    const hasMoneyMarker = /[+\-＋－加减]|人民币|[¥￥]|元|块钱|块|毛|角|分|万|千/.test(raw);

    if (!hasMoneyMarker && /^[年月日号点时分周岁笔个件条只本张套间双次袋瓶盒箱]/.test(followingText)) continue;

    const amount = chineseNumberToValue(raw);
    if (amount > 0) return amount;
  }
  return undefined;
}

const ACCOUNT_PATTERNS: Array<{ account: TransactionAccount; pattern: RegExp }> = [
  { account: "微信", pattern: /微信(?:支付|转账|付款|扫码|钱包|账户)?|用微信|微\s*信/ },
  { account: "支付宝", pattern: /支付宝(?:支付|转账|付款|扫码|钱包|账户)?|花呗|用支付宝|支\s*付\s*宝/ },
  { account: "银行卡", pattern: /银行卡|信用卡|储蓄卡|刷卡|招商银行|工商银行|建设银行|农业银行|中国银行|卡里|银\s*行\s*卡/ },
  { account: "现金", pattern: /现金|付现|现\s*金/ },
  { account: "其他", pattern: /其他账户/ },
];

function extractAccount(text: string): { account?: TransactionAccount } {
  for (const { account, pattern } of ACCOUNT_PATTERNS) {
    if (pattern.test(text)) {
      return { account };
    }
  }
  return {};
}

function splitExplicitDetail(text: string): { entry: string; detail?: string } {
  const match = text.match(/^(.*?)(?:备注|明细|用途)(?:是|为)?\s*[:：]?\s*(.+)$/);
  if (!match) return { entry: text };
  return { entry: match[1]?.trim() ?? text, detail: match[2]?.trim() };
}

function normalizeNoteFragment(text?: string): string | undefined {
  const normalized = text
    ?.replace(/^(?:备注|明细|用途)(?:是|为)?\s*[:：]?\s*/, "")
    .replace(/^[，。；、,;\s]+|[，。；、,;\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || undefined;
}

function extractMainDetail(text: string, title: string): string | undefined {
  let detail = text.replace(amountPattern, " ");
  if (title && title !== "日常记录" && title !== "收入" && title !== "支出") {
    detail = detail.split(title).join(" ");
  }

  detail = detail
    .replace(/(?:用|通过|扫码)?(?:微信|支付宝)(?:支付|转账|付款|扫码|钱包|账户)?/g, " ")
    .replace(/(?:用|刷)?(?:银行卡|信用卡|储蓄卡|招商银行|工商银行|建设银行|农业银行|中国银行)(?:支付|付款|刷卡)?/g, " ")
    .replace(/(?:付|给|用)?现金/g, " ")
    .replace(/(?:给我转了|给我转|给我打了|给我打|给我发了|给我发|给我送了|给我送|给我付了|给我付|给我还了|给我还|给我结了|给我结|转账给我|转给我|转了我|打给我|打了我|汇给我|汇了我|发给我|发了我|送给我|送了我|塞给我|塞了我|寄给我|寄了我|还给我|还了我|付给我|付了我|结给我|结了我|给了我|给我了|给我的|送我|转了|打了|发了|送了|塞了|寄了|还了|结了|转账|汇款|给我|给了|我给)/g, " ")
    .replace(/账户增加(?:了)?|账户减少(?:了)?|增加(?:了)?|减少(?:了)?|加钱|减钱|加款|多了|少了|存入(?:了)?|存款|存钱|取现|取款|取了|扣(?:款|费|除|了)?|自动扣款/g, " ")
    .replace(/花了|花费|花去|花掉|用去|用掉|消费了?|支付了?|付款了?|付了?|购买了?|买了?|坐了?|乘坐|搭乘|到账了?|到帐了?|收到了?|收款了?|收钱了?|收了|赚了?|进账了?|入账了?|出账了?|转出了?|转入了?|支出了?|充值了?|交了/g, " ")
    .replace(/吃了?|喝了?|点了?|用了?|使用|通过|扫码|转账|付现/g, " ")
    .replace(/(?:今天|今日|昨天|昨日|昨晚|昨夜|昨早|前天|大前天|刚才|刚刚|这次|这笔|早上|上午|中午|下午|晚上|夜里|凌晨|傍晚|清晨)\s*/g, " ")
    .replace(/^[+\-＋－加增减]/g, "")
    .replace(/^在(?=[\u4e00-\u9fa5A-Za-z0-9])/, "")
    .replace(/(?:^|\s+)[的了](?:\s+|$)/g, " ")
    .replace(/[，。；、,;:：]+/g, " ");

  return normalizeNoteFragment(detail);
}

function combineNotes(...fragments: Array<string | undefined>): string | undefined {
  const unique = fragments
    .flatMap((fragment) => fragment?.split(" · ") ?? [])
    .map((fragment) => normalizeNoteFragment(fragment))
    .filter((fragment): fragment is string => Boolean(fragment))
    .filter((fragment, index, all) => all.indexOf(fragment) === index);
  return unique.length > 0 ? unique.join(" · ") : undefined;
}

function appendDetailToPreviousTransaction(actions: ParsedAction[], detail: string): void {
  const previous = actions.at(-1);
  if (previous?.type !== "transaction") return;
  previous.value.note = combineNotes(previous.value.note, detail);
}

export function parseNaturalLanguage(text: string, date = localDateKey()): ParsedAction[] {
  const normalized = text
    .replace(/[，。；、！？!?\n\r]/g, ",")
    .replace(/(?:然后|还有|另外|并且|接着|同时|再记|再来)/g, ",")
    .replace(/(?<=(?:\d+|[零一二两俩三四五六七八九十百千万]+)(?:元|块钱|块|角|毛|分)?)\s+(?=[+\-＋－加减进出收付]|收入|支出|进账|入账|出账|账户|微信|支付宝|银行卡|现金|[^\d零一二两俩三四五六七八九十百千万¥￥\s]{2,})/g, ",");

  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  const actions: ParsedAction[] = [];
  let contextualDate = date;
  let pendingPrefixDetail: string | undefined = undefined;

  for (const part of parts) {
    const { entry: datedEntry, detail: explicitDetail } = splitExplicitDetail(part);
    const { entry, date: entryDate } = resolveEntryDate(datedEntry, contextualDate);
    const amount = accountingAmount(entry);
    if (!amount) {
      if (entryDate !== contextualDate) {
        contextualDate = entryDate;
      }
      const followingDetail = combineNotes(entry, explicitDetail);
      if (actions.length > 0) {
        if (followingDetail) appendDetailToPreviousTransaction(actions, followingDetail);
      } else if (followingDetail) {
        pendingPrefixDetail = combineNotes(pendingPrefixDetail, followingDetail);
      }
      continue;
    }

    const effectiveDate = entryDate !== date ? entryDate : contextualDate;

    const loanMatch = entry.match(
      /(?:借给|借了给)\s*([^\d零一二两俩三四五六七八九十百千万¥￥元块角毛分\s]{1,6})|([^\d零一二两俩三四五六七八九十百千万¥￥元块角毛分\s]{1,6})\s*(?:向我借|借给我)|(?:我向|向)\s*([^\d零一二两俩三四五六七八九十百千万¥￥元块角毛分\s]{1,6})\s*借/
    );
    if (loanMatch || /(?:向[\u4e00-\u9fa5]+借|向我借|借给我|我借了|借入|借出|借给)/.test(entry)) {
      const rawPerson = loanMatch?.[1] ?? loanMatch?.[2] ?? loanMatch?.[3] ?? "未命名";
      const person = rawPerson.replace(/^(?:昨天|前天|今天|昨晚|刚才)/, "").trim() || "未命名";
      const isLent = /(?:向我借|借给(?!我)|借出)/.test(entry);
      const isBorrow = !isLent && /(?:我向|借给我|我借了|借入)/.test(entry);
      actions.push({ type: "loan", value: { person, direction: isBorrow ? "borrowed" : "lent", amount, repaid: 0, date: effectiveDate, settled: false } });
      continue;
    }

    const budgetCategory = ["餐饮美食", "交通出行", "购物消费", "休闲娱乐", "居家缴费"].find((item) => entry.includes(item.slice(0, 2)));
    if (/预算/.test(entry) && budgetCategory) {
      actions.push({ type: "budget", value: { category: budgetCategory, amount } });
      continue;
    }

    const { account } = extractAccount(entry);
    const result = classify(entry);
    const note = combineNotes(pendingPrefixDetail, extractMainDetail(entry, result.title), explicitDetail);
    pendingPrefixDetail = undefined;
    actions.push({
      type: "transaction",
      value: {
        ...result,
        amount,
        date: effectiveDate,
        ...(account ? { account } : {}),
        channel: "AI 语音记账",
        ...(note ? { note } : {}),
      },
    });
  }
  return actions;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthTransactions(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((item) => monthKey(item.date) === month);
}

export function periodTransactions(transactions: Transaction[], period: "month" | "term" | "year", now = new Date()): Transaction[] {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (period === "month") return monthTransactions(transactions, `${year}-${String(month).padStart(2, "0")}`);
  if (period === "year") return transactions.filter((item) => item.date >= `${year}-01-01` && item.date <= `${year}-12-31`);

  const startsInPreviousYear = month === 1;
  const startYear = startsInPreviousYear ? year - 1 : year;
  const startMonth = month >= 8 || month === 1 ? 8 : 2;
  const endYear = startMonth === 8 ? startYear + 1 : startYear;
  const endMonth = startMonth === 8 ? 1 : 7;
  const endDay = new Date(endYear, endMonth, 0).getDate();
  const start = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-${endDay}`;
  return transactions.filter((item) => item.date >= start && item.date <= end);
}

export function removeTransaction(state: LedgerState, id: string): LedgerState {
  return { ...state, transactions: state.transactions.filter((item) => item.id !== id) };
}

export function restoreTransaction(state: LedgerState, transaction: Transaction): LedgerState {
  if (state.transactions.some((item) => item.id === transaction.id)) return state;
  return { ...state, transactions: [transaction, ...state.transactions] };
}

export function totals(transactions: Transaction[]) {
  const income = Math.round(transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const expense = Math.round(transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const balance = Math.round((income - expense) * 100) / 100;
  return { income, expense, balance: Object.is(balance, -0) ? 0 : balance };
}

export function categorySpend(transactions: Transaction[], category: string): number {
  return Math.round(transactions.filter((item) => item.kind === "expense" && item.category === category).reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
}

export function applyParsedActions(state: LedgerState, actions: ParsedAction[]): LedgerState {
  let next = { ...state, transactions: [...state.transactions], loans: [...state.loans], budgets: [...state.budgets] };
  for (const action of actions) {
    if (action.type === "transaction") {
      next.transactions.unshift({ ...action.value, id: createId("tx"), createdAt: new Date().toISOString() });
    } else if (action.type === "loan") {
      next.loans.unshift({ ...action.value, id: createId("loan") });
    } else {
      const found = next.budgets.findIndex((budget) => budget.category === action.value.category);
      if (found >= 0) next.budgets[found] = action.value;
      else next.budgets.push(action.value);
    }
  }
  return next;
}

export function formatMoney(value: number): string {
  const normalized = Object.is(value, -0) || Math.abs(value) < 0.000001 ? 0 : value;
  return `¥${normalized.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
