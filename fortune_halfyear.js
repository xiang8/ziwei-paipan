/**
 * 运势解盘 · 按半年切分（每半年调一次 GLM，独立解一段）
 * 用法: node fortune_halfyear.js [--from 2026] [--to 2030] [--name 劳翔]
 * 边跑边存到 reports/<name>-运势<from>至<to>-按半年.md，防中断丢数据。
 */
import fs from 'fs';
import lunar from 'lunar-javascript';
import { paipanBazi } from './paipan/bazi.js';
import { paipanZiwei } from './paipan/ziwei.js';
import { findLongitude } from './paipan/cities.js';
import { chatGLM } from './jiepan/ai_service.js';
import { SYSTEM_PROMPT, formatBaziText, formatZiweiText } from './jiepan/prompts.js';
const { Solar } = lunar;
const pad = n => String(n).padStart(2, '0');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
  return a;
}

/** 生成半年段列表 */
function halfYearRanges(startYear, endYear) {
  const out = [];
  for (let y = startYear; y <= endYear; y++) {
    out.push({ label: `${y} 上半年`, from: { y, m: 1 }, to: { y, m: 6 } });
    out.push({ label: `${y} 下半年`, from: { y, m: 7 }, to: { y, m: 12 } });
  }
  return out;
}

/** 公历月 → 月柱干支 */
function monthPillars(fy, fm, ty, tm) {
  const out = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const gz = Solar.fromYmdHms(y, m, 15, 12, 0, 0).getLunar().getMonthInGanZhi();
    out.push({ year: y, month: m, ganzhi: gz });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** 选覆盖 [fromY, toY] 跨度的大运 */
function pickDaYun(daYun, fromY, toY, birthYear) {
  return daYun.find(d => d.startYear <= toY && d.endYear >= fromY)
    || daYun.find(d => d.startAge <= (toY - birthYear) && d.endAge >= (fromY - birthYear))
    || daYun[Math.min(daYun.length - 1, 2)];
}

function buildSegPrompt(input, bazi, ziwei, seg, dy) {
  const { name, year, month, day, hour, minute, region, gender } = input;
  const months = monthPillars(seg.from.y, seg.from.m, seg.to.y, seg.to.m);
  const yearsSet = new Set();
  for (let y = seg.from.y; y <= seg.to.y; y++) yearsSet.add(y);
  const lynos = [...yearsSet]
    .map(y => ({ year: y, ly: bazi.liuNian.find(l => l.year === y) }))
    .filter(x => x.ly);
  const lyText = lynos.map(x => `${x.year}年(${x.ly.ganzhi}，${x.ly.ganShiShen}，神煞[${(x.ly.shenSha || []).join('、') || '无'}])`).join('；');
  const monthText = months.map(mo => `${mo.year}-${pad(mo.month)}：${mo.ganzhi}`).join('  ');
  const fromStr = `${seg.from.y}-${pad(seg.from.m)}`;
  const toStr = `${seg.to.y}-${pad(seg.to.m)}`;
  return `${SYSTEM_PROMPT}

以下是命主完整命局，请【只针对这一个半年】做运势推演。

【命主】${name}  ${gender}命  公历${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}  ${region}
${formatBaziText(bazi)}

${formatZiweiText(ziwei)}

【当前大运】${dy.startAge}-${dy.endAge}岁 ${dy.ganzhi}（${dy.ganShiShen}，${dy.startYear}-${dy.endYear}年）

【待分析时段】${seg.label}（${fromStr} 至 ${toStr}）
【涉及流年】${lyText}
【该半年流月干支】${monthText}

请严格按以下结构输出（Markdown，不要输出二级标题行，直接从"### 整体基调"开始）：

### 整体基调
结合大运${dy.ganzhi}与本半年流年干支，2-4 句概括本半年运势主题、顺逆与核心策略。

### 逐月要点
按 ${fromStr}→${toStr} 逐月分析（结合上面流月干支与原局作用）。每月一小节，月首标注【吉/平/凶】，覆盖：
- 事业工作：顺逆、机会、阻力
- 财运：正偏财、收支、投资宜忌
- 感情人际：桃花、关系、口舌
- 健康：需留意方面
每月 2-4 条，简洁有据。

### 关键月与行动建议
- 最该把握的吉月（具体年月+原因）
- 最该防范的凶月（具体年月+原因）
- 本半年最该做 / 最该避的事
- 最佳时机与方位

要求：紧扣具体十神 / 五行 / 神煞 / 星曜 / 流月干支，给出依据；不空话、不恐吓、不套话；简洁有力。`;
}

async function main() {
  const a = parseArgs(process.argv);
  const name = a.name || '劳翔';
  const gender = (a.gender || '男') === '女' ? '女' : '男';
  const year = +(a.year || 2001), month = +(a.month || 7), day = +(a.day || 18);
  const hour = a.hour !== undefined ? +a.hour : 11;
  const minute = a.minute !== undefined ? +a.minute : 50;
  const region = a.region || '广东省茂名市';
  const longitude = a.longitude ? +a.longitude : (findLongitude(region)?.longitude ?? 110.9);
  const fromY = +(a.from || 2026);
  const toY = +(a.to || 2030);

  const input = { name, year, month, day, hour, minute, longitude, gender, region };
  const bazi = paipanBazi(input);
  const ziwei = paipanZiwei(input);
  const dy = pickDaYun(bazi.daYun, fromY, toY, year);

  const segs = halfYearRanges(fromY, toY);
  const outFile = `reports/${name}-运势${fromY}至${toY}-按半年.md`;
  console.log(`命主 ${name} | 大运 ${dy.ganzhi}(${dy.startAge}-${dy.endAge}岁) | 共 ${segs.length} 个半年段`);
  console.log(`输出: ${outFile}`);
  console.log('开始逐段解盘（每段约 20-60 秒）...\n');

  const parts = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${segs.length}] ${seg.label} 解盘中... `);
    let body;
    try {
      const prompt = buildSegPrompt(input, bazi, ziwei, seg, dy);
      body = await chatGLM(SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4096 });
      console.log(`✅ ${(body.length)}字 / ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      body = `> ⚠️ 本段解盘失败：${e.message}`;
      console.log(`❌ ${e.message}`);
    }
    parts.push(`## ${seg.label}（${seg.from.y}-${pad(seg.from.m)} 至 ${seg.to.y}-${pad(seg.to.m)}）\n\n${body}`);

    // 边跑边存
    const report = `# ${name} · 运势分析（${fromY} 至 ${toY}，按半年）

> ${gender}命 · 公历${year}-${pad(month)}-${pad(day)} · ${region}
> 当前大运：${dy.ganzhi}（${dy.startAge}-${dy.endAge}岁，${dy.ganShiShen}，${dy.startYear}-${dy.endYear}年）
> 颗粒度：每半年一段，共 ${segs.length} 段 | 进度：${i + 1}/${segs.length}

---

${parts.join('\n\n---\n\n')}
`;
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(outFile, report, 'utf-8');
  }
  console.log(`\n✅ 全部完成: ${outFile}`);
}

main().catch(e => { console.error('出错:', e.message); process.exit(1); });
