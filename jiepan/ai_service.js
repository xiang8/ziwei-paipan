import axios from 'axios';
import { settings } from '../config/settings.js';

/**
 * 调用智谱 GLM-5.2（走 Anthropic 兼容接口，coding plan 套餐）
 * 参考 healthy 项目 ai.js 的避雷写法：不能用 paas/v4，必须用 api/anthropic/v1/messages
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{temperature?:number, maxTokens?:number}} opts
 * @returns {Promise<string>} 模型回复文本
 */
export async function chatGLM(systemPrompt, userPrompt, opts = {}) {
  const { temperature = 0.7, maxTokens = 8192 } = opts;
  if (!settings.zhipuApiKey) throw new Error('未配置 ZHIPU_API_KEY，请在 .env 中设置');

  const resp = await axios.post(
    `${settings.zhipuBaseUrl}/v1/messages`,
    {
      model: settings.zhipuModel,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature,
      max_tokens: maxTokens,
    },
    {
      headers: {
        'x-api-key': settings.zhipuApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 180000,
    }
  );
  // GLM 思考模型长 prompt 触发思考块：content[0] 可能是 thinking，text 在后面的块
  const textBlock = resp.data.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}
