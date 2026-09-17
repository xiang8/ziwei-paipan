/**
 * 运势 md（fortune_halfyear.js 产出）→ 单文件精美 HTML（总览 + N 个半年 tab）· 通用版
 * 用法: node gen_fortune_html.js reports/<姓名>-运势YYYY至YYYY-按半年.md
 * 规律/红线（可选）: reports/<姓名>-rules.json  {"rules":[{n,t,d}], "redlines":[...]}，缺省自动跳过两卡
 * 输出: reports/<姓名>-运势YYYY-YYYY_v0.0.N.html（版本持久化，仅保留最近 3 版）
 * 注意：模板字符串内不写正则（反斜杠陷阱），所有正则都在模板外解析数据。
 */
import fs from 'fs';
import { nextVersion, cleanupOld } from './htmlver.js';

// ---------- 解析 ----------
function clean(t) {
  return (t || '')
    .replace(/\*+/g, '')
    .replace(/^\s*[-*]\s+/gm, '· ')          // 行首 bullet 转 ·
    .replace(/\s+/g, ' ')
    .replace(/\s*[-*]\s*$/, '')
    .trim();
}

/** 吉凶标签归三档：以吉开头→吉；含凶→凶（含"凶中藏机""平偏凶"）；其余→平 */
function classifyJx(label) {
  if (/^吉/.test(label)) return '吉';
  if (label.includes('凶')) return '凶';
  return '平';
}

/** 解析一个月块，兼容多种 AI 输出格式：
 *  **2026-01 己丑【平】** / **2028-07【平】己未月（七杀月）** / **2029-01 乙丑【平】**（食神+七杀库） */
function parseMonthChunk(mc) {
  const tm = mc.match(/(\d{4})[-年](\d{1,2})/);
  if (!tm) return null;
  const y = +tm[1], mo = +tm[2];

  const jm = mc.match(/【([^】]+)】/);
  const jxLabel = jm ? jm[1].trim() : '平';
  const jx = classifyJx(jxLabel);

  // 干支：【吉凶】前（己丑【平】）或后（【平】己未月）
  let gz = '';
  let g = mc.match(/([一-龥])([子丑寅卯辰巳午未申酉戌亥])\s*【/);
  if (g) gz = g[1] + g[2];
  if (!gz) {
    g = mc.match(/【[^】]+】\s*([一-龥])([子丑寅卯辰巳午未申酉戌亥])/);
    if (g) gz = g[1] + g[2];
  }

  // bullet 要点（月卡正文）
  const bullets = mc.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- '))
    .map(l => clean(l.slice(2)))
    .filter(Boolean);

  return { ym: `${y}-${String(mo).padStart(2, '0')}`, label: `${y}年${mo}月`, ganzhi: gz, jx, jxLabel, bullets };
}

function extractField(monthLines, keys) {
  for (const raw of monthLines) {
    const line = raw.trim().replace(/\*/g, '');
    const m = line.match(/(事业工作|事业|财运|感情人际|感情|健康)\s*[：:]/);
    if (m && keys.includes(m[1])) {
      let text = line.slice(m.index + m[0].length).trim();
      text = text.replace(/^【[吉平凶大][^\]]{0,8}】\s*/, '').trim();
      return text;
    }
  }
  return '';
}

function parseAdvice(text) {
  let t = text.replace(/\*/g, '').replace(/本半年最该做[\s\S]{0,14}?最该避[\s\S]{0,10}?的事[\s]*[：:]/, '');
  // 锚点顺序关键：长前缀优先，纯短词兜底
  const anchorList = ['最该把握的吉月', '最该防范的凶月', '本半年最该做的事', '本半年最该避的事',
    '最该做的事', '最该避的事', '本半年最该做', '本半年最该避', '最该做', '最该避', '最佳时机与方位'];
  const map = {
    '最该把握的吉月': 'bestMonth', '最该防范的凶月': 'worstMonth',
    '本半年最该做的事': 'do', '最该做的事': 'do', '本半年最该做': 'do', '最该做': 'do',
    '本半年最该避的事': 'avoid', '最该避的事': 'avoid', '本半年最该避': 'avoid', '最该避': 'avoid',
    '最佳时机与方位': 'timing',
  };
  const re = new RegExp(`(${anchorList.join('|')})[：:\\s]*`, 'g');
  const parts = t.split(re).filter(s => s.trim());
  const obj = { bestMonth: '', worstMonth: '', do: '', avoid: '', timing: '' };
  let cur = null;
  for (const p of parts) {
    if (map[p]) cur = map[p];
    else if (cur && !obj[cur]) obj[cur] = clean(p);
  }
  return obj;
}

