// 本地一体服务：托管 web/ 静态 + POST /api/jiepan 代理智谱 GLM（读 .env 的 ZHIPU_API_KEY）
// 用法: npm run dev:local → http://localhost:5174  （排盘 + 解盘都能用，无需部署）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { chatGLM } from '../jiepan/ai_service.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../jiepan/prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(__dirname);               // web/ 目录
const PORT = 5174;
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  // 解盘 API
  if (url.pathname === '/api/jiepan' && req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    try {
      const { basic = '', bazi, ziwei } = JSON.parse(body);
      const prompt = buildUserPrompt({ basic, bazi, ziwei });
      const text = await chatGLM(SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 8192 });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ text }));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 静态文件
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
    res.writeHead(404); res.end('Not Found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

server.listen(PORT, () => console.log(`本地排盘 + 解盘 → http://localhost:${PORT}`));
