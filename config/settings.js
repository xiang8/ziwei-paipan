import 'dotenv/config';

export const settings = {
  zhipuApiKey: process.env.ZHIPU_API_KEY || '',
  zhipuModel: process.env.ZHIPU_MODEL || 'glm-5.2',
  zhipuBaseUrl: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/anthropic',
};