/** 从 md 头部解析命主信息（fortune_halfyear.js 输出格式固定） */
function parseMeta(md) {
  const head = md.split(/^---/m)[0] || '';
  const name = (head.match(/^# (.+?) ·/m) || [])[1] || '命主';
  const sub = head.match(/^> (男|女)命 · 公历([\d-]+) · (.+)$/m);
  const dayunRaw = (head.match(/^> 当前大运：(.+)$/m) || [])[1] || '';
  const dayun = dayunRaw.replace(/[（(]([^)）]+)[)）]/, '（$1）').replace(/，/g, ' · ');
  const years = head.match(/（(\d{4}) 至 (\d{4})/);
  const fromY = years ? +years[1] : 2026;
  const toY = years ? +years[2] : 2030;
  return {
    name, gender: sub ? sub[1] : '男', birth: `公历 ${sub ? sub[2] : ''}`, region: sub ? sub[3] : '',
    dayun, title: `运势推演 · ${fromY} — ${toY}`, fromY, toY,
    segCount: (md.match(/^## \d{4} [上下]半年/gm) || []).length,
  };
}

function parseMd(md) {
  const meta = parseMeta(md);
  const halves = [];
  const segs = md.split(/^## /m).slice(1);
  for (const seg of segs) {
    const head = seg.split('\n')[0].trim();
    const hm = head.match(/^(\d{4})\s*(上|下)半年[（(]([^)）]+)[)）]/);
    if (!hm) continue;
    const year = +hm[1], half = hm[2], range = hm[3];
    const label = `${year} ${half}半年`;

    const toneM = seg.match(/###\s*整体基调\s*([\s\S]*?)(?=###\s*逐月)/);
    const monthsM = seg.match(/###\s*逐月要点\s*([\s\S]*?)(?=###\s*关键月|$)/);
    const advM = seg.match(/###\s*关键月[\s\S]*?([\s\S]*)$/);

    const tone = clean(toneM ? toneM[1] : '');

    const months = [];
    if (monthsM) {
      const mChunks = monthsM[1].split(/\n(?=\*\*\s*\d{4}[-年])/);
      for (const mc of mChunks) {
        const m = parseMonthChunk(mc);
        if (!m) continue;
        // 顺带提取带标签字段（有就填，渲染时优先字段、空则用 bullets）
        const lines = mc.split('\n');
        m.career = extractField(lines, ['事业工作', '事业']);
        m.wealth = extractField(lines, ['财运']);
        m.love = extractField(lines, ['感情人际', '感情']);
        m.health = extractField(lines, ['健康']);
        months.push(m);
      }
    }

    halves.push({
      id: `${year}${half === '上' ? 'h1' : 'h2'}`, label, year, half, range, tone, months,
      advice: parseAdvice(advM ? advM[1] : ''),
    });
  }
  return { meta, halves };
}

// ---------- 总览统计 ----------
function buildOverview(halves) {
  let ji = 0, ping = 0, xiong = 0;
  for (const h of halves) for (const m of h.months) {
    if (m.jx === '吉') ji++; else if (m.jx === '凶') xiong++; else ping++;
  }
  const nodes = halves.map(h => ({ label: h.label, range: h.range, best: h.advice.bestMonth, worst: h.advice.worstMonth }));
  return { ji, ping, xiong, nodes };
}

// ---------- HTML 模板 ----------
function htmlTemplate(data, ov, extra, version) {
  const dataJson = JSON.stringify({ ...data, ov }).replace(/</g, '<\\');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.meta.name} · 运势推演 ${data.meta.fromY}—${data.meta.toY}</title>
<style>
:root{
  --bg:#0d1614; --bg2:#13201c; --card:#1a2925; --card2:#20322d; --line:#2d423c; --line2:#3a544c;
  --gold:#c9a961; --gold-bright:#e6c982; --gold-dim:#7d6a40;
  --red:#c0392b; --red-bright:#e74c3c; --red-bg:rgba(192,57,43,.14);
  --green:#4ea56c; --green-bg:rgba(78,165,108,.14);
  --yellow:#c9a23e; --yellow-bg:rgba(201,162,62,.14);
  --text:#ece4d3; --text-dim:#9c9586; --text-faint:#6b665b;
  --serif:"STSong","Songti SC","SimSun","Noto Serif SC",serif;
  --sans:"Microsoft YaHei","PingFang SC","Helvetica Neue",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.7;
  background-image:radial-gradient(circle at 20% 10%,rgba(201,169,97,.05),transparent 40%),radial-gradient(circle at 80% 90%,rgba(78,165,108,.04),transparent 40%);}
.wrap{max-width:1180px;margin:0 auto;padding:32px 28px 80px}
/* header */
.header{position:relative;padding:28px 32px 24px;border:1px solid var(--line);border-radius:14px;
  background:linear-gradient(135deg,var(--card) 0%,var(--bg2) 100%);overflow:hidden;margin-bottom:22px}
.header::before{content:"";position:absolute;right:-40px;top:-40px;width:220px;height:220px;
  background:radial-gradient(circle,rgba(201,169,97,.08),transparent 70%);pointer-events:none}
.h-version{position:absolute;right:20px;top:18px;font-size:11px;color:var(--text-faint);letter-spacing:1px}
.h-title{font-family:var(--serif);font-size:30px;font-weight:700;color:var(--gold-bright);letter-spacing:3px}
.h-sub{color:var(--text-dim);font-size:13px;margin-top:6px;letter-spacing:1px}
.h-info{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.chip{font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--line2);color:var(--text-dim);background:rgba(255,255,255,.02)}
.chip b{color:var(--gold);font-weight:600}
.gold-line{height:1px;background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);margin-top:18px}
/* tabs */
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px;position:sticky;top:0;padding:10px 0;z-index:10;
  background:linear-gradient(var(--bg) 70%,transparent)}
.tab{padding:8px 18px;border-radius:22px;border:1px solid var(--line);background:var(--card);color:var(--text-dim);
  cursor:pointer;font-size:14px;transition:all .2s;white-space:nowrap;font-family:var(--sans)}
.tab:hover{border-color:var(--gold-dim);color:var(--text)}
.tab.active{background:linear-gradient(135deg,var(--gold) 0%,var(--gold-dim) 100%);color:#1a1408;border-color:var(--gold);
  font-weight:600;box-shadow:0 4px 14px rgba(201,169,97,.25)}
/* page */
.page{display:none;animation:fade .35s ease}
.page.active{display:block}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
/* card */
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px 24px;margin-bottom:18px}
.card-h{font-family:var(--serif);font-size:18px;color:var(--gold-bright);margin-bottom:14px;letter-spacing:2px;
  display:flex;align-items:center;gap:10px}
.card-h::before{content:"";width:4px;height:18px;background:var(--gold);border-radius:2px}
/* 统计 */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;text-align:center}
.stat .n{font-family:var(--serif);font-size:38px;font-weight:700;line-height:1}
.stat .l{font-size:13px;color:var(--text-dim);margin-top:6px;letter-spacing:1px}
.stat.ji .n{color:var(--green)} .stat.ping .n{color:var(--yellow)} .stat.xiong .n{color:var(--red-bright)}
/* 热力图 */
.heat-legend{display:flex;gap:18px;font-size:12px;color:var(--text-dim);margin-bottom:12px;flex-wrap:wrap}
.heat-legend span{display:inline-flex;align-items:center;gap:6px}
.dot{width:14px;height:14px;border-radius:3px;display:inline-block}
.heat{display:grid;grid-template-columns:repeat(12,1fr);gap:5px}
.heat-col-h{display:grid;grid-template-columns:repeat(12,1fr);gap:5px;margin-bottom:6px}
.heat-col-h div{text-align:center;font-size:11px;color:var(--text-faint)}
.heat-row{display:contents}
.cell{aspect-ratio:1;border-radius:5px;cursor:pointer;position:relative;transition:transform .15s;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.85)}
.cell:hover{transform:scale(1.18);z-index:5;outline:1px solid var(--gold)}
.cell.ji{background:linear-gradient(135deg,#4ea56c,#3d8557)}
.cell.ping{background:linear-gradient(135deg,#c9a23e,#a8862c)}
.cell.xiong{background:linear-gradient(135deg,#c0392b,#962a1f)}
.cell .tip{display:none}
.cell:hover .tip{display:block;position:absolute;bottom:130%;left:50%;transform:translateX(-50%);
  background:#0a0f0e;border:1px solid var(--gold-dim);padding:8px 12px;border-radius:6px;font-size:12px;
  white-space:nowrap;color:var(--text);z-index:20;line-height:1.5;max-width:340px;white-space:normal;width:max-content}
.cell:hover .tip b{color:var(--gold-bright)}
.heat-rowlabel{display:grid;grid-template-columns:40px 1fr;gap:8px;align-items:center;margin-bottom:5px}
.heat-rowlabel .yl{font-size:12px;color:var(--gold-dim);font-family:var(--serif);text-align:right}
/* 节点表 */
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:11px 12px;text-align:left;background:var(--bg2);color:var(--gold);font-weight:600;border-bottom:1px solid var(--line2);font-family:var(--serif);letter-spacing:1px}
td{padding:11px 12px;border-bottom:1px solid var(--line);color:var(--text-dim);vertical-align:top}
tr:hover td{background:rgba(201,169,97,.03);color:var(--text)}
.tag{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;margin-right:4px}
.tag.ji{background:var(--green-bg);color:var(--green);border:1px solid #3d8557}
.tag.xiong{background:var(--red-bg);color:var(--red-bright);border:1px solid #962a1f}
/* 三规律 */
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.rule{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;border-top:3px solid var(--gold-dim)}
.rule .rn{font-family:var(--serif);font-size:32px;color:var(--gold-dim);opacity:.6;line-height:1}
.rule .rt{font-family:var(--serif);font-size:16px;color:var(--gold-bright);margin:8px 0 10px;letter-spacing:1px}
.rule .rd{font-size:13px;color:var(--text-dim);line-height:1.8}
/* 红线 */
.warn{background:linear-gradient(135deg,rgba(192,57,43,.1),var(--card));border:1px solid #7a2a20;border-left:4px solid var(--red-bright)}
.warn li{margin:8px 0 8px 18px;color:var(--text);font-size:14px}
.warn li b{color:var(--red-bright)}
/* 半年页 */
.tone-box{font-family:var(--serif);font-size:16px;line-height:1.95;color:var(--text);padding:4px 6px;letter-spacing:.5px}
.months{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.mcard{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.mcard:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.mcard-top{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
.mcard.ji .mcard-top{background:linear-gradient(90deg,var(--green-bg),transparent)}
.mcard.ping .mcard-top{background:linear-gradient(90deg,var(--yellow-bg),transparent)}
.mcard.xiong .mcard-top{background:linear-gradient(90deg,var(--red-bg),transparent)}
.mcard-top .ml{font-family:var(--serif);font-size:18px;color:var(--gold-bright)}
.mcard-top .mr{display:flex;gap:8px;align-items:center}
.gz{font-size:12px;color:var(--text-dim);padding:3px 10px;border:1px solid var(--line2);border-radius:12px}
.seal{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:16px;font-weight:700}
.mcard.ji .seal{background:var(--green);color:#0d1614}
.mcard.ping .seal{background:var(--yellow);color:#1a1408}
.mcard.xiong .seal{background:var(--red);color:#fff}
.mbody{padding:14px 18px}
.field{margin-bottom:10px}
.field:last-child{margin-bottom:0}
.fl{display:inline-block;font-size:11px;color:var(--gold-dim);padding:1px 7px;border:1px solid var(--line2);border-radius:8px;margin-right:8px;min-width:56px;text-align:center;letter-spacing:1px}
.fv{font-size:13px;color:var(--text);display:inline}
.blt{font-size:13px;color:var(--text-dim);line-height:1.75;margin:4px 0;padding-left:14px;position:relative}
.blt::before{content:"·";position:absolute;left:2px;color:var(--gold-dim)}
/* 建议格 */
.adv-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.adv{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.adv.full{grid-column:1/-1}
.adv .al{font-size:12px;color:var(--gold);letter-spacing:1px;margin-bottom:8px;font-family:var(--serif)}
.adv .av{font-size:14px;color:var(--text);line-height:1.85}
.adv.best{border-left:3px solid var(--green)}
.adv.worst{border-left:3px solid var(--red)}
.foot{text-align:center;color:var(--text-faint);font-size:12px;margin-top:30px;letter-spacing:1px;line-height:2}
@media(max-width:760px){.months,.adv-grid,.rules,.stats{grid-template-columns:1fr}.heat{grid-template-columns:repeat(6,1fr)}.heat-col-h{display:none}.h-title{font-size:24px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="h-version">${version}</div>
    <div class="h-title">${data.meta.title}</div>
    <div class="h-sub">${data.meta.name}　·　${data.meta.gender}命　·　${data.meta.birth}　·　${data.meta.region}</div>
    <div class="h-info">
      <span class="chip">当前大运　<b>${data.meta.dayun}</b></span>
      <span class="chip">颗粒度　<b>每半年一段 · 共 ${data.meta.segCount} 段</b></span>
      <span class="chip">区间　<b>${data.meta.fromY}-01 ~ ${data.meta.toY}-12</b></span>
    </div>
    <div class="gold-line"></div>
  </div>

  <div class="tabs" id="tabs"></div>
  <div id="pages"></div>

  <div class="foot">紫微排盘解盘 · ${version}<br>· 命理推演仅供参考，运势在人不在天 ·</div>
</div>
<script>
const DATA = ${dataJson};
const RULES = ${extra && extra.rules ? JSON.stringify(extra.rules) : 'null'};
const REDLINES = ${extra && extra.redlines ? JSON.stringify(extra.redlines) : 'null'};

const tabs = document.getElementById('tabs');
const pages = document.getElementById('pages');

// 总览页
const ov = DATA.ov;
function renderOverview(){
  let html = '<div class="page" id="p-overview">';
  html += '<div class="stats">'+
    '<div class="stat ji"><div class="n">'+ov.ji+'</div><div class="l">吉 月</div></div>'+
    '<div class="stat ping"><div class="n">'+ov.ping+'</div><div class="l">平 月</div></div>'+
    '<div class="stat xiong"><div class="n">'+ov.xiong+'</div><div class="l">凶 月</div></div></div>';

  // 热力图
  html += '<div class="card"><div class="card-h">六十月吉凶总览</div>';
  html += '<div class="heat-legend">'+
    '<span><i class="dot" style="background:#4ea56c"></i>吉</span>'+
    '<span><i class="dot" style="background:#c9a23e"></i>平</span>'+
    '<span><i class="dot" style="background:#c0392b"></i>凶</span>'+
    '<span style="margin-left:auto;color:var(--text-faint)">悬停查看月度摘要</span></div>';
  html += '<div class="heat-col-h">';
  for(let m=1;m<=12;m++) html += '<div>'+m+'月</div>';
  html += '</div>';
  const byYear = {};
  DATA.halves.forEach(h=>{ if(!byYear[h.year]) byYear[h.year]=[]; byYear[h.year].push(h); });
  Object.keys(byYear).sort().forEach(y=>{
    const months = new Array(12).fill(null);
    byYear[y].forEach(h=>h.months.forEach(m=>{ months[(+m.ym.split('-')[1])-1]=m; }));
    html += '<div class="heat-rowlabel"><div class="yl">'+y+'</div><div><div class="heat">';
    months.forEach(m=>{
      if(!m){ html += '<div class="cell ping" style="opacity:.15"></div>'; return; }
      const jx = m.jx==='吉'?'ji':(m.jx==='凶'?'xiong':'ping');
      const first = (m.bullets && m.bullets.length) ? m.bullets[0] : '';
      html += '<div class="cell '+jx+'">'+m.jx+'<div class="tip"><b>'+m.label+'</b>（'+(m.ganzhi||'')+'，'+m.jxLabel+'）<br>'+first.slice(0,60)+'</div></div>';
    });
    html += '</div></div></div>';
  });
  html += '</div>';

  // 节点表
  html += '<div class="card"><div class="card-h">五年关键节点</div><table><thead><tr><th>半年</th><th>区间</th><th>最该把握 · 吉月</th><th>最该防范 · 凶月</th></tr></thead><tbody>';
  ov.nodes.forEach(n=>{
    html += '<tr><td><b style="color:var(--gold-bright)">'+n.label+'</b></td><td>'+n.range+'</td>'+
      '<td><span class="tag ji">'+cleanShort(n.best)+'</span></td>'+
      '<td><span class="tag xiong">'+cleanShort(n.worst)+'</span></td></tr>';
  });
  html += '</tbody></table></div>';

  // 三规律（可选）
  if (RULES) {
    html += '<div class="card"><div class="card-h">五年吉凶规律</div><div class="rules">';
    RULES.forEach(r=>{ html += '<div class="rule"><div class="rn">'+r.n+'</div><div class="rt">'+r.t+'</div><div class="rd">'+r.d+'</div></div>'; });
    html += '</div></div>';
  }

  // 红线（可选）
  if (REDLINES) {
    html += '<div class="card warn"><div class="card-h" style="color:var(--red-bright)">红线警示</div><ul>';
    REDLINES.forEach(r=>html+='<li>'+r+'</li>');
    html += '</ul></div>';
  }

  html += '</div>';
  return html;
}
function cleanShort(s){ s=(s||''); var i=s.indexOf('原因'); if(i>=0)s=s.slice(0,i); s=s.split('**').join('').trim(); return s.length>40?s.slice(0,40)+'…':s; }

// 半年页
function renderHalf(h){
  let html = '<div class="page" id="p-'+h.id+'">';
  html += '<div class="card"><div class="card-h">'+h.label+'　<span style="color:var(--text-faint);font-size:13px;font-family:var(--sans);font-weight:400">'+h.range+'</span></div>';
  html += '<div class="tone-box">'+h.tone+'</div></div>';

  // 月度卡
  html += '<div class="card"><div class="card-h">逐月推演</div><div class="months">';
  h.months.forEach(m=>{
    const jx = m.jx==='吉'?'ji':(m.jx==='凶'?'xiong':'ping');
    let body = '';
    if (m.career || m.wealth || m.love || m.health) {
      body = field('事业', m.career)+field('财运', m.wealth)+field('感情', m.love)+field('健康', m.health);
    }
    if (!body && m.bullets) {
      body = m.bullets.map(b=>'<div class="blt">'+b+'</div>').join('');
    }
    html += '<div class="mcard '+jx+'">'+
      '<div class="mcard-top"><div class="ml">'+m.label+'</div><div class="mr"><span class="gz">'+(m.ganzhi||'')+'</span><div class="seal" title="'+m.jxLabel+'">'+m.jx+'</div></div></div>'+
      '<div class="mbody">'+body+'</div></div>';
  });
  html += '</div></div>';

  // 建议
  const a = h.advice;
  html += '<div class="card"><div class="card-h">关键月与行动建议</div><div class="adv-grid">';
  html += adv('最该把握 · 吉月', a.bestMonth, 'best');
  html += adv('最该防范 · 凶月', a.worstMonth, 'worst');
  html += adv('本半年最该做', a.do, '');
  html += adv('本半年最该避', a.avoid, '');
  html += '<div class="adv full"><div class="al">最佳时机与方位</div><div class="av">'+(a.timing||'—')+'</div></div>';
  html += '</div></div>';

  html += '</div>';
  return html;
}
function field(label, val){
  if(!val) return '';
  return '<div class="field"><span class="fl">'+label+'</span><span class="fv">'+val+'</span></div>';
}
function adv(label, val, cls){
  return '<div class="adv '+cls+'"><div class="al">'+label+'</div><div class="av">'+(val||'—')+'</div></div>';
}

// 组装
tabs.insertAdjacentHTML('beforeend', '<div class="tab active" data-tab="overview">总览</div>');
pages.insertAdjacentHTML('beforeend', renderOverview());
DATA.halves.forEach(h=>{
  tabs.insertAdjacentHTML('beforeend', '<div class="tab" data-tab="'+h.id+'">'+h.label.replace(' ','')+'</div>');
  pages.insertAdjacentHTML('beforeend', renderHalf(h));
});

// 切换
tabs.addEventListener('click', e=>{
  const t = e.target.closest('.tab'); if(!t) return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  const id = t.dataset.tab;
  document.getElementById(id==='overview'?'p-overview':'p-'+id).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
});
// 键盘左右切换
const order = ['overview', ...DATA.halves.map(h=>h.id)];
document.addEventListener('keydown', e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
  const cur = document.querySelector('.tab.active').dataset.tab;
  let i = order.indexOf(cur);
  i = e.key==='ArrowLeft' ? Math.max(0,i-1) : Math.min(order.length-1,i+1);
  document.querySelector('.tab[data-tab="'+order[i]+'"]').click();
});
</script>
</body>
</html>`;
}

// ---------- 主流程 ----------
const mdPath = process.argv[2];
if (!mdPath) {
  console.log('用法: node gen_fortune_html.js reports/<姓名>-运势YYYY至YYYY-按半年.md');
  process.exit(1);
}
const md = fs.readFileSync(mdPath, 'utf-8');
const data = parseMd(md);
if (!data.halves.length) { console.error('解析失败：未找到半年段，确认 md 是 fortune_halfyear.js 产出'); process.exit(1); }
const ov = buildOverview(data.halves);

// 规律/红线（可选）
let extra = null;
try { extra = JSON.parse(fs.readFileSync(`reports/${data.meta.name}-rules.json`, 'utf-8')); } catch { /* 无配置则跳过两卡 */ }

const base = `${data.meta.name}-运势${data.meta.fromY}-${data.meta.toY}`;
const version = nextVersion(base);
const outPath = `${base}_${version}.html`;
fs.writeFileSync(`reports/${outPath}`, htmlTemplate(data, ov, extra, version), 'utf-8');

const removed = cleanupOld(base);
const totalMonths = data.halves.reduce((s, h) => s + h.months.length, 0);
console.log(`✅ 已生成: reports/${outPath}`);
console.log(`   ${data.halves.length} 个半年段 · ${totalMonths} 个月 | 吉 ${ov.ji} / 平 ${ov.ping} / 凶 ${ov.xiong}${extra ? ' | 含规律/红线' : ''}`);
console.log(`   文件大小: ${(fs.statSync(`reports/${outPath}`).size / 1024).toFixed(1)} KB`);
if (removed.length) console.log(`   已清理旧版本: ${removed.join('、')}`);
