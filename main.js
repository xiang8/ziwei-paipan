import fs from 'fs';
import path from 'path';
import { paipanBazi } from './paipan/bazi.js';
import { paipanZiwei } from './paipan/ziwei.js';
import { findLongitude } from './paipan/cities.js';
import { chatGLM } from './jiepan/ai_service.js';
import { SYSTEM_PROMPT, buildUserPrompt, formatBaziText, formatZiweiText } from './jiepan/prompts.js';

const pad = n => String(n).padStart(2, '0');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    a[k] = argv[i + 1];
  }
  return a;
}

function usage() {
  console.log(`用法: node main.js --name 姓名 --year YYYY --month M --day D --hour H --minute MI --region 出生地 --gender 男|女
示例: node main.js --name 劳翔 --year 2001 --month 7 --day 18 --hour 11 --minute 50 --region 广东省茂名市 --gender 男`);
}

async function main() {
  const a = parseArgs(process.argv);
  if (!a.year || !a.month || !a.day) { usage(); process.exit(1); }
  const name = a.name || '命主';
  const gender = (a.gender || '男') === '女' ? '女' : '男';
  const year = +a.year, month = +a.month, day = +a.day;
  const hour = a.hour !== undefined ? +a.hour : 12;
  const minute = a.minute !== undefined ? +a.minute : 0;

  // 经度
  let longitude = a.longitude ? +a.longitude : null;
  let regionLabel = a.region || '未知';
  if (longitude === null && a.region) {
    const found = findLongitude(a.region);
    if (found) { longitude = found.longitude; regionLabel = `${found.province}${found.city}`; }
    else { longitude = 116.4; console.warn(`[警告] 未找到"${a.region}"的经度，使用北京116.4°`); }
  } else if (longitude === null) {
    longitude = 116.4;
  }

  // 排盘
  const bazi = paipanBazi({ name, year, month, day, hour, minute, longitude, gender });
  const ziwei = paipanZiwei({ name, year, month, day, hour, minute, longitude, gender });

  const basicText = `【命主】${name}  ${gender}命
公历：${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}
出生地：${regionLabel}（经度 ${longitude}°）
真太阳时：${bazi.solarTime.trueSolarTime}（${ziwei.solarTime.timeName}时）
农历：${bazi.lunar}
生肖：${bazi.shengXiao}  星座：${bazi.xingZuo}`;

  const baziText = formatBaziText(bazi);
  const ziweiText = formatZiweiText(ziwei);

  console.log('排盘完成 →', bazi.pillars.map(p => p.ganzhi).join(' '), `| 紫微五行局${ziwei.fiveElementsClass}`);
  console.log('调用智谱 GLM-5.2 解盘中（可能需 30-90 秒）...');

  let interpretation;
  try {
    const userPrompt = buildUserPrompt({ basic: basicText, bazi: baziText, ziwei: ziweiText });
    interpretation = await chatGLM(SYSTEM_PROMPT, userPrompt, { temperature: 0.7, maxTokens: 8192 });
  } catch (e) {
    interpretation = `> ⚠️ 解盘调用失败：${e.message}\n> 已输出排盘数据，请检查 .env 的 ZHIPU_API_KEY 与网络。`;
    console.error('解盘失败:', e.message);
  }

  // 合成报告
  const report = `# ${name} · 命理解盘报告

> 公历 ${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)} · ${gender}命 · ${regionLabel}

---

## 排盘数据

${basicText}

${baziText}

${ziweiText}

---

## 命理解读

${interpretation}
`;

  fs.mkdirSync('reports', { recursive: true });
  const fname = `${year}-${pad(month)}-${pad(day)}-${pad(hour)}${pad(minute)}-${regionLabel}-${name}-${gender}.md`;
  const outPath = path.join('reports', fname);
  fs.writeFileSync(outPath, report, 'utf-8');
  console.log('\n✅ 报告已生成:', outPath);
}

main().catch(e => { console.error('出错:', e.message); process.exit(1); });
