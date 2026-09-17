/**
 * 把命盘报告 md（main.js 产出）转成单文件暗色中式 HTML：
 * 命主信息头 + 八字（四柱/藏干/大运时间轴）+ 紫微 4×4 方格盘 + AI 解读章节（锚点导航）。
 * 用法: node gen_paipan_html.js reports/xxx.md
 * 输出: reports/<姓名>-命盘报告_v0.0.N.html（版本自动递增，本地持久化，仅保留最近 3 版）
 * 注意：模板字符串内不写正则（反斜杠陷阱），所有正则都在模板外解析数据。
 */
import fs from 'fs';
import path from 'path';
import { nextVersion, cleanupOld } from './htmlver.js';

// ---------- md 解析 ----------
function parseData(dataPart) {
  const d = { pillars: [], canggan: [], gong: [], dayun: [] };
  for (const raw of dataPart.split('\n')) {
    const t = raw.trim();
    let m;
    if ((m = t.match(/^【命主】(.+?)\s+(男|女)命$/))) { d.name = m[1]; d.gender = m[2]; }
    else if ((m = t.match(/^公历：(.+)$/))) d.birthday = m[1];
    else if ((m = t.match(/^出生地：(.+?)（/))) d.region = m[1];
    else if ((m = t.match(/^真太阳时：(.+)$/))) d.trueSolar = m[1];
    else if ((m = t.match(/^农历：(.+)$/))) d.lunar = m[1];
    else if ((m = t.match(/^生肖：(.+)$/))) { const p = m[1].split(/\s+/); d.shengxiao = p[0]; d.xingzuo = p[1] || ''; }
    else if ((m = t.match(/^四柱：(.+)$/))) {
      d.pillars = m[1].split(/\s{2,}/).map(s => {
        const mm = s.match(/^(.柱)(.+)\((.+)\)$/);
        return mm ? { label: mm[1], ganzhi: mm[2], shishen: mm[3] } : null;
      }).filter(Boolean);
    }
    else if ((m = t.match(/^藏干十神：(.+)$/))) {
      d.canggan = m[1].split(/\s{2,}/).map(s => {
        const mm = s.match(/^(.支)藏\[(.*?)\]十神\[(.*?)\]$/);
        if (!mm) return null;
        const gz = mm[2].split(',');
        const ss = mm[3].split(',');
        return { label: mm[1], pairs: gz.map((g, i) => ({ g, s: ss[i] || '' })) };
      }).filter(Boolean);
    }
    else if ((m = t.match(/^纳音：(.+)$/))) d.nayin = m[1].split('/');
    else if ((m = t.match(/^胎元：(.+)$/))) d.taiyuanLine = m[1];
    else if ((m = t.match(/^空亡：(.+)$/))) d.xiwang = m[1];
    else if ((m = t.match(/^起运：(.+)$/))) d.qiyun = m[1];
    else if ((m = t.match(/^大运：(.+)$/))) {
      d.dayun = m[1].split(/\s{2,}/).map(s => {
        const mm = s.match(/^(\d+)岁(.+)\((.+)\)$/);
        return mm ? { start: +mm[1], ganzhi: mm[2], shishen: mm[3] } : null;
      }).filter(Boolean);
    }
    else if ((m = t.match(/^五行局：(.+?)\s+命宫地支：(.+?)\s+身宫地支：(.+)$/))) {
      d.wuxingju = m[1]; d.mingDizhi = m[2]; d.shenDizhi = m[3];
    }
    else if ((m = t.match(/^(.+?)\(([子丑寅卯辰巳午未申酉戌亥])\)(\[身宫\])?：(.+)$/))) {
      d.gong.push({ name: m[1], dizhi: m[2], isShen: !!m[3], stars: m[4].split('、').filter(Boolean) });
    }
  }
  // 胎元/命宫/身宫 合并行拆开
  d.sanGong = (d.taiyuanLine || '').split(/\s{2,}/).map(s => {
    const mm = s.match(/^(.+?)：(.+)$/);
    return mm ? { k: mm[1], v: mm[2] } : null;
  }).filter(Boolean);
  return d;
}

