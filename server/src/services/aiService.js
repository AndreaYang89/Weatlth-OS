/**
 * AI Analysis Service
 *
 * 支持的 provider（通过配置页或 AI_PROVIDER 环境变量切换，运行时动态生效）:
 *   - 'mock'     : 基于 symbol 哈希的确定性模拟分析（默认）
 *   - 'deepseek' : DeepSeek V3 / R1（兼容 OpenAI SDK）
 *   - 'kimi'     : Moonshot Kimi（兼容 OpenAI SDK）
 *   - 'mimo'     : Xiaomi MiMo（默认走 OpenRouter 的 OpenAI 兼容端点）
 *   - 'claude'   : Anthropic Claude（@anthropic-ai/sdk）
 *   - 'openai'   : OpenAI GPT-4o
 */

const mockAI = require('../utils/aiAnalysis');
const OpenAI = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');

// ─── 重试工具（处理 5xx / 429 / 网络抖动）────────────────────────────────────
async function withRetry(fn, { retries = 3, baseDelayMs = 1000, providerName = '' } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status || err.statusCode;
      // 打印完整错误结构，便于诊断
      console.error(`[AIService:${providerName}] 请求失败 attempt=${attempt}`, {
        status,
        code: err.code,
        message: err.message,
        errorBody: err.error || err.response?.data || undefined,
      });
      const isRetryable =
        (status >= 500) ||
        status === 429 ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND';
      if (!isRetryable || attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[AIService:${providerName}] ${delay}ms 后重试...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ─── Prompt 模板 ──────────────────────────────────────────────────────────────
function buildHoldingPrompt(holding) {
  const pnlPct = holding.avgCost > 0
    ? ((holding.currentPrice - holding.avgCost) / holding.avgCost * 100).toFixed(2)
    : '0.00';
  return `你是一名专业的 A 股投资分析师。请分析以下持仓并给出评级建议。

持仓信息：
- 股票代码：${holding.symbol}
- 股票名称：${holding.name}
- 所属板块：${holding.category}
- 持仓成本：${holding.avgCost} 元
- 当前价格：${holding.currentPrice} 元
- 持仓盈亏：${pnlPct}%

请严格以 JSON 格式返回，不要有任何多余文字：
{
  "technicalRating": "strong|good|neutral|bad|weak",
  "technicalDetail": "技术面简要说明（10字以内）",
  "marketRating": "hot|warm|cool|cold",
  "marketDetail": "市场热度简要说明（10字以内）",
  "overallRating": "strong-buy|buy|neutral|reduce|sell",
  "starRating": 1到5的整数,
  "strategy": "持有|定投|加仓|减仓|止损|观望",
  "aiScore": 0到100的整数
}`;
}

// ─── Enum 归一化（防止 LLM 返回不合法值导致 Mongoose ValidationError）──────────
function normalizeAnalysis(parsed) {
  const validOverall   = ['strong-buy', 'buy', 'neutral', 'reduce', 'sell'];
  const validTechnical = ['strong', 'good', 'neutral', 'bad', 'weak'];
  const validMarket    = ['hot', 'warm', 'cool', 'cold'];
  const validStrategy  = ['持有', '定投', '加仓', '减仓', '止损', '观望'];
  return {
    ...parsed,
    overallRating:   validOverall.includes(parsed.overallRating)     ? parsed.overallRating   : 'neutral',
    technicalRating: validTechnical.includes(parsed.technicalRating) ? parsed.technicalRating : 'neutral',
    marketRating:    validMarket.includes(parsed.marketRating)       ? parsed.marketRating    : 'warm',
    strategy:        validStrategy.includes(parsed.strategy)         ? parsed.strategy        : '持有',
    starRating:      Math.min(5, Math.max(1, Math.round(Number(parsed.starRating) || 3))),
    aiScore:         Math.min(100, Math.max(0, Math.round(Number(parsed.aiScore)  || 50))),
  };
}

// ─── JSON 解析（带降级）───────────────────────────────────────────────────────
function safeParseJSON(text, holding, providerName) {
  try {
    // 清理 markdown 代码块包裹
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    // 提取第一个完整 JSON 对象（防止模型在 JSON 前后附加说明文字）
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
    const parsed = JSON.parse(cleaned);
    // 校验必要字段
    const required = ['technicalRating', 'marketRating', 'overallRating', 'starRating', 'strategy', 'aiScore'];
    const missing = required.filter(k => parsed[k] === undefined);
    if (missing.length > 0) throw new Error(`缺少字段: ${missing.join(', ')}`);
    const normalized = normalizeAnalysis(parsed);
    console.log(`[AIService:${providerName}] ${holding.symbol} 分析完成 → ${normalized.overallRating} (${normalized.aiScore}分)`);
    return normalized;
  } catch (err) {
    console.error(`[AIService:${providerName}] JSON解析失败，降级为mock。错误: ${err.message}`);
    console.error(`[AIService:${providerName}] 原始响应: ${String(text).slice(0, 300)}`);
    return mockAI.analyzeHolding(holding);
  }
}

function extractMessageText(response) {
  const choice = response?.choices?.[0];
  const message = choice?.message;
  if (!message) return '';

  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function buildOpenAICompatibleProvider({
  providerName,
  apiKeyEnv,
  baseURL,
  modelEnv,
  defaultModel,
  timeout = 30000,
  defaultHeaders,
  extraBody,
}) {
  return {
    async analyzeHolding(holding) {
      const key = process.env[apiKeyEnv];
      if (!key) throw new Error(`${apiKeyEnv} 未配置`);

      const client = new OpenAI({
        apiKey: key,
        baseURL,
        timeout,
        maxRetries: 0,
        defaultHeaders,
      });

      const model = process.env[modelEnv] || defaultModel;
      console.log(`[AIService:${providerName}] 调用 ${model} 分析 ${holding.symbol}...`);

      const baseRequest = {
        model,
        messages: [
          { role: 'system', content: '你是专业的股票投资分析师。只输出合法的 JSON 对象，不要任何解释、markdown 或额外文字。' },
          { role: 'user', content: buildHoldingPrompt(holding) },
        ],
        max_tokens: 512,
        response_format: { type: 'json_object' },
        ...(extraBody ? { extra_body: extraBody } : {}),
      };

      const response = await withRetry(
        async () => {
          try {
            return await client.chat.completions.create(baseRequest);
          } catch (err) {
            const status = err.status || err.statusCode;
            const bodyText = JSON.stringify(err.error || err.response?.data || '');
            const maybeFormatIssue =
              status === 400 &&
              /response_format|json_object|unsupported|invalid/i.test(bodyText + err.message);

            if (!maybeFormatIssue) throw err;

            console.warn(`[AIService:${providerName}] JSON 输出参数不兼容，回退纯文本 JSON 模式`);
            const { response_format, ...fallbackRequest } = baseRequest;
            return client.chat.completions.create(fallbackRequest);
          }
        },
        { retries: 2, baseDelayMs: 800, providerName }
      );

      const content = extractMessageText(response);
      if (!content) throw new Error(`${providerName} 返回空内容`);
      return safeParseJSON(content, holding, providerName);
    },
    analyzePortfolio: mockAI.analyzePortfolio,
    generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
  };
}

// ─── DeepSeek Provider ────────────────────────────────────────────────────────
const deepseekProvider = buildOpenAICompatibleProvider({
  providerName: 'deepseek',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  modelEnv: 'DEEPSEEK_MODEL',
  defaultModel: 'deepseek-chat',
  timeout: 20000,
});

// ─── Kimi (Moonshot) Provider ─────────────────────────────────────────────────
const kimiProvider = buildOpenAICompatibleProvider({
  providerName: 'kimi',
  apiKeyEnv: 'KIMI_API_KEY',
  baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
  modelEnv: 'KIMI_MODEL',
  defaultModel: 'moonshot-v1-8k',
});

// ─── Xiaomi MiMo Provider ─────────────────────────────────────────────────────
const mimoProvider = buildOpenAICompatibleProvider({
  providerName: 'mimo',
  apiKeyEnv: 'MIMO_API_KEY',
  baseURL: process.env.MIMO_BASE_URL || 'https://openrouter.ai/api/v1',
  modelEnv: 'MIMO_MODEL',
  defaultModel: 'xiaomi/mimo-v2-flash',
  defaultHeaders: {
    'HTTP-Referer': process.env.MIMO_HTTP_REFERER || 'https://wealthos.local',
    'X-Title': process.env.MIMO_APP_NAME || 'WealthOS',
  },
});

// ─── Claude Provider ──────────────────────────────────────────────────────────
const claudeProvider = {
  async analyzeHolding(holding) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY 未配置');
    const client = new Anthropic({ apiKey: key });
    const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
    console.log(`[AIService:claude] 调用 ${model} 分析 ${holding.symbol}...`);
    const message = await withRetry(
      () => client.messages.create({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
      }),
      { retries: 3, baseDelayMs: 1000, providerName: 'claude' }
    );
    return safeParseJSON(message.content[0].text, holding, 'claude');
  },
  analyzePortfolio: mockAI.analyzePortfolio,
  generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
};

// ─── OpenAI Provider ──────────────────────────────────────────────────────────
const openaiProvider = {
  async analyzeHolding(holding) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY 未配置');
    const client = new OpenAI({ apiKey: key, timeout: 30000, maxRetries: 0 });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    console.log(`[AIService:openai] 调用 ${model} 分析 ${holding.symbol}...`);
    const response = await withRetry(
      () => client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
        response_format: { type: 'json_object' },
        max_tokens: 512,
      }),
      { retries: 3, baseDelayMs: 1000, providerName: 'openai' }
    );
    return safeParseJSON(response.choices[0].message.content, holding, 'openai');
  },
  analyzePortfolio: mockAI.analyzePortfolio,
  generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
};

