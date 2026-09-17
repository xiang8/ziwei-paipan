// Cloudflare Worker：代理智谱 GLM-5.2（Anthropic 兼容接口）
// 前端 POST /api/jiepan { basic, bazi, ziwei, type } → { text }
// key 放 wrangler secret（ZHIPU_API_KEY），前端/用户无感、不暴露。
import { SYSTEM_PROMPT, buildUserPrompt } from '../../jiepan/prompts.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // CORS 预检
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (url.pathname !== '/api/jiepan') return json({ error: 'Not Found' }, 404, env);
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405, env);

    let body;
    try { body = await req.json(); } catch { return json({ error: '无效 JSON' }, 400, env); }
    const { basic = '', bazi, ziwei, type = 'chart' } = body;
    if (!bazi || !ziwei) return json({ error: '缺少排盘数据' }, 400, env);

    const userPrompt = type === 'fortune'
      ? buildFortunePrompt(body)
      : buildUserPrompt({ basic, bazi, ziwei });

    if (!env.ZHIPU_API_KEY) return json({ error: 'Worker 未配置 ZHIPU_API_KEY（wrangler secret put ZHIPU_API_KEY）' }, 500, env);

    const base = (env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/anthropic').replace(/\/$/, '');
    let resp;
    try {
      resp = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': env.ZHIPU_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.ZHIPU_MODEL || 'glm-5.2',
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.7,
          max_tokens: 8192,
        }),
      });
    } catch (e) { return json({ error: '调用智谱失败：' + e.message }, 502, env); }

    let data;
    try { data = await resp.json(); } catch { return json({ error: `智谱返回非 JSON (${resp.status})` }, 502, env); }
    if (!resp.ok) return json({ error: data.error?.message || `智谱返回 ${resp.status}` }, 502, env);

    const text = data.content?.[0]?.text || '';
    return json({ text });
  },
};

function corsHeaders(env) {
  // ALLOWED_ORIGIN 配置可收紧到自己的域名；默认 * 方便本地联调
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(obj, status = 200, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  });
}

// 运势解盘 prompt（预留，前端目前只发 chart）
function buildFortunePrompt(body) {
  return `${body.basic || ''}

${body.bazi}

${body.ziwei}

请基于以上命局，分析指定时段运势（整体基调、逐月吉凶【吉/平/凶】、关键月、行动建议）。`;
}
