/**
 * AI Analysis Utilities
 * 
 * ⚠️ IMPORTANT DISCLAIMER:
 * This module provides SIMULATED analysis for demonstration purposes only.
 * It is NOT real AI analysis and should NOT be used for actual investment decisions.
 * 
 * How it works:
 * - Technical ratings are generated based on a deterministic hash of the stock symbol
 * - Market ratings are based on the symbol hash combined with category
 * - The same stock symbol will ALWAYS produce the same rating (deterministic)
 * - Results do NOT reflect actual market conditions or technical indicators
 * 
 * For production use, replace this with:
 * - Real-time market data APIs (e.g., Yahoo Finance, Alpha Vantage)
 * - Actual technical analysis libraries (e.g., TA-Lib)
 * - Machine learning models trained on market data
 * - Professional financial data providers (e.g., Bloomberg, Refinitiv)
 */

// Technical Analysis - SIMULATED (deterministic based on symbol hash)
const analyzeTechnical = (holding) => {
  const { avgCost, currentPrice, symbol } = holding;
  
  if (!currentPrice || !avgCost) {
    return {
      rating: 'neutral',
      detail: '数据不足',
      score: 50
    };
  }

  const priceChange = ((currentPrice - avgCost) / avgCost) * 100;
  
  // Simulate technical indicators based on symbol hash
  const symbolHash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const trendScore = (symbolHash % 100);
  
  let rating, detail;
  
  if (trendScore > 80 && priceChange > 5) {
    rating = 'strong';
    detail = '多头排列';
  } else if (trendScore > 60 && priceChange > 0) {
    rating = 'good';
    detail = '上升通道';
  } else if (trendScore > 40) {
    rating = 'neutral';
    detail = '箱体震荡';
  } else if (trendScore > 20) {
    rating = 'bad';
    detail = '均线空头';
  } else {
    rating = 'weak';
    detail = '破位下跌';
  }

  return { rating, detail, score: trendScore };
};

// Market Analysis - Simulated based on sector and market conditions
const analyzeMarket = (holding) => {
  const { category, symbol } = holding;
  
  // Simulate market sentiment based on category and symbol
  const symbolHash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const marketScore = (symbolHash * category.length) % 100;
  
  let rating, detail;
  
  const marketConditions = {
    '消费': { hot: '板块强势', warm: '稳健增长', cool: '需求疲软', cold: '消费低迷' },
    '新能源': { hot: '政策利好', warm: '景气上行', cool: '产能过剩', cold: '资金流出' },
    '海外': { hot: '科技牛市', warm: '美元走强', cool: '加息预期', cold: '地缘风险' },
    '互联网': { hot: 'AI驱动', warm: '业绩改善', cool: '监管压力', cold: '增长放缓' },
    '科技': { hot: '创新周期', warm: '估值修复', cool: '周期下行', cold: '裁员潮' },
    '金融': { hot: '利率上行', warm: '业绩稳定', cool: '坏账担忧', cold: '系统性风险' },
    '医药': { hot: '创新药爆发', warm: '集采缓和', cool: '研发失败', cold: '监管收紧' },
    '其他': { hot: '概念炒作', warm: '市场关注', cool: '流动性差', cold: '无人问津' }
  };
  
  const conditions = marketConditions[category] || marketConditions['其他'];
  
  if (marketScore > 75) {
    rating = 'hot';
    detail = conditions.hot;
  } else if (marketScore > 50) {
    rating = 'warm';
    detail = conditions.warm;
  } else if (marketScore > 25) {
    rating = 'cool';
    detail = conditions.cool;
  } else {
    rating = 'cold';
    detail = conditions.cold;
  }

  return { rating, detail, score: marketScore };
};

// Calculate overall rating based on technical and market analysis
const calculateOverallRating = (technical, market) => {
  const score = (technical.score + market.score) / 2;
  
  let rating, starRating, strategy;
  
  if (score >= 80) {
    rating = 'strong-buy';
    starRating = 5;
    strategy = '持有';
  } else if (score >= 65) {
    rating = 'buy';
    starRating = 4;
    strategy = '持有';
  } else if (score >= 45) {
    rating = 'neutral';
    starRating = 3;
    strategy = '观望';
  } else if (score >= 25) {
    rating = 'reduce';
    starRating = 2;
    strategy = '减仓';
  } else {
    rating = 'sell';
    starRating = 1;
    strategy = '止损';
  }

  return { rating, starRating, strategy, score };
};

