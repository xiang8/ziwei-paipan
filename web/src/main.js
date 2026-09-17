// 浏览器入口：输入 → 排盘 → 渲染 → 访客自带 Key 直连 LLM 解盘（纯静态，无后端）
import { paipanBazi } from '../../paipan/bazi.js';
import { paipanZiwei } from '../../paipan/ziwei.js';
import { findLongitude, PROVINCES } from '../../paipan/cities.js';
import { SYSTEM_PROMPT, buildUserPrompt, formatBaziText, formatZiweiText } from '../../jiepan/prompts.js';

// ===== 厂商预设（BYOK：访客自带 key，浏览器直连各厂商 API）=====
// cors: false = 该厂商官方接口禁浏览器直连，UI 提示走中转地址
const PROVIDERS = {
  zhipu: { label: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', style: 'openai',
    models: ['glm-5.3', 'glm-5.2', 'glm-4.7', 'glm-4-flash'],
    note: '按量 key 用本预设；Coding 套餐 key 请勾「自定义」填 https://open.bigmodel.cn/api/anthropic（Claude 格式）' },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', style: 'openai',
    models: ['deepseek-chat', 'deepseek-reasoner'], note: 'platform.deepseek.com 充值后创建 API Key，便宜好用' },
  kimi: { label: 'Kimi · 月之暗面', base: 'https://api.moonshot.cn/v1', style: 'openai',
    models: ['kimi-k2-turbo-preview', 'kimi-k2-0905-preview', 'moonshot-v1-128k'], note: 'platform.moonshot.cn' },
  qwen: { label: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', style: 'openai',
    models: ['qwen3-max', 'qwen-plus', 'qwen-turbo'], note: '阿里云百炼 bailian.console.aliyun.com' },
  doubao: { label: '豆包 · 火山方舟', base: 'https://ark.cn-beijing.volces.com/api/v3', style: 'openai',
    models: ['doubao-seed-1.6', 'doubao-seed-1.6-flash'], note: '可填模型名或接入点 Endpoint ID（ep- 开头），方舟控制台获取' },
  siliconflow: { label: '硅基流动', base: 'https://api.siliconflow.cn/v1', style: 'openai',
    models: ['deepseek-ai/DeepSeek-V3.2', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen3-235B-A22B-Instruct'], note: 'cloud.siliconflow.cn，新户有免费额度' },
  openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', style: 'openai',
    models: ['deepseek/deepseek-chat', 'anthropic/claude-sonnet-5', 'google/gemini-3-pro-preview'], note: 'openrouter.ai 一个 Key 调全球模型' },
  gemini: { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', style: 'openai',
    models: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'], note: 'aistudio.google.com 生成 API Key（需能访问 Google）' },
  claude: { label: 'Claude · Anthropic', base: 'https://api.anthropic.com', style: 'anthropic',
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5'], note: 'console.anthropic.com' },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', style: 'openai',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'], note: 'console.groq.com 免费额度，需能访问外网' },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', style: 'openai', cors: false,
    models: ['gpt-5.1', 'gpt-5', 'gpt-4o'], note: '⚠️ 官方接口禁浏览器直连：请勾选「自定义」，填中转站地址' },
  custom: { label: '自定义 / 中转站', base: '', style: 'openai',
    models: [], note: '填任意 OpenAI 兼容地址（或智谱 Anthropic 兼容端点 + Claude 格式）' },
};
const CFG_KEY = 'ziwei_byok_cfg';

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

// ===== BYOK 配置读写 =====
function readCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || '') || {}; } catch { return {}; }
}
function saveCfg(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
function hasKey() {
  const c = readCfg();
  return !!(c.apiKey && c.baseUrl && c.model);
}

// 初始化设置区：厂商下拉、回显已存配置、联动模型列表
function initApiPanel() {
  const sel = $('api-provider');
  Object.entries(PROVIDERS).forEach(([k, p]) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = p.label;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => applyProvider(sel.value, true));
  $('api-custom').addEventListener('change', () => {
    $('api-base-wrap').style.display = $('api-custom').checked ? '' : 'none';
    if ($('api-custom').checked) $('api-base').focus();
  });

  const cfg = readCfg();
  const pid = cfg.provider && PROVIDERS[cfg.provider] ? cfg.provider : 'deepseek';
  sel.value = pid;
  applyProvider(pid, false);
  $('api-key').value = cfg.apiKey || '';
  $('api-model').value = cfg.model || '';
  $('api-custom').checked = !!cfg.custom;
  $('api-base').value = cfg.customBase || '';
  $('api-base-wrap').style.display = cfg.custom ? '' : 'none';
  refreshStatus();
  if (!hasKey()) $('api-card').open = true;   // 未配置默认弹开，保存确认后收起
}
function applyProvider(pid, resetModel) {
  const p = PROVIDERS[pid] || PROVIDERS.custom;
  $('api-note').textContent = p.note || '';
  const dl = $('model-list');
  dl.innerHTML = '';
  p.models.forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    dl.appendChild(o);
  });
  if (resetModel) $('api-model').value = p.models[0] || '';
}
function refreshStatus() {
  const el = $('api-status');
  if (hasKey()) {
    const c = readCfg();
    const p = PROVIDERS[c.provider] || {};
    el.textContent = `已配置：${p.label || '自定义'} · ${c.model}`;
    el.className = 'api-ok';
  } else {
    el.textContent = '未配置（排盘免费可用，AI 解盘需自带 Key）';
    el.className = 'api-none';
  }
}
function saveApiCfg() {
  const pid = $('api-provider').value;
  const p = PROVIDERS[pid] || PROVIDERS.custom;
  const custom = $('api-custom').checked;
  const base = (custom ? $('api-base').value.trim() : p.base).replace(/\/+$/, '');
  if (!base) { alert('请填接口地址'); return; }
  const apiKey = $('api-key').value.trim();
  if (!apiKey) { alert('请填 API Key（在你所选厂商的控制台创建，只存在你自己的浏览器里）'); return; }
  const model = $('api-model').value.trim();
  if (!model) { alert('请填模型名（可从下拉选或手输）'); return; }
  saveCfg({ provider: pid, custom, customBase: custom ? base : '', baseUrl: base, apiKey, model, style: p.style });
  refreshStatus();
  $('api-card').open = false;
}
function clearApiCfg() {
  localStorage.removeItem(CFG_KEY);
  $('api-key').value = '';
  refreshStatus();
}

