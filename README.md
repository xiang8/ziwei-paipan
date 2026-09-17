# 紫微排盘 · 解盘（八字 + 紫微斗数）

**纯浏览器应用**：输入生辰 → 八字四柱 + 紫微十二宫盘当场排出 → AI 解盘（自带 Key）。

- **排盘免费、无限制、无需任何配置**：iztro + lunar-javascript 在浏览器本地计算，零后端零上传，生辰数据不出你的设备
- **AI 解盘自带 Key（BYOK）**：支持智谱 / DeepSeek / Kimi / 通义 / 豆包 / 硅基流动 / OpenRouter / Gemini / Claude / Groq / 自定义中转，Key 只存你浏览器 localStorage，请求直接从你的浏览器发给所选厂商，本站不经手不存储
- **两种解盘模式**：总体命盘解读（八节结构）· 指定年份流年运势（逐月吉凶）

## 在线使用

**https://xiang8.github.io/ziwei-paipan/**（GitHub Pages，推 main 自动部署）

## Key 去哪拿

| 厂商 | 获取地址 | 说明 |
|---|---|---|
| 智谱 GLM | open.bigmodel.cn | 按量付费，glm-4-flash 免费 |
| DeepSeek | platform.deepseek.com | 便宜好用，推荐入门 |
| Kimi | platform.moonshot.cn | |
| 通义千问 | 阿里云百炼 | |
| 豆包 | 火山方舟控制台 | 模型填 Endpoint ID |
| 硅基流动 | cloud.siliconflow.cn | 新户有免费额度 |
| OpenRouter | openrouter.ai | 一个 Key 调全球模型 |
| Gemini | aistudio.google.com | 需能访问 Google |
| Claude | console.anthropic.com | |
| Groq | console.groq.com | 免费额度 |
| OpenAI 官方 | — | ⚠️ 禁浏览器直连，请在设置勾「自定义」填中转地址 |

## 自部署

任意静态托管（GitHub Pages / Vercel / 自己服务器）均可：

```bash
git clone 本仓库 && cd 紫微排盘解盘
npm install
npm run build:web      # 产出 web/dist/bundle.js
# 把 web/ 目录扔到任意静态托管即完成
```

推送到 main 分支会由 GitHub Actions 自动构建并发布 Pages。

## 命理引擎与致谢

- 紫微斗数：[iztro](https://github.com/SylarLong/iztro)
- 八字/农历/真太阳时：[lunar-javascript](https://github.com/6tail/lunar-javascript)

仅供传统文化研究参考，不构成任何现实决策建议。
