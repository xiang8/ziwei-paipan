# 紫微排盘解盘 · 在线版（Cloudflare）

浏览器端实时排盘（八字 + 紫微 4×4 方格盘）+ 智谱 GLM-5.2 AI 解盘。
**大陆可用**：智谱国产 API + 系统字体 + 库自托管（不依赖境外 CDN）+ Cloudflare（免备案、免费额度）。

## 架构
- **前端**：`index.html` + `src/main.js`（esbuild 打包成 `dist/bundle.js`），排盘全在浏览器跑（iztro + lunar-javascript），零服务器计算
- **后端**：`src/worker.js`（Cloudflare Worker），只做一件事——代理智谱 GLM（`/api/jiepan`），key 放 Worker secret，用户无感
- **部署**：Workers Static Assets，前后端一个 Worker

## 本地预览（只看排盘，不需要 Worker）

```bash
npm run build:web       # 打包前端 bundle
npm run preview         # 起静态服务 → http://localhost:5173
```
打开浏览器看排盘。AI 解盘按钮此时会提示"未配置 Worker URL"（正常，需部署 Worker 才能解盘）。

## 完整本地联调（含解盘）

```bash
npm i -D wrangler                       # 装 Cloudflare CLI
npx wrangler login                      # 登录你的 Cloudflare 账号
npx wrangler secret put ZHIPU_API_KEY   # 粘贴 .env 里的智谱 key
npm run dev                             # 起 wrangler dev → http://localhost:8787
```
然后在 `web/src/main.js` 顶部把 `WORKER_URL` 设为 `'http://localhost:8787'`，重新 `npm run build:web`，刷新即可端到端测试。

## 部署上线

```bash
npm run deploy      # = build:web + wrangler deploy
```
部署完拿到 `https://ziwei-paipan.<你的子域>.workers.dev`。

**上线后改一处**：把 `web/src/main.js` 顶部的 `WORKER_URL` 改成你的 Worker 域名（同域可设为空字符串走相对路径，见下），重新 `npm run deploy`。

> 同域优化：Worker 和前端同站时，`WORKER_URL` 可设为 `''` 并把 fetch 改成 `'/api/jiepan'`（相对路径），省一次配置。当前代码已是 `${WORKER_URL}/api/jiepan`，`WORKER_URL=''` 时即相对路径。

## 安全收紧（上线后建议）

`web/wrangler.toml` 里取消 `ALLOWED_ORIGIN` 注释，设成你的域名，防止他人盗用你的 Worker 调智谱（消耗你的额度）。

## 大陆访问

- `workers.dev` 子域大陆大部分时候流畅，极偶尔慢；绑自定义域名（仍走 Cloudflare）更稳
- 智谱 API 原生大陆，无墙
- 字体用系统字体、iztro/lunar 已打进 bundle 自托管，不依赖任何境外 CDN