// ===== 直连 LLM（openai 兼容 / anthropic 两种格式）=====
async function callLLM(cfg, system, user) {
  let resp;
  const body = { temperature: 0.7, max_tokens: 8192 };
  if (cfg.style === 'anthropic') {
    Object.assign(body, { model: cfg.model, system, messages: [{ role: 'user', content: user }] });
    resp = await fetch(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // Anthropic 官方浏览器直连开关
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } else {
    Object.assign(body, {
      model: cfg.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      stream: false,
    });
    resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  let data;
  try { data = await resp.json(); } catch { throw new Error(`接口返回非 JSON (HTTP ${resp.status})`); }
  if (!resp.ok) throw new Error(data.error?.message || data.message || `接口返回 ${resp.status}`);

  // openai: choices[0].message.content；anthropic: content 数组取 text 块（思考模型的 thinking 块跳过）
  const text = cfg.style === 'anthropic'
    ? (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    : (data.choices?.[0]?.message?.content || '');
  if (!text) throw new Error('模型没有返回文本（换个模型试试，或降低 prompt 长度）');
  return text;
}

// 地支在 4×4 方格盘的位置（标准紫微盘，顺时针布列）
const BRANCH_POS = {
  巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4],
  辰: [2, 1], 酉: [2, 4],
  卯: [3, 1], 戌: [3, 4],
  寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4],
};

// 初始化城市下拉
function initCities() {
  const dl = $('cities');
  PROVINCES.forEach(p => p.cities.forEach(c => {
    const o = document.createElement('option');
    o.value = `${p.name}${c.name}`;
    dl.appendChild(o);
  }));
}

function readInput() {
  const name = $('f-name').value.trim() || '命主';
  const gender = $('f-gender').value;
  const dateStr = $('f-date').value;   // "2001-07-18"
  const timeStr = $('f-time').value;   // "11:50" 或空
  if (!dateStr) throw new Error('请选择出生日期');
  const [year, month, day] = dateStr.split('-').map(Number);
  const tparts = (timeStr || '12:00').split(':');
  const hour = +(tparts[0] ?? 12), minute = +(tparts[1] ?? 0);
  const region = $('f-region').value.trim();
  const found = findLongitude(region);
  const longitude = found ? found.longitude : 116.4;
  const regionLabel = found ? `${found.province}${found.city}` : (region || '未知');
  if (!found && region) console.warn('[警告] 未找到', region, '经度，用北京 116.4');
  return { name, gender, year, month, day, hour, minute, longitude, region: regionLabel };
}

// 八字卡
function renderBazi(bz) {
  const SHISHEN = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };
  const cols = bz.pillars.map(p => `
    <div class="bz-col">
      <div class="bz-key">${SHISHEN[p.key]}</div>
      <div class="bz-gz">${p.ganzhi}</div>
      <div class="bz-ss">${p.gan === bz.dayGan ? '日主' : p.ganShiShen}</div>
      <div class="bz-cg">${p.hideGan.join('·')}<br>(${p.zhiShiShen.join('/')})</div>
    </div>`).join('');
  const dy = bz.daYun.map(d => `${d.startAge}岁<b>${d.ganzhi}</b>(${d.ganShiShen})`).join('　');
  return `<div class="card"><div class="card-h">八字四柱</div>
    <div class="bz-grid">${cols}</div>
    <div class="bz-dy">纳音：${bz.pillars.map(p=>p.naYin).join(' / ')}　胎元：${bz.taiYuan.ganzhi}　命宫：${bz.mingGong.ganzhi}　身宫：${bz.shenGong.ganzhi}　空亡：${bz.xunKong}</div>
    <div class="bz-dy">大运：${dy}</div>
  </div>`;
}