// Analyze a single holding
const analyzeHolding = (holding) => {
  const technical = analyzeTechnical(holding);
  const market = analyzeMarket(holding);
  const overall = calculateOverallRating(technical, market);

  return {
    technicalRating: technical.rating,
    technicalDetail: technical.detail,
    marketRating: market.rating,
    marketDetail: market.detail,
    overallRating: overall.rating,
    starRating: overall.starRating,
    strategy: overall.strategy,
    aiScore: overall.score
  };
};

// Analyze entire portfolio
const analyzePortfolio = (holdings) => {
  const analyzedHoldings = holdings.map(holding => {
    const analysis = analyzeHolding(holding);
    return {
      ...holding.toObject(),
      ...analysis
    };
  });

  // Calculate portfolio health score
  const totalScore = analyzedHoldings.reduce((sum, h) => sum + (h.aiScore || 50), 0);
  const healthScore = Math.round(totalScore / (analyzedHoldings.length || 1));

  // Count ratings distribution
  const ratingDistribution = {
    'strong-buy': 0,
    'buy': 0,
    'neutral': 0,
    'reduce': 0,
    'sell': 0
  };

  analyzedHoldings.forEach(h => {
    if (ratingDistribution[h.overallRating] !== undefined) {
      ratingDistribution[h.overallRating]++;
    }
  });

  // Identify risks
  const risks = [];
  
  // Check for technical deterioration
  const deteriorating = analyzedHoldings.filter(h => 
    h.technicalRating === 'weak' || h.technicalRating === 'bad'
  );
  
  if (deteriorating.length > 0) {
    risks.push({
      type: 'technical',
      severity: deteriorating.length > 2 ? 'high' : 'medium',
      message: `技术面恶化持仓`,
      count: deteriorating.length,
      holdings: deteriorating.map(h => h.name)
    });
  }

  // Check for market concentration
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

  return {
    healthScore,
    ratingDistribution,
    risks,
    holdings: analyzedHoldings,
    summary: {
      totalHoldings: analyzedHoldings.length,
      strongHoldings: ratingDistribution['strong-buy'] + ratingDistribution['buy'],
      weakHoldings: ratingDistribution['reduce'] + ratingDistribution['sell'],
      averageScore: Math.round(healthScore)
    }
  };
};

// Generate rebalance recommendations
const generateRebalanceRecommendations = (portfolioAnalysis) => {
  const recommendations = [];
  const { holdings } = portfolioAnalysis;

  holdings.forEach(holding => {
    if (holding.overallRating === 'sell') {
      recommendations.push({
        symbol: holding.symbol,
        name: holding.name,
        action: 'sell',
        reason: holding.technicalDetail,
        marketReason: holding.marketDetail,
        suggestedAmount: holding.marketValue,
        priority: 'high'
      });
    } else if (holding.overallRating === 'reduce') {
      recommendations.push({
        symbol: holding.symbol,
        name: holding.name,
        action: 'reduce',
        reason: holding.technicalDetail,
        marketReason: holding.marketDetail,
        suggestedAmount: holding.marketValue * 0.5,
        priority: 'medium'
      });
    }
  });

  // Suggest defensive positions if portfolio is risky
  if (portfolioAnalysis.healthScore < 60) {
    recommendations.push({
      symbol: '红利低波ETF',
      name: '红利低波ETF',
      action: 'buy',
      reason: '防御性强',
      marketReason: '避险需求',
      suggestedAmount: portfolioAnalysis.holdings.reduce((sum, h) => sum + h.marketValue, 0) * 0.1,
      priority: 'high',
      isNew: true
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
};

module.exports = {
  analyzeHolding,
  analyzePortfolio,
  generateRebalanceRecommendations,
  analyzeTechnical,
  analyzeMarket
};
