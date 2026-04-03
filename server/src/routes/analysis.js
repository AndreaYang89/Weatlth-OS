const express = require('express');
const router = express.Router();
const { Holding, Portfolio } = require('../models');
const { auth } = require('../middleware/auth');
const aiService = require('../services/aiService');
const mockAI = require('../utils/aiAnalysis');

/**
 * 从已有分析字段的 holding 数组计算组合统计
 * （不重新调用 analyzeHolding，避免覆盖 LLM 结果）
 */
function computePortfolioStats(analyzedHoldings) {
  const totalScore = analyzedHoldings.reduce((sum, h) => sum + (h.aiScore || 50), 0);
  const healthScore = Math.round(totalScore / (analyzedHoldings.length || 1));

  const ratingDistribution = { 'strong-buy': 0, 'buy': 0, 'neutral': 0, 'reduce': 0, 'sell': 0 };
  analyzedHoldings.forEach(h => {
    if (ratingDistribution[h.overallRating] !== undefined) ratingDistribution[h.overallRating]++;
  });

  const risks = [];
  const deteriorating = analyzedHoldings.filter(h =>
    h.technicalRating === 'weak' || h.technicalRating === 'bad'
  );
  if (deteriorating.length > 0) {
    risks.push({
      type: 'technical',
      severity: deteriorating.length > 2 ? 'high' : 'medium',
      message: '技术面恶化持仓',
      count: deteriorating.length,
      holdings: deteriorating.map(h => h.name)
    });
  }

  const categoryCount = {};
  analyzedHoldings.forEach(h => {
    categoryCount[h.category] = (categoryCount[h.category] || 0) + 1;
  });
  const maxCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
  if (maxCategory && maxCategory[1] / analyzedHoldings.length > 0.4) {
    risks.push({
      type: 'concentration',
      severity: maxCategory[1] / analyzedHoldings.length > 0.6 ? 'high' : 'medium',
      message: `${maxCategory[0]}板块过度集中`,
      percentage: Math.round((maxCategory[1] / analyzedHoldings.length) * 100)
    });
  }

  const coldHoldings = analyzedHoldings.filter(h =>
    h.marketRating === 'cold' || h.marketRating === 'cool'
  );
  if (coldHoldings.length > analyzedHoldings.length * 0.5) {
    risks.push({
      type: 'market',
      severity: 'medium',
      message: '多数持仓市场热度偏低',
      count: coldHoldings.length,
      holdings: coldHoldings.map(h => h.name)
    });
  }

  const summary = {
    totalHoldings: analyzedHoldings.length,
    strongHoldings: analyzedHoldings.filter(h =>
      h.overallRating === 'strong-buy' || h.overallRating === 'buy'
    ).length,
    weakHoldings: analyzedHoldings.filter(h =>
      h.overallRating === 'reduce' || h.overallRating === 'sell'
    ).length,
    averageScore: Math.round(totalScore / (analyzedHoldings.length || 1))
  };

  return { healthScore, ratingDistribution, risks, summary };
}

