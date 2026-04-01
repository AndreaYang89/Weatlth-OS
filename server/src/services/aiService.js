/**
 * AI Analysis Service
 *
 * 📌 INTEGRATION POINT: 接入真实大模型时，在下方注册新 provider 并设置 .env 中的
 *    AI_PROVIDER 即可，无需修改 routes/analysis.js 等调用方代码。
 *
 * 已支持的 provider（通过 AI_PROVIDER 环境变量切换）:
 *   - 'mock'    : 基于 symbol 哈希的确定性模拟分析（默认，无需 API Key）
 *   - 'claude'  : Anthropic Claude API  [TODO - 取消注释即可启用]
 *   - 'openai'  : OpenAI GPT API        [TODO - 取消注释即可启用]
 *
 * 所有 provider 必须实现以下接口：
 *   analyzeHolding(holding)     → { technicalRating, technicalDetail, marketRating,
 *                                   marketDetail, overallRating, starRating, strategy, aiScore }
 *   analyzePortfolio(holdings)  → { healthScore, ratingDistribution, risks, summary, holdings }
 *   generateRebalanceRecommendations(portfolioAnalysis) → RecommendationArray
 */

const mockAI = require('../utils/aiAnalysis');

const PROVIDER = process.env.AI_PROVIDER || 'mock';

// ─── TODO: Claude Provider ────────────────────────────────────────────────────
// 需要安装: npm install @anthropic-ai/sdk
// 并在 .env 中设置: ANTHROPIC_API_KEY=sk-ant-...
//
// const claudeProvider = {
//   async analyzeHolding(holding) {
//     const Anthropic = require('@anthropic-ai/sdk');
//     const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
//     const prompt = `
//       分析以下持仓，给出技术面评级、市场面评级、综合评级和操作建议。
//       持仓信息:
//       - 代码: ${holding.symbol}
//       - 名称: ${holding.name}
//       - 板块: ${holding.category}
//       - 持仓成本: ${holding.avgCost}
//       - 当前价格: ${holding.currentPrice}
//       - 持仓盈亏: ${((holding.currentPrice - holding.avgCost) / holding.avgCost * 100).toFixed(2)}%
//
//       请以 JSON 格式返回，包含以下字段:
//       technicalRating (strong/good/neutral/bad/weak), technicalDetail (中文说明),
//       marketRating (hot/warm/cool/cold), marketDetail (中文说明),
//       overallRating (strong-buy/buy/neutral/reduce/sell),
//       starRating (1-5), strategy (持有/定投/加仓/减仓/止损/观望), aiScore (0-100)
//     `;
//     const message = await client.messages.create({
//       model: process.env.CLAUDE_MODEL || 'claude-opus-4-6',
//       max_tokens: 500,
//       messages: [{ role: 'user', content: prompt }]
//     });
//     return JSON.parse(message.content[0].text);
//   },
//
//   analyzePortfolio(holdings) {
//     // 可以逐个分析后汇总，或者一次性传入所有持仓让 Claude 整体分析
//     // 简单实现：先用 mock 生成结构，再用 Claude 对各持仓做分析
//     return mockAI.analyzePortfolio(holdings); // 暂用 mock 汇总逻辑
//   },
//
//   generateRebalanceRecommendations(portfolioAnalysis) {
//     return mockAI.generateRebalanceRecommendations(portfolioAnalysis);
//   }
// };

// ─── TODO: OpenAI Provider ────────────────────────────────────────────────────
// 需要安装: npm install openai
// 并在 .env 中设置: OPENAI_API_KEY=sk-...
//
// const openaiProvider = {
//   async analyzeHolding(holding) {
//     const OpenAI = require('openai');
//     const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//     // ... 构建 prompt，调用 GPT-4，解析结构化输出
//     throw new Error('OpenAI provider not yet implemented');
//   },
//   analyzePortfolio: mockAI.analyzePortfolio,
//   generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations
// };

// ─── Provider 注册表 ──────────────────────────────────────────────────────────
const providers = {
  mock: {
    analyzeHolding: mockAI.analyzeHolding,
    analyzePortfolio: mockAI.analyzePortfolio,
    generateRebalanceRecommendations: mockAI.generateRebalanceRecommendations,
  },
  // claude: claudeProvider,  // ← 取消注释并设置 AI_PROVIDER=claude
  // openai: openaiProvider,  // ← 取消注释并设置 AI_PROVIDER=openai
};

function getProvider() {
  const p = providers[PROVIDER];
  if (!p) {
    console.warn(`[AIService] 未知 provider "${PROVIDER}"，回退到 mock`);
    return providers.mock;
  }
  return p;
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────
module.exports = {
  getProviderName: () => PROVIDER,
  analyzeHolding: (holding) => getProvider().analyzeHolding(holding),
  analyzePortfolio: (holdings) => getProvider().analyzePortfolio(holdings),
  generateRebalanceRecommendations: (analysis) =>
    getProvider().generateRebalanceRecommendations(analysis),
};
