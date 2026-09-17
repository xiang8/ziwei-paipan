# 紫微排盘解盘

八字 + 紫微斗数 **排盘 & AI 解盘** 工具。三套用法：① CLI 生成 md 报告；② 本地 Web（排盘+解盘）；③ 纯静态在线版（GitHub Pages，**访客自带 Key 直连**，无后端）。

## 技术栈
- **Node.js**（ES Modules，`"type":"module"`）
- 排盘：**iztro**（紫微）+ **lunar-javascript**（八字/农历/真太阳时）—— 纯计算，浏览器/Node 通用
- 解盘：**智谱 GLM-5.2**，Anthropic 兼容接口 `https://open.bigmodel.cn/api/anthropic/v1/messages`
- 前端打包：**esbuild**（paipan+iztro+lunar → 单 bundle，自托管，大陆不依赖境外 CDN）
- 在线部署：**Cloudflare Workers + Static Assets**（免备案、免费额度）
- HTTP：axios · 配置：dotenv

## 目录结构
```
紫微排盘解盘/
├── main.js              # CLI：命盘报告（排盘+解盘→md）
├── fortune.js           # CLI：运势（指定时段逐月）
├── fortune_halfyear.js  # CLI：运势（按半年切分，每半年调一次 GLM，边跑边存）
├── gen_fortune_html.js  # 运势 md → 单文件 HTML（通用版：总览热力图+三规律/红线+半年 tab）
├── gen_paipan_html.js   # 命盘报告 md → 单文件 HTML（四柱卡+大运时间轴+紫微4×4方格盘+解读锚点导航）
├── htmlver.js           # HTML 版本号共享模块（reports/.html_versions.json，自动递增，保留最近 3 版）
├── verify.js / verify_bazi.js / verify_ziwei.js   # 对照劳翔基准盘验证
├── paipan/              # 排盘核心（纯计算，无 fs/path，浏览器可用）
│   ├── bazi.js          # 八字：四柱/十神/藏干/纳音/胎元/命宫/身宫/大运/流年/神煞/五行
│   ├── ziwei.js         # 紫微：iztro 封装（十二宫/主星辅星/四化/大限）
│   ├── solar.js  shensha.js  wuxing.js  cities.js   # 真太阳时/神煞/五行/城市经纬度
├── jiepan/              # AI 解盘
│   ├── ai_service.js    # chatGLM（智谱 Anthropic 兼容）
│   └── prompts.js       # 命理大师 system prompt + 排盘数据格式化
├── config/settings.js   # 读 .env
├── web/                 # ★ 在线版（纯静态：浏览器排盘 + 访客自带 Key 直连 LLM 解盘）
│   ├── index.html       # 暗色中式 UI（输入表单 + API配置卡 + 解盘模式选择 + 八字卡 + 紫微4×4方格盘 + 解盘区）
│   ├── src/main.js      # 浏览器入口：排盘渲染 + PROVIDERS 厂商预设表 + callLLM 直连（openai/anthropic 双格式）+ BYOK localStorage
│   ├── src/worker.js    # （旧）Cloudflare Worker 站主key代理，BYOK 改造后不再使用，留作参考
│   ├── src/_bundle_test.js   # 打包验证（排劳翔盘）
│   ├── dev-server.js    # （旧）本地一体服务，BYOK 后前端不再调 /api/jiepan
│   ├── wrangler.toml    # （旧）Cloudflare 配置
│   ├── README.md        # 在线版说明
│   └── dist/bundle.js   # esbuild 产物（1.3MB，自托管；build:web 生成）
├── reports/             # 输出（md 报告 + 精美 html；.gitignore 已忽略）
│   ├── 2001-07-18-1150-广东省茂名-劳翔-男.md   # 命盘报告（劳翔）
│   ├── 1980-08-08-1800-福建省南平-黄丽仙-女.md # 命盘报告（黄丽仙）
│   ├── 劳翔-运势2026至2030-按半年.md / 黄丽仙-运势2026至2030-按半年.md  # 运势 md（均 10/10 段跑完）
│   ├── 黄丽仙-命盘报告_v0.0.1.html / 黄丽仙-运势2026-2030_v0.0.1.html  # 精美 html（带版本号）
│   ├── <姓名>-rules.json                       # 可选：运势 html 的三规律+红线卡配置（如 黄丽仙-rules.json）
│   └── .html_versions.json                     # html 版本计数（htmlver.js 维护）
│   ※ 劳翔/黄丽仙运势 2026-2030 均已跑完；专项规律直接查现有报告，无需重跑
└── .env                 # ZHIPU_API_KEY（见 .env.example）
```

## 用法

### A. CLI（生成 md 报告）
```bash
node main.js --name 张三 --year 2001 --month 7 --day 18 --hour 11 --minute 50 --region 广东省茂名市 --gender 男
node fortune_halfyear.js --name 张三 --gender 女 --year 1980 --month 8 --day 8 --hour 18 --minute 0 --region 福建省南平市 --from 2026 --to 2030
                              # ⚠️ 生辰参数必须传全——不传会用劳翔默认值；10 段约 5 分钟
node gen_fortune_html.js reports/张三-运势2026至2030-按半年.md   # 运势 md → html（通用）
node gen_paipan_html.js reports/2001-...-张三-男.md              # 命盘 md → html（通用）
node verify_bazi.js / node verify_ziwei.js                   # 验证
```

### B. 本地 Web（排盘 + 解盘，无需部署）
```bash
npm run dev:local    # → http://localhost:5174 （静态 + 本地代理智谱，端到端可用）
# 只看排盘不解盘：npm run preview（5173，纯静态）
```