// @route   GET /api/v1/analysis
// @desc    Get stored AI analysis for portfolio (reads DB, no LLM call)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ user: req.user._id, isActive: true });

    if (holdings.length === 0) {
      return res.json({
        status: 'success',
        data: {
          analysis: {
            healthScore: 0,
            ratingDistribution: { 'strong-buy': 0, 'buy': 0, 'neutral': 0, 'reduce': 0, 'sell': 0 },
            risks: [],
            holdings: [],
            summary: { totalHoldings: 0, strongHoldings: 0, weakHoldings: 0, averageScore: 0 }
          }
        }
      });
    }

    // Use stored analysis fields (may be from LLM or mock depending on last /analyze run)
    const analyzedHoldings = holdings.map(h => ({ ...h.toObject(), aiScore: h.aiScore || 50 }));
    const stats = computePortfolioStats(analyzedHoldings);

    res.json({
      status: 'success',
      data: {
        analysis: {
          ...stats,
          holdings: analyzedHoldings.map(h => ({
            id: h._id,
            symbol: h.symbol,
            name: h.name,
            category: h.category,
            marketValue: h.marketValue,
            technicalRating: h.technicalRating,
            technicalDetail: h.technicalDetail,
            marketRating: h.marketRating,
            marketDetail: h.marketDetail,
            overallRating: h.overallRating,
            starRating: h.starRating,
            strategy: h.strategy,
            aiScore: h.aiScore || 50,
            unrealizedPnL: h.shares * (h.currentPrice - h.avgCost),
            unrealizedPnLPercent: h.avgCost > 0
              ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/v1/analysis/holdings/:id
// @desc    Re-analyze a single holding with current AI provider
// @access  Private
router.get('/holdings/:id', auth, async (req, res) => {
  try {
    const holding = await Holding.findOne({ _id: req.params.id, user: req.user._id });
    if (!holding) {
      return res.status(404).json({ status: 'error', message: 'Holding not found' });
    }

    const analysis = await aiService.analyzeHolding(holding);
    Object.assign(holding, analysis);
    await holding.save();

    res.json({
      status: 'success',
      data: {
        holding: {
          id: holding._id,
          symbol: holding.symbol,
          name: holding.name,
          ...analysis,
          unrealizedPnL: holding.getUnrealizedPnL(),
          unrealizedPnLPercent: holding.getPnLPercentage()
        }
      }
    });
  } catch (error) {
    console.error('Get holding analysis error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/v1/analysis/risks
// @desc    Get risk analysis from stored data
// @access  Private
router.get('/risks', auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    const analyzedHoldings = holdings.map(h => ({ ...h.toObject(), aiScore: h.aiScore || 50 }));
    const stats = computePortfolioStats(analyzedHoldings);

    const categorizedRisks = {
      high:   stats.risks.filter(r => r.severity === 'high'),
      medium: stats.risks.filter(r => r.severity === 'medium'),
      low:    stats.risks.filter(r => r.severity === 'low')
    };

    const riskMetrics = {
      concentrationRisk: portfolio?.riskMetrics?.concentrationRisk || 'medium',
      portfolioHealth: stats.healthScore >= 80 ? 'good' : stats.healthScore >= 60 ? 'fair' : 'poor',
      deterioratingHoldings: holdings.filter(h =>
        h.technicalRating === 'weak' || h.technicalRating === 'bad'
      ).length,
      weakMarketHoldings: holdings.filter(h =>
        h.marketRating === 'cold' || h.marketRating === 'cool'
      ).length
    };

    res.json({
      status: 'success',
      data: {
        risks: categorizedRisks,
        riskMetrics,
        totalRisks: stats.risks.length,
        highPriorityRisks: categorizedRisks.high.length,
        recommendations: stats.risks.map(risk => ({
          type: risk.type,
          severity: risk.severity,
          message: risk.message,
          action: risk.type === 'technical'
            ? '检视这些持仓的止损设置'
            : '考虑分散投资到其他板块'
        }))
      }
    });
  } catch (error) {
    console.error('Get risks error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   POST /api/v1/analysis/analyze
// @desc    Run full portfolio analysis using configured AI provider (LLM or mock)
// @access  Private
router.post('/analyze', auth, async (req, res) => {
  try {
    const { riskProfile = 'moderate' } = req.body;
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    if (holdings.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No holdings to analyze' });
    }

    const providerName = aiService.getProviderName();
    console.log(`[Analysis] 使用 provider: ${providerName}，分析 ${holdings.length} 个持仓`);

    // 逐个调用 AI（mock 或真实 LLM），并保存分析结果到数据库
    const analyzedHoldings = [];
    for (const holding of holdings) {
      const analysis = await aiService.analyzeHolding(holding);
      Object.assign(holding, analysis);
      try {
        await holding.save();
      } catch (saveErr) {
        console.error(`[Analysis] ${holding.symbol} 保存失败: ${saveErr.message}`);
      }
      analyzedHoldings.push({ ...holding.toObject(), ...analysis });
    }

    // 基于 LLM 结果计算组合统计（不再重复调用 analyzeHolding）
    const stats = computePortfolioStats(analyzedHoldings);
    const recommendations = aiService.generateRebalanceRecommendations({
      holdings: analyzedHoldings,
      ...stats
    });

    // 计算板块暴露
    const sectorExposure = {};
    analyzedHoldings.forEach(h => {
      if (!sectorExposure[h.category]) {
        sectorExposure[h.category] = { value: 0, percentage: 0, holdings: 0 };
      }
      sectorExposure[h.category].value += h.marketValue || 0;
      sectorExposure[h.category].holdings += 1;
    });
    const totalValue = Object.values(sectorExposure).reduce((s, x) => s + x.value, 0);
    Object.keys(sectorExposure).forEach(sector => {
      sectorExposure[sector].percentage = totalValue > 0
        ? (sectorExposure[sector].value / totalValue) * 100 : 0;
    });

    if (portfolio) {
      portfolio.healthScore = stats.healthScore;
      try {
        await portfolio.save();
      } catch (saveErr) {
        console.error('[Analysis] portfolio 保存失败:', saveErr.message);
      }
    }

    res.json({
      status: 'success',
      data: {
        analysis: {
          healthScore: stats.healthScore,
          ratingDistribution: stats.ratingDistribution,
          sectorExposure,
          risks: stats.risks,
          summary: stats.summary,
          provider: providerName
        },
        recommendations,
        riskProfile,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Analysis] analyze route error:', error.message, error.stack);
    res.status(500).json({ status: 'error', message: error.message || 'Server error' });
  }
});

module.exports = router;
