const express = require('express');
const router = express.Router();
const { Holding, Portfolio } = require('../models');
const { auth } = require('../middleware/auth');
const { analyzePortfolio, generateRebalanceRecommendations } = require('../utils/aiAnalysis');

// @route   GET /api/v1/analysis
// @desc    Get AI analysis for portfolio
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    if (holdings.length === 0) {
      return res.json({
        status: 'success',
        data: {
          analysis: {
            healthScore: 0,
            ratingDistribution: {
              'strong-buy': 0,
              'buy': 0,
              'neutral': 0,
              'reduce': 0,
              'sell': 0
            },
            risks: [],
            holdings: [],
            summary: {
              totalHoldings: 0,
              strongHoldings: 0,
              weakHoldings: 0,
              averageScore: 0
            }
          },
          message: 'No holdings to analyze. Add some holdings first.'
        }
      });
    }

    // Run AI analysis
    const analysis = analyzePortfolio(holdings);

    // Update portfolio health score
    if (portfolio) {
      portfolio.healthScore = analysis.healthScore;
      await portfolio.save();
    }

    res.json({
      status: 'success',
      data: {
        analysis: {
          healthScore: analysis.healthScore,
          ratingDistribution: analysis.ratingDistribution,
          risks: analysis.risks,
          summary: analysis.summary,
          holdings: analysis.holdings.map(h => ({
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
            aiScore: h.aiScore,
            unrealizedPnL: h.shares * (h.currentPrice - h.avgCost),
            unrealizedPnLPercent: ((h.currentPrice - h.avgCost) / h.avgCost) * 100
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/analysis/holdings/:id
// @desc    Get AI analysis for specific holding
// @access  Private
router.get('/holdings/:id', auth, async (req, res) => {
  try {
    const holding = await Holding.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!holding) {
      return res.status(404).json({
        status: 'error',
        message: 'Holding not found'
      });
    }

    // Re-run analysis
    const { analyzeHolding } = require('../utils/aiAnalysis');
    const analysis = analyzeHolding(holding);

    // Update holding with new analysis
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
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/analysis/risks
// @desc    Get risk analysis
// @access  Private
router.get('/risks', auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    const analysis = analyzePortfolio(holdings);

    // Categorize risks
    const categorizedRisks = {
      high: analysis.risks.filter(r => r.severity === 'high'),
      medium: analysis.risks.filter(r => r.severity === 'medium'),
      low: analysis.risks.filter(r => r.severity === 'low')
    };

    // Additional risk metrics
    const riskMetrics = {
      concentrationRisk: portfolio?.riskMetrics?.concentrationRisk || 'medium',
      portfolioHealth: analysis.healthScore >= 80 ? 'good' : analysis.healthScore >= 60 ? 'fair' : 'poor',
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
        totalRisks: analysis.risks.length,
        highPriorityRisks: categorizedRisks.high.length,
        recommendations: analysis.risks.map(risk => ({
          type: risk.type,
          severity: risk.severity,
          message: risk.message,
          action: risk.type === 'technical' 
            ? 'Review stop-loss settings for these holdings'
            : 'Consider diversifying into other sectors'
        }))
      }
    });
  } catch (error) {
    console.error('Get risks error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/analysis/analyze
// @desc    Run comprehensive portfolio analysis
// @access  Private
router.post('/analyze', auth, async (req, res) => {
  try {
    const { riskProfile = 'moderate' } = req.body;
    
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    if (holdings.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No holdings to analyze'
      });
    }

    // Run comprehensive analysis
    const analysis = analyzePortfolio(holdings);
    
    // Generate recommendations
    const recommendations = generateRebalanceRecommendations(analysis);

    // Calculate sector exposure
    const sectorExposure = {};
    holdings.forEach(h => {
      if (!sectorExposure[h.category]) {
        sectorExposure[h.category] = {
          value: 0,
          percentage: 0,
          holdings: 0
        };
      }
      sectorExposure[h.category].value += h.marketValue || 0;
      sectorExposure[h.category].holdings += 1;
    });

    const totalValue = Object.values(sectorExposure).reduce((sum, s) => sum + s.value, 0);
    Object.keys(sectorExposure).forEach(sector => {
      sectorExposure[sector].percentage = totalValue > 0 
        ? (sectorExposure[sector].value / totalValue) * 100 
        : 0;
    });

    // Update portfolio
    if (portfolio) {
      portfolio.healthScore = analysis.healthScore;
      await portfolio.save();
    }

    res.json({
      status: 'success',
      data: {
        analysis: {
          healthScore: analysis.healthScore,
          ratingDistribution: analysis.ratingDistribution,
          sectorExposure,
          risks: analysis.risks,
          summary: analysis.summary
        },
        recommendations,
        riskProfile,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
