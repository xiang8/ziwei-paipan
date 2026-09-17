/**
 * HTML 产出版本号管理（gen_paipan_html.js / gen_fortune_html.js 共用）
 * 版本持久化在 reports/.html_versions.json，同一 base 自动递增，仅保留最近 keep 版。
 */
import fs from 'fs';
import path from 'path';

const VERSION_FILE = 'reports/.html_versions.json';

export function nextVersion(base) {
  let all = {};
  try { all = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8')); } catch { /* 首次 */ }
  const n = (all[base] || 0) + 1;
  all[base] = n;
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(VERSION_FILE, JSON.stringify(all, null, 2), 'utf-8');
  return `v0.0.${n}`;
}

export function cleanupOld(base, keep = 3) {
  if (!fs.existsSync('reports')) return [];
  const re = new RegExp(`^${base}_v\\d+\\.\\d+\\.(\\d+)\\.html$`);
  const hits = fs.readdirSync('reports')
    .map(f => { const m = f.match(re); return m ? { f, n: +m[1] } : null; })
    .filter(Boolean)
    .sort((a, b) => b.n - a.n);
  const removed = [];
  for (const h of hits.slice(keep)) {
    fs.unlinkSync(path.join('reports', h.f));
    removed.push(h.f);
  }
  return removed;
}
