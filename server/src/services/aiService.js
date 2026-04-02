/**
 * AI Analysis Service
 *
 * 支持的 provider（通过 AI_PROVIDER 环境变量或配置页切换，运行时生效）:
 *   - 'mock'     : 基于 symbol 哈希的确定性模拟分析（默认）
 *   - 'deepseek' : DeepSeek V3 / R1（兼容 OpenAI SDK）
 *   - 'claude'   : Anthropic Claude
 *   - 'openai'   : OpenAI GPT-4
 *
 * ⚠️  PROVIDER 和 API Key 在每次调用时从 process.env 动态读取，
 *     配置页保存后无需重启即可生效。
 */

const mockAI = require('../utils/aiAnalysis');

// ─── Prompt 模板（各 provider 共用）────────────────────────────────────────────
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

请严格以 JSON 格式返回，包含以下字段（不要有任何额外文字）：
{
  "technicalRating": "strong|good|neutral|bad|weak",
  "technicalDetail": "技术面简要说明（10字以内）",
  "marketRating": "hot|warm|cool|cold",
  "marketDetail": "市场热度简要说明（10字以内）",
  "overallRating": "strong-buy|buy|neutral|reduce|sell",
  "starRating": 1~5的整数,
  "strategy": "持有|定投|加仓|减仓|止损|观望",
  "aiScore": 0~100的整数
}`;
}

// ─── JSON 解析工具（带降级）──────────────────────────────────────────────────────
function safeParseJSON(text, holding) {
  try {
    // 有些模型会在 JSON 前后加 markdown 代码块
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.warn(`[AIService] JSON 解析失败，降级为 mock。原始内容: ${text?.slice(0, 100)}`);
    return mockAI.analyzeHolding(holding);
  }
}

// ─── DeepSeek Provider ────────────────────────────────────────────────────────
const deepseekProvider = {
  async analyzeHolding(holding) {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });
    return safeParseJSON(response.choices[0].message.content, holding);
  },
  analyzePortfolio: mockAI.analyzePortfolio,
  generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
};

// ─── Claude Provider ──────────────────────────────────────────────────────────
const claudeProvider = {
  async analyzeHolding(holding) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
    const message = await client.messages.create({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
    });
    return safeParseJSON(message.content[0].text, holding);
  },
  analyzePortfolio: mockAI.analyzePortfolio,
  generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
};

// ─── OpenAI Provider ──────────────────────────────────────────────────────────
const openaiProvider = {
  async analyzeHolding(holding) {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: buildHoldingPrompt(holding) }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });
    return safeParseJSON(response.choices[0].message.content, holding);
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

function getProvider() {
  // 每次调用时动态读取，配置页切换后无需重启
  const name = process.env.AI_PROVIDER || 'mock';
  const p = providers[name];
  if (!p) {
    console.warn(`[AIService] 未知 provider "${name}"，回退到 mock`);
    return providers.mock;
  }
  return p;
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────
module.exports = {
  getProviderName: () => process.env.AI_PROVIDER || 'mock',

  async analyzeHolding(holding) {
    try {
      return await getProvider().analyzeHolding(holding);
    } catch (err) {
      console.error(`[AIService] analyzeHolding 失败 (${process.env.AI_PROVIDER})，降级为 mock:`, err.message);
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
