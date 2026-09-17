import fs from 'fs';
import lunar from 'lunar-javascript';
import { paipanBazi } from './paipan/bazi.js';
import { paipanZiwei } from './paipan/ziwei.js';
import { findLongitude } from './paipan/cities.js';
import { chatGLM } from './jiepan/ai_service.js';
import { SYSTEM_PROMPT, formatBaziText, formatZiweiText } from './jiepan/prompts.js';
const { Solar } = lunar;
const pad = n => String(n).padStart(2, '0');

// 解析命令行
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
  return a;
}

/** 算从 startYear-startMonth 到 endYear-endMonth 各公历月对应的命理月柱干支 */
function monthPillars(startYear, startMonth, endYear, endMonth) {
  const out = [];
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const gz = Solar.fromYmdHms(y, m, 15, 12, 0, 0).getLunar().getMonthInGanZhi();
    out.push({ year: y, month: m, ganzhi: gz });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

async function main() {
  const a = parseArgs(process.argv);
  const name = a.name || '劳翔';
  const gender = (a.gender || '男') === '女' ? '女' : '男';
  const year = +(a.year || 2001), month = +(a.month || 7), day = +(a.day || 18);
  const hour = a.hour !== undefined ? +a.hour : 11;
  const minute = a.minute !== undefined ? +a.minute : 50;
  const region = a.region || '广东省茂名市';
  let longitude = a.longitude ? +a.longitude : (findLongitude(region)?.longitude ?? 116.4);

  const from = a.from || '2026-07';   // 默认2026下半年起
  const to = a.to || '2027-12';
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);

  const input = { name, year, month, day, hour, minute, longitude, gender };
  const bazi = paipanBazi(input);
  const ziwei = paipanZiwei(input);

  // 涉及到的流年
  const yearsSet = new Set();
  for (let y = fy; y <= ty; y++) yearsSet.add(y);
  const lynos = [...yearsSet].map(y => ({ year: y, ly: bazi.liuNian.find(l => l.year === y) })).filter(x => x.ly);

  // 流月
  const months = monthPillars(fy, fm, ty, tm);

  // 当前大运
  const birthYear = year;
  const refAge = (fy + ty) / 2 | 0 - birthYear;
  const nowDaYun = bazi.daYun.find(d => d.startAge <= (ty - birthYear) && d.endAge >= (fy - birthYear)) || bazi.daYun[0];

  const lyText = lynos.map(x => `${x.year}年(${x.ly.ganzhi}，${x.ly.ganShiShen}，神煞[${x.ly.shenSha.join('、') || '无'}])`).join('；');
  const monthText = months.map(mo => `${mo.year}-${pad(mo.month)}：${mo.ganzhi}`).join('  ');

  const prompt = `${SYSTEM_PROMPT}

以下是命主的完整命局数据，请据此分析指定时段的运势。

【命主】${name}  ${gender}命  公历${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}  ${region}
${formatBaziText(bazi)}

${formatZiweiText(ziwei)}

【当前大运】${nowDaYun.startAge}-${nowDaYun.endAge}岁 ${nowDaYun.ganzhi}（${nowDaYun.ganShiShen}，${nowDaYun.startYear}-${nowDaYun.endYear}年）

【待分析时段】${from} 至 ${to}
【涉及流年】${lyText}
【流月干支】${monthText}

请输出（Markdown）：

## 一、整体运势基调
结合大运${nowDaYun.ganzhi}与流年，概括该时段命主的整体运势走向（顺逆、主题）。

## 二、逐段/逐月运势
按时间顺序（${from}→${to}）分段或逐月分析，结合流月干支与原局作用，指出：
- 事业工作：顺逆、机会、阻力
- 财运：正偏财、收支、投资宜忌
- 感情人际：桃花、关系、口舌
- 健康：需留意方面
每段标注【吉/平/凶】倾向。

## 三、关键月份与转折点
列出该时段最值得关注的吉月与凶月（具体年月），说明原因。

## 四、行动建议
该时段最该做、最该避的事；最佳时机与方位。

要求：结合具体十神/五行/神煞/星曜，有依据；不空话、不恐吓。`;

  console.log(`排盘+流年+流月完成，调用智谱 GLM-5.2 分析 ${from}→${to} 运势（约30-90秒）...`);
  const text = await chatGLM(SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 8192 });

  const report = `# ${name} · 运势分析（${from} 至 ${to}）

> ${gender}命 · 公历${year}-${pad(month)}-${pad(day)} · ${region}
> 当前大运：${nowDaYun.ganzhi}（${nowDaYun.startAge}-${nowDaYun.endAge}岁，${nowDaYun.ganShiShen}）
> 流年：${lynos.map(x => `${x.year} ${x.ly.ganzhi}`).join('、')}

---

${text}
`;
  fs.mkdirSync('reports', { recursive: true });
  const fname = `${name}-运势${from}至${to}.md`;
  fs.writeFileSync(`reports/${fname}`, report, 'utf-8');
  console.log('\n✅ 运势报告已生成: reports/' + fname);
}

main().catch(e => { console.error('出错:', e.message); process.exit(1); });