### C. 在线版（GitHub Pages，纯静态 BYOK，2026-09-18 改造）
- **架构**：排盘 iztro/lunar 浏览器算 + 解盘访客自带 Key 浏览器直连厂商 API，**无后端**、站主零费用
- **BYOK**：`PROVIDERS` 预设表（智谱/DeepSeek/Kimi/通义/豆包/硅基流动/OpenRouter/Gemini/Claude/Groq/自定义中转），配置存 localStorage（`ziwei_byok_cfg`），支持 OpenAI 格式 + Claude 格式（anthropic 自动加 `anthropic-dangerous-direct-browser-access` 头）
- **模型列表 2026-09-18 全量更新**：智谱 glm-5.3/5.2（实测可用；Coding 套餐 key 走自定义 anthropic 端点，按量 key 用 paas/v4 预设）、Kimi k2-turbo、通义 qwen3-max、豆包 seed-1.6、Gemini 3、Claude 5 系、GPT-5.1；模型名仅快捷项，访客可手填
- **AI 配置卡**：未配置时默认弹开、保存后收起；排布遵守根 CLAUDE.md「UI 排布爱对称」（标签短化+nowrap、select 固定 height 42px、容器 align-items:center）
- **两种解盘模式**：总体命盘（八节结构）/ 流年运势（选年份，逐月吉凶）
- **CORS 实测**：DeepSeek/智谱（anthropic+paas 双格式）✅；OpenAI 官方 ❌（UI 标注走中转）；境外厂商大陆访客需自备网络
- 部署：推 main → GitHub Actions 自动 build:web + 发 Pages（`.github/workflows/pages.yml`）→ **https://ziwei.005718.xyz**（仓库 github.com/xiang8/ziwei-paipan，凭据走 Git Credential Manager；自定义域名 web/CNAME + Pages API 已配；DNS：Cloudflare `ziwei` CNAME **橙云** → xiang8.github.io，橙云走 CF 边缘证书 `*.005718.xyz`（大陆可达 + 免等 GitHub 签证书，2026-09-18 实测生效）
- 已验证（2026-09-18）：bundle 排盘与劳翔基准一致；DeepSeek/智谱三通路 HTTP 200

### 构建
```bash
npm run build:web    # esbuild 打包前端 → web/dist/bundle.js
npm run dev:web      # watch 模式
```

## 配置（.env）
```
ZHIPU_API_KEY=xxx
ZHIPU_MODEL=glm-5.2
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/anthropic
```

## 验证基准
`D:\工作文件\ai\其他\紫微\2001-07-18-11 50-广东省茂名市-劳翔-男-ai分析版.txt`
- 八字：四柱/十神/藏干/纳音/胎元/命宫/身宫/空亡/起运/大运/神煞/流年 **全部命中**
- 紫微：十二宫星曜 **100% 命中**
- 已知分歧：命宫地支 = 工具「子」（iztro 标准逆布） vs 基准文档「丑」（顺布）——星曜分布一致，仅地支标签不同

## 关键设计 / 踩坑
- **iztro 是浏览器同构库**：`node_modules/iztro/dist/iztro.min.js` 可直接用；esbuild 一键打包 paipan+iztro+lunar
- **paipan 纯计算**：无 fs/path 依赖，Node 和浏览器通用，Web 端零服务器排盘
- 解盘走智谱 **Anthropic 兼容接口**（coding plan 套餐，不能用 paas/v4）
- **GLM 思考块陷阱**（ai_service.js）：glm-5.2 长 prompt 触发思考，返回 `content[0]` 可能是 thinking 块、text 在后面——必须 `find(b => b.type === 'text')` 取值；短请求不触发思考，简单测试看不出问题（曾导致解盘全变 undefined）
- **GLM 运势输出有格式变体**：月标题有 `己丑【平】`/`【平】己未月（七杀月）`/`乙丑【平】**（注）` 三种；吉凶标签有【平偏吉】【平偏凶】【凶中藏机，慎用】等复合词。gen_fortune_html.js 已全兼容（黄丽仙盘 60/60 月零丢失），归档规则：`^吉`→吉、含`凶`→凶、其余→平；月卡无「事业：」等字段标签时自动降级 bullet 卡
- **HTML 产出走版本号**：gen_paipan_html / gen_fortune_html 共用 htmlver.js（reports/.html_versions.json 持久化、自动递增、保留最近 3 版）；运势 html 的三规律/红线卡配置在 `reports/<姓名>-rules.json`（可选，缺省跳过两卡）
- 「半年解一次」：每半年独立调一次 GLM，单段聚焦质量高，边跑边存防中断
- **反斜杠陷阱**（gen_fortune_html.js / web 模板）：Node 反引号模板会把 `\` 当转义吃掉，正则 `/\*\*/g` 会退化成 `/**/g`（注释+裸变量）。**模板内前端 JS 一律不用正则，改用 `split`/`indexOf`/`slice`**
- **流月是节气月**：运势报告里「2026年6月（甲午）」的公历月份只是近似标签，实际按节气切月（午月=芒种~小暑≈6/6-7/6、子月=大雪~小寒≈12/7-1/5）。读报告、续算运势、定位具体日期时注意边界，别把 7 月初的事算到未月头上
- Worker key 放 `wrangler secret`，不进代码；前端不持有 key（※ BYOK 改造后 Worker 弃用，key 由访客自带）
- 大陆可用保证：国产 API 预设（智谱/DeepSeek/Kimi 等）+ 系统字体（不引 Google Fonts）+ 库打进 bundle 自托管（不引境外 CDN）+ GitHub Pages

## 参考来源
- 紫微引擎：https://github.com/SylarLong/iztro
- 农历：https://github.com/6tail/lunar-javascript
- 参考应用：`Renhuai123/ziwei-doushu`（Next.js，倪派，城市经纬度表来源）
- 数据 schema 参考：`DestinyLinker/MingLi-Bench`
