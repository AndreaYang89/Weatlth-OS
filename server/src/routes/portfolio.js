const express = require('express');
const router = express.Router();
const { Portfolio, Holding } = require('../models');
const { auth } = require('../middleware/auth');

// @route   GET /api/v1/portfolio
// @desc    Get user's portfolio overview
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user._id });
    const holdings = await Holding.find({ user: req.user._id, isActive: true });

    // Create portfolio if doesn't exist
    if (!portfolio) {
      portfolio = new Portfolio({ user: req.user._id });
    }

    // Calculate portfolio metrics
    portfolio.calculateMetrics(holdings);
    await portfolio.save();

    // Get top holdings
    const topHoldings = holdings
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 5)
      .map(h => ({
        symbol: h.symbol,
        name: h.name,
        marketValue: h.marketValue,
        percentage: portfolio.totalAssets > 0 ? (h.marketValue / portfolio.totalAssets) * 100 : 0,
        pnl: h.getUnrealizedPnL(),
        pnlPercent: h.getPnLPercentage()
      }));

    res.json({
      status: 'success',
      data: {
        portfolio: {
          totalAssets: portfolio.totalAssets,
          totalCost: portfolio.totalCost,
          unrealizedPnL: portfolio.unrealizedPnL,
          unrealizedPnLPercent: portfolio.unrealizedPnLPercent,
          allocation: portfolio.allocation,
          riskMetrics: portfolio.riskMetrics,
          healthScore: portfolio.healthScore,
          lastUpdated: portfolio.lastUpdated
        },
        topHoldings,
        holdingCount: holdings.length
      }
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/portfolio/allocation
// @desc    Get portfolio allocation details
// @access  Private
router.get('/allocation', auth, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    const holdings = await Holding.find({ user: req.user._id, isActive: true });

    // Group by category with details
    const categoryDetails = {};
    
    holdings.forEach(holding => {
      if (!categoryDetails[holding.category]) {
        categoryDetails[holding.category] = {
          holdings: [],
          totalValue: 0,
          totalCost: 0
        };
      }
      
      const value = holding.marketValue || 0;
      const cost = holding.avgCost * holding.shares;
      
      categoryDetails[holding.category].holdings.push({
        symbol: holding.symbol,
        name: holding.name,
        shares: holding.shares,
        avgCost: holding.avgCost,
        currentPrice: holding.currentPrice,
        marketValue: value,
        pnl: holding.getUnrealizedPnL(),
        pnlPercent: holding.getPnLPercentage()
      });
      
      categoryDetails[holding.category].totalValue += value;
      categoryDetails[holding.category].totalCost += cost;
    });

    // Calculate category P&L
    Object.keys(categoryDetails).forEach(category => {
      const cat = categoryDetails[category];
      cat.totalPnL = cat.totalValue - cat.totalCost;
      cat.totalPnLPercent = cat.totalCost > 0 ? (cat.totalPnL / cat.totalCost) * 100 : 0;
    });

    const totalAssets = portfolio?.totalAssets || 
      Object.values(categoryDetails).reduce((sum, cat) => sum + cat.totalValue, 0);

    res.json({
      status: 'success',
      data: {
        totalAssets,
        categoryAllocation: categoryDetails,
        allocationChart: Object.entries(categoryDetails).map(([category, data]) => ({
          category,
          amount: data.totalValue,
          percentage: totalAssets > 0 ? (data.totalValue / totalAssets) * 100 : 0
        }))
      }
    });
  } catch (error) {
    console.error('Get allocation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/portfolio/performance
// @desc    Get portfolio performance metrics
// @access  Private
router.get('/performance', auth, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    const holdings = await Holding.find({ user: req.user._id, isActive: true });

    // Calculate win rate
    const winningHoldings = holdings.filter(h => h.getUnrealizedPnL() > 0);
    const winRate = holdings.length > 0 ? (winningHoldings.length / holdings.length) * 100 : 0;

    // Calculate risk metrics (simulated)
    const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.avgCost * h.shares), 0);
    
    // Simulate metrics based on portfolio composition
    const beta = holdings.length > 0 ? 0.8 + (Math.random() * 0.4) : 1.0;
    const sharpeRatio = totalCost > 0 && (totalValue - totalCost) / totalCost > 0 
      ? 1.0 + Math.random() 
      : 0.5 + Math.random() * 0.5;
    const maxDrawdown = -(5 + Math.random() * 20);

    res.json({
      status: 'success',
      data: {
        performance: {
          totalReturn: portfolio?.unrealizedPnL || 0,
          totalReturnPercent: portfolio?.unrealizedPnLPercent || 0,
          winRate: Math.round(winRate),
          winCount: winningHoldings.length,
          totalTrades: holdings.length
        },
        riskMetrics: {
          beta: parseFloat(beta.toFixed(2)),
          sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
          maxDrawdown: parseFloat(maxDrawdown.toFixed(1)),
          concentrationRisk: portfolio?.riskMetrics?.concentrationRisk || 'medium'
        }
      }
    });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/portfolio/refresh
// @desc    Refresh portfolio data — stub until real market API is connected.
//          Guarded: only callable once every 60 seconds per user.
// @access  Private
const refreshCooldown = new Map(); // userId -> last refresh timestamp

router.post('/refresh', auth, async (req, res) => {
  const userId = req.user._id.toString();
  const now = Date.now();
  const cooldownMs = 60 * 1000;
  const lastRefresh = refreshCooldown.get(userId) || 0;

  if (now - lastRefresh < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - lastRefresh)) / 1000);
    return res.status(429).json({
      status: 'error',
      message: `Please wait ${remaining}s before refreshing again`
    });
  }
  refreshCooldown.set(userId, now);

  try {
    let portfolio = await Portfolio.findOne({ user: req.user._id });
    const holdings = await Holding.find({ user: req.user._id, isActive: true });

    if (!portfolio) {
      portfolio = new Portfolio({ user: req.user._id });
    }

    // Recalculate all metrics
    portfolio.calculateMetrics(holdings);
    
    // Simulate updating prices (in real app, this would fetch from market data API)
    for (const holding of holdings) {
      // Simulate small price movement
      const change = (Math.random() - 0.5) * 0.02; // ±1%
      holding.currentPrice = holding.currentPrice * (1 + change);
      holding.marketValue = holding.currentPrice * holding.shares;
      await holding.save();
    }

    // Recalculate after price updates
    portfolio.calculateMetrics(holdings);
    await portfolio.save();

    res.json({
      status: 'success',
      message: 'Portfolio refreshed successfully',
      data: {
        portfolio: {
          totalAssets: portfolio.totalAssets,
          unrealizedPnL: portfolio.unrealizedPnL,
          unrealizedPnLPercent: portfolio.unrealizedPnLPercent,
          allocation: portfolio.allocation,
          lastUpdated: portfolio.lastUpdated
        }
      }
    });
  } catch (error) {
    console.error('Refresh portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
