/**
 * AI Analysis Service
 *
 * 支持的 provider（通过配置页或 AI_PROVIDER 环境变量切换，运行时动态生效）:
 *   - 'mock'     : 基于 symbol 哈希的确定性模拟分析（默认）
 *   - 'deepseek' : DeepSeek V3 / R1（兼容 OpenAI SDK，npm install openai）
 *   - 'claude'   : Anthropic Claude（npm install @anthropic-ai/sdk）
 *   - 'openai'   : OpenAI GPT-4o（npm install openai）
 */

const mockAI = require('../utils/aiAnalysis');
const OpenAI = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');

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
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
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
    console.error(`[AIService:${providerName}] 原始响应: ${String(text).slice(0, 200)}`);
    return mockAI.analyzeHolding(holding);
  }
}

// ─── DeepSeek Provider ────────────────────────────────────────────────────────
const deepseekProvider = {
  async analyzeHolding(holding) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error('DEEPSEEK_API_KEY 未配置');
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    console.log(`[AIService:deepseek] 调用 ${model} 分析 ${holding.symbol}...`);
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });
    return safeParseJSON(response.choices[0].message.content, holding, 'deepseek');
  },
  analyzePortfolio: mockAI.analyzePortfolio,
  generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
};

// ─── Claude Provider ──────────────────────────────────────────────────────────
const claudeProvider = {
  async analyzeHolding(holding) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY 未配置');
    const client = new Anthropic({ apiKey: key });
    const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
    console.log(`[AIService:claude] 调用 ${model} 分析 ${holding.symbol}...`);
    const message = await client.messages.create({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
    });
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
    const client = new OpenAI({ apiKey: key });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    console.log(`[AIService:openai] 调用 ${model} 分析 ${holding.symbol}...`);
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });
    return safeParseJSON(response.choices[0].message.content, holding, 'openai');
  },
  analyzePortfolio: mockAI.analyzePortfolio,
  generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
};

// ─── Provider 注册表 ──────────────────────────────────────────────────────────
const providers = {
  mock:     { analyzeHolding: mockAI.analyzeHolding, analyzePortfolio: mockAI.analyzePortfolio, generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations },
  deepseek: deepseekProvider,
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
      console.error(`[AIService:${name}] analyzeHolding 失败，降级为 mock: ${err.message}`);
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