// ─── Provider 注册表 ──────────────────────────────────────────────────────────
const providers = {
  mock:     { analyzeHolding: mockAI.analyzeHolding, analyzePortfolio: mockAI.analyzePortfolio, generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations },
  deepseek: deepseekProvider,
  kimi:     kimiProvider,
  mimo:     mimoProvider,
  claude:   claudeProvider,
  openai:   openaiProvider,
};

function getProviderName() {
  return process.env.AI_PROVIDER || 'mock';
}

function getProvider() {
  const name = getProviderName();
  return providers[name] || (console.warn(`[AIService] 未知 provider "${name}"，回退到 mock`) || providers.mock);
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────
module.exports = {
  getProviderName,

  async analyzeHolding(holding) {
    const name = getProviderName();
    try {
      return await getProvider().analyzeHolding(holding);
    } catch (err) {
      console.error(`[AIService:${name}] analyzeHolding 最终失败，降级为 mock:`, {
        message: err.message,
        status: err.status || err.statusCode,
        code: err.code,
        errorBody: err.error || undefined,
      });
      return mockAI.analyzeHolding(holding);
    }
  },

  analyzePortfolio(holdings) {
    return getProvider().analyzePortfolio(holdings);
  },

  generateRebalanceRecommendations(analysis) {
    return getProvider().generateRebalanceRecommendations(analysis);
  },
};