// ---------- 解读区 md → html ----------
function inlineFmt(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function mdToHtml(md) {
  const sections = [];
  const out = [];
  let ul = false, ol = false, secIdx = 0;
  const closeList = () => {
    if (ul) { out.push('</ul>'); ul = false; }
    if (ol) { out.push('</ol>'); ol = false; }
  };
  for (const raw of md.split('\n')) {
    const t = raw.trim();
    if (!t || t === '---') { closeList(); continue; }
    if (t.startsWith('# ')) { closeList(); continue; }                    // AI 总标题，页面已有头部，跳过
    if (t.startsWith('## ')) {
      closeList(); secIdx++;
      const title = t.slice(3).replace(/\*\*/g, '');
      const id = 'sec-' + secIdx;
      sections.push({ id, title });
      out.push(`<h2 class="j-h2" id="${id}">${title}</h2>`);
    } else if (t.startsWith('### ')) {
      closeList();
      out.push(`<h3 class="j-h3">${t.slice(4)}</h3>`);
    } else if (/^\*\*[^*]+\*\*$/.test(t)) {                               // 整行加粗 → 小标题
      closeList();
      out.push(`<h3 class="j-h3">${t.slice(2, -2)}</h3>`);
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      if (ol) { out.push('</ol>'); ol = false; }
      if (!ul) { out.push('<ul>'); ul = true; }
      out.push(`<li>${inlineFmt(t.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(t)) {
      if (ul) { out.push('</ul>'); ul = false; }
      if (!ol) { out.push('<ol>'); ol = true; }
      out.push(`<li>${inlineFmt(t.replace(/^\d+\.\s/, ''))}</li>`);
    } else {
      closeList();
      out.push(`<p>${inlineFmt(t)}</p>`);
    }
  }
  closeList();
  return { html: out.join('\n'), sections };
}

// ---------- 八字区 ----------
function currentDayunIndex(d) {
  const ym = (d.birthday || '').match(/(\d{4})-/);
  if (!ym || !d.dayun.length) return -1;
  const birthYear = +ym[1];
  const now = new Date();
  const sui = now.getFullYear() - birthYear + 1;                          // 虚岁
  let idx = 0;
  d.dayun.forEach((dy, i) => { if (sui >= dy.start) idx = i; });
  return idx;
}

function renderBazi(d) {
  const cgByLabel = {};
  d.canggan.forEach(c => { cgByLabel[c.label] = c.pairs; });

  const cards = d.pillars.map((p, i) => {
    const cg = (cgByLabel[p.label.replace('柱', '支')] || [])
      .map(x => `<div class="cg-line">${x.g}<span class="cg-ss">${x.s}</span></div>`).join('');
    return `<div class="pillar">
      <div class="p-label">${p.label}</div>
      <div class="p-gz">${p.ganzhi}</div>
      <div class="p-ss">${p.shishen}</div>
      <div class="p-cg">${cg}</div>
      <div class="p-ny">${d.nayin[i] || ''}</div>
    </div>`;
  }).join('');

  const curIdx = currentDayunIndex(d);
  const dayun = d.dayun.map((dy, i) => `
    <div class="dy${i === curIdx ? ' cur' : ''}">
      <div class="dy-age">${dy.start}岁</div>
      <div class="dy-gz">${dy.ganzhi}</div>
      <div class="dy-ss">${dy.shishen}</div>
      ${i === curIdx ? '<div class="dy-badge">当前</div>' : ''}
    </div>`).join('');

  const sanGong = d.sanGong.map(x => `<span class="chip"><b>${x.v}</b>　${x.k}</span>`).join('');
  const qiyun = d.qiyun ? `<span class="chip">起运　<b>${d.qiyun}</b></span>` : '';
  const xiwang = d.xiwang ? `<span class="chip">空亡　<b>${d.xiwang}</b></span>` : '';

  return `<section id="sec-bazi">
  <h2 class="sec-title">八字四柱</h2>
  <div class="pillar-grid">${cards}</div>
  <div class="chip-row">${sanGong}${qiyun}${xiwang}</div>
  <h2 class="sec-title">大运流步</h2>
  <div class="dy-track">${dayun}</div>
  </section>`;
}

// ---------- 紫微 4×4 ----------
const GRID_ORDER = ['巳', '午', '未', '申', '辰', '酉', '卯', '戌', '寅', '丑', '子', '亥'];
const LEVEL_COLOR = { '庙': 'lv-miao', '旺': 'lv-wang', '得': 'lv-de', '利': 'lv-li', '平': 'lv-ping', '陷': 'lv-xian' };
const HUA_CLS = { '禄': 'hua-lu', '权': 'hua-quan', '科': 'hua-ke', '忌': 'hua-ji' };

function renderStar(star) {
  let hua = '', level = '', name = star;
  const mh = star.match(/\((化(.))\)$/);
  if (mh) { hua = mh[2]; name = star.slice(0, mh.index); }
  const lv = name.slice(-1);
  if (LEVEL_COLOR[lv]) { level = lv; name = name.slice(0, -1); }
  return `<div class="star${level ? ' ' + LEVEL_COLOR[level] : ''}">${name}${level ? `<i class="lv">${level}</i>` : ''}${hua ? `<i class="hua ${HUA_CLS[hua]}">化${hua}</i>` : ''}</div>`;
}

function renderZiwei(d) {
  const byDizhi = {};
  d.gong.forEach(g => { byDizhi[g.dizhi] = g; });
  const cells = GRID_ORDER.map(dz => {
    const g = byDizhi[dz];
    if (!g) return `<div class="gong"><div class="g-head">${dz}</div></div>`;
    const isMing = g.name === '命宫';
    const cls = ['gong', isMing ? 'g-ming' : '', g.isShen ? 'g-shen' : ''].filter(Boolean).join(' ');
    const stars = g.stars.map(renderStar).join('');
    return `<div class="${cls}">
      <div class="g-head"><span class="g-name">${g.name}</span><span class="g-dz">${dz}</span></div>
      ${g.isShen ? '<span class="g-shen-badge">身宫</span>' : ''}
      <div class="g-stars">${stars}</div>
    </div>`;
  }).join('');

  return `<section id="sec-ziwei">
  <h2 class="sec-title">紫微命盘</h2>
  <div class="zw-scroll"><div class="zw-grid">
    <div class="zw-center">
      <div class="zc-name">${d.name || ''} <span class="zc-gender">${d.gender || ''}命</span></div>
      <div class="zc-line">五行局　<b>${d.wuxingju || ''}</b></div>
      <div class="zc-line">命宫在<b>${d.mingDizhi || ''}</b>　身宫在<b>${d.shenDizhi || ''}</b></div>
      <div class="zc-line zc-dim">${d.lunar || ''}</div>
      <div class="zc-line zc-dim">${d.trueSolar ? '真太阳时 ' + d.trueSolar : ''}</div>
    </div>
    ${cells}
  </div></div>
  <div class="zw-legend">
    <span><i class="dot" style="background:#4ea56c"></i>化禄</span>
    <span><i class="dot" style="background:#e74c3c"></i>化权</span>
    <span><i class="dot" style="background:#5b8db8"></i>化科</span>
    <span><i class="dot" style="background:#8a7a8f"></i>化忌</span>
    <span style="margin-left:auto;color:var(--text-faint)">庙 旺 得 利 平 陷 = 星曜亮度</span>
  </div>
  </section>`;
}

// ---------- 组装页面 ----------
function buildHtml(d, jiepanHtml, sections, version, outName) {
  const navItems = [
    { id: 'sec-bazi', title: '八字' },
    { id: 'sec-ziwei', title: '紫微命盘' },
    ...sections.map(s => ({ id: s.id, title: s.title.replace(/^[一二三四五六七八九十]+、/, '') })),
  ];
  const nav = navItems.map(n => `<a class="nav-a" href="#${n.id}">${n.title}</a>`).join('');
  const today = new Date().toISOString().slice(0, 10);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${d.name || '命主'} · 命盘解盘报告</title>
<style>
:root{
  --bg:#0d1614; --bg2:#13201c; --card:#1a2925; --card2:#20322d; --line:#2d423c; --line2:#3a544c;
  --gold:#c9a961; --gold-bright:#e6c982; --gold-dim:#7d6a40;
  --red-bright:#e74c3c; --green:#4ea56c; --blue:#5b8db8;
  --text:#ece4d3; --text-dim:#9c9586; --text-faint:#6b665b;
  --serif:"STSong","Songti SC","SimSun","Noto Serif SC",serif;
  --sans:"Microsoft YaHei","PingFang SC","Helvetica Neue",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.7;
  background-image:radial-gradient(circle at 20% 10%,rgba(201,169,97,.05),transparent 40%),radial-gradient(circle at 80% 90%,rgba(78,165,108,.04),transparent 40%)}
.wrap{max-width:1180px;margin:0 auto;padding:32px 28px 80px}
/* header */
.header{position:relative;padding:28px 32px 24px;border:1px solid var(--line);border-radius:14px;
  background:linear-gradient(135deg,var(--card) 0%,var(--bg2) 100%);overflow:hidden;margin-bottom:18px}
.header::before{content:"";position:absolute;right:-40px;top:-40px;width:220px;height:220px;
  background:radial-gradient(circle,rgba(201,169,97,.08),transparent 70%);pointer-events:none}
.h-title{font-family:var(--serif);font-size:30px;font-weight:700;color:var(--gold-bright);letter-spacing:3px}
.h-sub{color:var(--text-dim);font-size:13px;margin-top:6px;letter-spacing:1px}
.h-info{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.chip{font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--line2);color:var(--text-dim);background:rgba(255,255,255,.02)}
.chip b{color:var(--gold);font-weight:600}
.gold-line{height:1px;background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);margin-top:18px}
.h-version{position:absolute;right:20px;top:18px;font-size:11px;color:var(--text-faint);letter-spacing:1px}
/* nav */
.nav{display:flex;flex-wrap:wrap;gap:8px;position:sticky;top:0;z-index:20;padding:10px 0;margin-bottom:20px;
  background:linear-gradient(var(--bg) 75%,transparent)}
.nav-a{padding:7px 16px;border-radius:20px;border:1px solid var(--line);background:var(--card);color:var(--text-dim);
  cursor:pointer;font-size:13px;text-decoration:none;transition:all .2s;white-space:nowrap}
.nav-a:hover{border-color:var(--gold-dim);color:var(--text)}
.nav-a.active{background:linear-gradient(135deg,var(--gold) 0%,var(--gold-dim) 100%);color:#1a1408;border-color:var(--gold);font-weight:600}
/* section */
section{margin-bottom:36px}
.sec-title{font-family:var(--serif);font-size:21px;color:var(--gold-bright);letter-spacing:3px;margin:10px 0 16px;
  display:flex;align-items:center;gap:10px}
.sec-title::before{content:"";width:4px;height:20px;background:var(--gold);border-radius:2px}
/* 八字 四柱 */
.pillar-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.pillar{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 16px;text-align:center;
  border-top:3px solid var(--gold-dim)}
.p-label{font-size:12px;color:var(--text-dim);letter-spacing:2px}
.p-gz{font-family:var(--serif);font-size:30px;font-weight:700;color:var(--gold-bright);margin:8px 0 4px;letter-spacing:2px}
.p-ss{display:inline-block;font-size:11px;color:var(--gold);border:1px solid var(--line2);border-radius:10px;padding:1px 10px;margin-bottom:10px}
.p-cg{border-top:1px dashed var(--line);padding-top:8px}
.cg-line{font-size:12px;color:var(--text-dim)}
.cg-ss{color:var(--text-faint);font-size:11px;margin-left:6px}
.p-ny{font-size:11px;color:var(--text-faint);margin-top:8px;letter-spacing:1px}
.chip-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
/* 大运 */
.dy-track{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}
.dy{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 8px;text-align:center;position:relative;transition:transform .15s}
.dy:hover{transform:translateY(-3px)}
.dy-age{font-size:11px;color:var(--text-faint)}
.dy-gz{font-family:var(--serif);font-size:19px;font-weight:700;color:var(--text);margin:4px 0 2px}
.dy-ss{font-size:11px;color:var(--text-dim)}
.dy.cur{background:linear-gradient(150deg,rgba(201,169,97,.18),var(--card));border-color:var(--gold);box-shadow:0 4px 16px rgba(201,169,97,.18)}
.dy.cur .dy-gz{color:var(--gold-bright)}
.dy-badge{position:absolute;top:-9px;right:-6px;font-size:10px;background:linear-gradient(135deg,var(--gold),var(--gold-dim));
  color:#1a1408;border-radius:8px;padding:1px 7px;font-weight:600}
/* 紫微 4×4 */
.zw-scroll{overflow-x:auto;padding-bottom:6px}
.zw-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));grid-auto-rows:minmax(120px,auto);gap:6px;min-width:640px}
.zw-center{grid-column:2/4;grid-row:2/4;background:linear-gradient(150deg,var(--card2),var(--bg2));
  border:1px solid var(--line2);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px}
.zc-name{font-family:var(--serif);font-size:24px;color:var(--gold-bright);letter-spacing:3px}
.zc-gender{font-size:14px;color:var(--text-dim);letter-spacing:1px}
.zc-line{font-size:13px;color:var(--text-dim)}
.zc-line b{color:var(--gold);font-weight:600}
.zc-dim{font-size:12px;color:var(--text-faint)}
.gong{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;position:relative;overflow:hidden}
.g-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:4px;margin-bottom:5px}
.g-name{font-family:var(--serif);font-size:14px;color:var(--gold);letter-spacing:1px}
.g-dz{font-size:11px;color:var(--text-faint)}
.gong.g-ming{border:1.5px solid var(--gold);background:linear-gradient(160deg,rgba(201,169,97,.1),var(--card))}
.gong.g-shen{box-shadow:inset 0 0 0 1px var(--blue)}
.g-shen-badge{position:absolute;top:4px;right:6px;font-size:9px;color:var(--blue);border:1px solid var(--blue);border-radius:6px;padding:0 4px}
.g-stars{display:flex;flex-direction:column;gap:2px}
.star{font-size:12px;color:var(--text);display:flex;align-items:center;gap:4px}
.star .lv{font-style:normal;font-size:10px;color:var(--text-faint)}
.lv-miao,.lv-wang{color:var(--gold-bright)}
.lv-de,.lv-li{color:var(--gold)}
.lv-ping{color:var(--text-dim)}
.lv-xian{color:var(--red-bright)}
.hua{font-style:normal;font-size:9px;border-radius:5px;padding:0 4px;margin-left:2px}
.hua-lu{background:rgba(78,165,108,.2);color:var(--green)}
.hua-quan{background:rgba(231,76,60,.18);color:var(--red-bright)}
.hua-ke{background:rgba(91,141,184,.18);color:var(--blue)}
.hua-ji{background:rgba(140,120,140,.2);color:#a89ab0}
.zw-legend{display:flex;gap:16px;font-size:12px;color:var(--text-dim);margin-top:10px;flex-wrap:wrap;align-items:center}
.zw-legend span{display:inline-flex;align-items:center;gap:5px}
.dot{width:12px;height:12px;border-radius:3px;display:inline-block}
/* 解读 */
.jiepan{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:26px 30px}
.j-h2{font-family:var(--serif);font-size:19px;color:var(--gold-bright);letter-spacing:2px;margin:30px 0 12px;
  padding-left:12px;border-left:3px solid var(--gold);scroll-margin-top:70px}
.jiepan .j-h2:first-child{margin-top:0}
.j-h3{font-family:var(--serif);font-size:15px;color:var(--gold);margin:18px 0 8px;letter-spacing:1px}
.jiepan p{font-size:14px;color:var(--text);line-height:1.95;margin:8px 0;text-align:justify}
.jiepan b{color:var(--gold-bright);font-weight:600}
.jiepan ul,.jiepan ol{margin:8px 0 8px 22px}
.jiepan li{font-size:14px;color:var(--text);line-height:1.9;margin:5px 0}
.foot{text-align:center;color:var(--text-faint);font-size:12px;margin-top:30px;letter-spacing:1px;line-height:2}
@media(max-width:760px){
  .wrap{padding:20px 14px 60px}
  .pillar-grid{grid-template-columns:repeat(2,1fr)}
  .dy-track{grid-template-columns:repeat(3,1fr)}
  .h-title{font-size:24px}
  .jiepan{padding:18px 16px}
}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="h-version">${version}</div>
    <div class="h-title">${d.name || '命主'} · 命盘解盘</div>
    <div class="h-sub">${d.gender || ''}命　·　公历 ${d.birthday || ''}　·　${d.region || ''}</div>
    <div class="h-info">
      <span class="chip">农历　<b>${d.lunar || ''}</b></span>
      <span class="chip">生肖　<b>${d.shengxiao || ''}</b></span>
      <span class="chip">星座　<b>${d.xingzuo || ''}</b></span>
      <span class="chip">真太阳时　<b>${d.trueSolar || ''}</b></span>
      <span class="chip">五行局　<b>${d.wuxingju || ''}</b></span>
    </div>
    <div class="gold-line"></div>
  </div>

  <nav class="nav" id="nav">${nav}</nav>

  ${renderBazi(d)}
  ${renderZiwei(d)}

  <section id="sec-jiepan">
    <h2 class="sec-title">命理解读</h2>
    <div class="jiepan">
${jiepanHtml}
    </div>
  </section>

  <div class="foot">紫微排盘解盘 · ${outName} · ${version} · 生成于 ${today}<br>· 命理推演仅供参考，命在人不在天 ·</div>
</div>
<script>
(function(){
  var links = document.querySelectorAll('.nav-a');
  links.forEach(function(a){ a.addEventListener('click', function(){ links.forEach(function(x){x.classList.remove('active')}); a.classList.add('active'); }); });
  if (links.length) links[0].classList.add('active');
})();
</script>
</body>
</html>`;
}

// ---------- 主流程 ----------
const mdPath = process.argv[2];
if (!mdPath) {
  console.log('用法: node gen_paipan_html.js reports/xxx.md');
  process.exit(1);
}
const md = fs.readFileSync(mdPath, 'utf-8');
const idx = md.indexOf('## 命理解读');
const dataPart = idx >= 0 ? md.slice(0, idx) : md;
const jiepanPart = idx >= 0 ? md.slice(idx + 8) : '';

const d = parseData(dataPart);
if (!d.name) { console.error('解析失败：md 里找不到【命主】行，确认是 main.js 产出的报告'); process.exit(1); }
const { html: jiepanHtml, sections } = mdToHtml(jiepanPart);

const base = `${d.name}-命盘报告`;
const version = nextVersion(base);
const outName = `${base}_${version}.html`;
const outPath = path.join('reports', outName);
fs.writeFileSync(outPath, buildHtml(d, jiepanHtml, sections, version, outName), 'utf-8');

const removed = cleanupOld(base);
console.log(`✅ 已生成: ${outPath}`);
console.log(`   八字 ${d.pillars.length} 柱 | 大运 ${d.dayun.length} 步 | 紫微 ${d.gong.length} 宫 | 解读 ${sections.length} 章节`);
console.log(`   文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
if (removed.length) console.log(`   已清理旧版本: ${removed.join('、')}`);