// 紫微方格盘
function renderBoard(zw) {
  const palacesHtml = zw.palaces.map(p => {
    const [r, c] = BRANCH_POS[p.branch] || [1, 1];
    const major = p.majorStars.map(s => `${s.name}${s.brightness}` + (s.mutagen ? `<span class="mut">${s.mutagen}</span>` : '')).join('<br>');
    const minor = [...p.minorStars.map(s => s.name + (s.mutagen ? s.mutagen : '')), ...p.adjectiveStars].join(' ');
    const cls = [p.isSoulPalace ? 'soul' : '', p.isBodyPalace ? 'body' : ''].join(' ');
    const tag = p.isSoulPalace ? '★' : (p.isBodyPalace ? '☆' : '');
    return `<div class="palace ${cls}" style="grid-row:${r};grid-column:${c}">
      <div class="p-head"><span class="pn">${p.name}${tag}</span><span class="pb">${p.branch}</span></div>
      <div class="p-major">${major || '空宫'}</div>
      <div class="p-minor">${minor}</div>
      ${p.daXianRange ? `<div class="p-dax">${p.daXianRange[0]}-${p.daXianRange[1]}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="card"><div class="card-h">紫微命盘 · ${zw.fiveElementsClass}</div>
    <div class="board">
      ${palacesHtml}
      <div class="center">
        <div class="taiji">☯</div>
        <div class="name">${zw.input.name}</div>
        <div class="meta">${zw.input.gender}命 · ${zw.solarDate?.year || ''}-${pad(zw.input.month)}-${pad(zw.input.day)}</div>
        <div class="meta"><b>${zw.fiveElementsClass}</b> · 命宫<b>${zw.soulPalaceBranch}</b> · 身宫<b>${zw.bodyPalaceBranch}</b></div>
        <div class="meta">真太阳时 ${zw.solarTime.trueSolarTime}</div>
      </div>
    </div>
  </div>`;
}

// 排盘
let LAST = null; // 缓存最近一次排盘数据，供解盘用
function paipan() {
  const input = readInput();
  try {
    const bazi = paipanBazi(input);
    const ziwei = paipanZiwei(input);
    LAST = { input, bazi, ziwei };
    const info = `
      <div class="info-bar">
        <span>命主 <b>${input.name}</b></span>
        <span>${input.gender}命</span>
        <span>公历 <b>${input.year}-${pad(input.month)}-${pad(input.day)} ${pad(input.hour)}:${pad(input.minute)}</b></span>
        <span>${input.region}</span>
        <span>真太阳时 <b>${bazi.solarTime.trueSolarTime}</b></span>
        <span>农历 <b>${bazi.lunar}</b></span>
        <span>${bazi.shengXiao} · ${bazi.xingZuo}</span>
      </div>`;
    const r = $('result');
    r.innerHTML = info + renderBazi(bazi) + renderBoard(ziwei) + `<div id="interp-slot"></div>`;
    r.classList.add('show');
    $('btn-jiepan').disabled = false;
    location.hash = '#result';
  } catch (e) {
    $('result').innerHTML = `<div class="card"><div class="err">排盘出错：${e.message}</div></div>`;
    $('result').classList.add('show');
  }
}

// 解盘（访客自带 Key，浏览器直连；支持 总体命盘 / 流年运势 两种模式）
async function jiepan() {
  if (!LAST) return;
  if (!hasKey()) {
    $('api-card').open = true;
    $('api-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('api-key').focus();
    return;
  }
  const cfg = readCfg();
  const p = PROVIDERS[cfg.provider] || {};
  const mode = $('f-mode').value;                       // chart | fortune
  const year = +$('f-year').value || new Date().getFullYear();
  const slot = $('interp-slot');
  const modeLabel = mode === 'fortune' ? `${year} 流年运势` : '总体命盘';
  $('btn-jiepan').disabled = true;
  slot.innerHTML = `<div class="interp"><div class="card-h">AI 解盘</div><div class="loading">${p.label || '自定义'} · ${cfg.model} 推演中<span class="dot"></span><span class="dot"></span><span class="dot"></span><br><span class="tip">${modeLabel} · 约需 30-90 秒，请稍候</span></div></div>`;
  try {
    const { input, bazi, ziwei } = LAST;
    const basic = `命主：${input.name} ${input.gender}命　公历${input.year}-${pad(input.month)}-${pad(input.day)} ${pad(input.hour)}:${pad(input.minute)}　${input.region}\n真太阳时：${bazi.solarTime.trueSolarTime}（${ziwei.solarTime.timeName}时）　农历：${bazi.lunar}　${bazi.shengXiao}·${bazi.xingZuo}`;
    const user = mode === 'fortune'
      ? buildFortunePrompt({ basic, bazi: formatBaziText(bazi), ziwei: formatZiweiText(ziwei) }, year)
      : buildUserPrompt({ basic, bazi: formatBaziText(bazi), ziwei: formatZiweiText(ziwei) });
    const text = await callLLM(cfg, SYSTEM_PROMPT, user);
    slot.innerHTML = `<div class="interp"><div class="card-h">AI 解盘 · ${input.name} · ${modeLabel}</div><div class="interp-body">${mdToHtml(text)}</div></div>`;
  } catch (e) {
    const hint = /Failed to fetch|NetworkError|load failed/i.test(e.message)
      ? `<br><span class="tip">网络或跨域拦截：① 该厂商可能禁浏览器直连（如 OpenAI 官方），换厂商或勾选「自定义」填中转地址；② 境外接口国内需自备网络</span>` : '';
    slot.innerHTML = `<div class="interp"><div class="card-h">AI 解盘</div><div class="err">解盘失败：${e.message}${hint}</div></div>`;
  } finally {
    $('btn-jiepan').disabled = false;
  }
}

// 流年运势 prompt（浏览器端版，与 CLI fortune 同思路）
function buildFortunePrompt({ basic, bazi, ziwei }, year) {
  return `请基于以下排盘数据，为命主做 ${year} 年流年运势专题解读。

${basic}

${bazi}

${ziwei}

请先推算 ${year} 年流年干支、命主该年虚岁与所处大运，再按以下结构输出（用 Markdown 二级标题分节）：

## 一、流年总论
流年干支与命局的作用关系（生扶/克泄/天克地冲/鸳鸯合/伏吟等）、该年整体基调。

## 二、逐月运势
按节气月逐月列出（注明对应公历大致区间），每月一行：
**X月（干支）【吉/平/凶】**——一句话点出该月主题（事业/财/感情/健康有所侧重）。

## 三、关键节点
点出全年最顺的 2-3 个月与最需谨慎的 2-3 个月，说明命理依据。

## 四、趋避建议
务实的行动建议（求财节奏、变动与守成、健康、人际）。

注意：解读要有命理依据，引用具体星曜/十神/五行/大运/流年干支；不夸大、不恐吓；语言专业且通俗。`;
}

// 极简 Markdown → HTML（解盘输出渲染）
function mdToHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, m => '<ul>' + m + '</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>(\s*<(h\d|ul))/g, '$1').replace(/(<\/(h\d|ul)>)\s*<\/p>/g, '$1');
  return html;
}

// 绑定
initCities();
initApiPanel();
$('btn-paipan').addEventListener('click', paipan);
$('btn-jiepan').addEventListener('click', jiepan);
$('api-save').addEventListener('click', saveApiCfg);
$('api-clear').addEventListener('click', clearApiCfg);
$('f-mode').addEventListener('change', () => { $('f-year').style.display = $('f-mode').value === 'fortune' ? '' : 'none'; });
// 回车排盘
document.querySelector('.form-card').addEventListener('keydown', e => { if (e.key === 'Enter') paipan(); });
