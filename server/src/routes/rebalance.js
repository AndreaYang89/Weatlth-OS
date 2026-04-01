const express = require('express');
const router = express.Router();
const { Holding, Portfolio, Transaction } = require('../models');
const { auth } = require('../middleware/auth');
const { analyzePortfolio, generateRebalanceRecommendations } = require('../utils/aiAnalysis');

// @route   GET /api/v1/rebalance
// @desc    Get rebalance recommendations
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    if (holdings.length === 0) {
      return res.json({
        status: 'success',
        data: {
          recommendations: [],
          summary: {
            totalSell: 0,
            totalBuy: 0,
            netAdjustment: 0
          },
          message: 'No holdings to rebalance'
        }
      });
    }

    // Run analysis and generate recommendations
    const analysis = analyzePortfolio(holdings);
    const recommendations = generateRebalanceRecommendations(analysis);

    // Calculate summary
    let totalSell = 0;
    let totalBuy = 0;

    recommendations.forEach(rec => {
      if (rec.action === 'sell' || rec.action === 'reduce') {
        totalSell += rec.suggestedAmount;
      } else if (rec.action === 'buy') {
        totalBuy += rec.suggestedAmount;
      }
    });

    res.json({
      status: 'success',
      data: {
        recommendations: recommendations.map(rec => ({
          symbol: rec.symbol,
          name: rec.name,
          action: rec.action,
          actionText: rec.action === 'sell' ? '卖出' : rec.action === 'reduce' ? '减仓' : '买入',
          reason: rec.reason,
          marketReason: rec.marketReason,
          suggestedAmount: rec.suggestedAmount,
          priority: rec.priority,
          isNew: rec.isNew || false
        })),
        summary: {
          totalSell: Math.round(totalSell),
          totalBuy: Math.round(totalBuy),
          netAdjustment: Math.round(totalBuy - totalSell)
        },
        portfolioHealth: analysis.healthScore,
        riskLevel: analysis.healthScore >= 80 ? 'low' : analysis.healthScore >= 60 ? 'medium' : 'high'
      }
    });
  } catch (error) {
    console.error('Get rebalance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/rebalance/calculate
// @desc    Calculate rebalance based on target allocation
// @access  Private
router.post('/calculate', auth, async (req, res) => {
  try {
    const { targetAllocation, cashToInvest = 0 } = req.body;
    
    const holdings = await Holding.find({ user: req.user._id, isActive: true });
    const portfolio = await Portfolio.findOne({ user: req.user._id });

    if (holdings.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No holdings to rebalance'
      });
    }

    const totalAssets = portfolio?.totalAssets || 
      holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    
    const totalWithCash = totalAssets + cashToInvest;

    // Calculate current allocation
    const currentAllocation = {};
    holdings.forEach(h => {
      if (!currentAllocation[h.category]) {
        currentAllocation[h.category] = 0;
      }
      currentAllocation[h.category] += h.marketValue || 0;
    });

    // Calculate target amounts
    const targets = {};
    const adjustments = [];

    for (const [category, targetPercent] of Object.entries(targetAllocation)) {
      const targetAmount = (targetPercent / 100) * totalWithCash;
      const currentAmount = currentAllocation[category] || 0;
      const difference = targetAmount - currentAmount;

      targets[category] = {
        targetPercent,
        targetAmount,
        currentAmount,
        difference
      };

      // Get holdings in this category
      const categoryHoldings = holdings.filter(h => h.category === category);
      
      if (Math.abs(difference) > 1000) { // Minimum adjustment threshold
        if (difference < 0) {
          // Need to reduce
          const reduceAmount = Math.abs(difference);
          // Find weakest holding in category
          const weakestHolding = categoryHoldings
            .filter(h => h.overallRating === 'reduce' || h.overallRating === 'sell')
            .sort((a, b) => a.starRating - b.starRating)[0];
          
          if (weakestHolding) {
            adjustments.push({
              symbol: weakestHolding.symbol,
              name: weakestHolding.name,
              action: 'reduce',
              category,
              suggestedAmount: reduceAmount,
              currentValue: weakestHolding.marketValue,
              reason: '再平衡：降低该板块配置',
              priority: 'medium'
            });
          }
        } else {
          // Need to increase
          adjustments.push({
            symbol: `${category}ETF`,
            name: `${category}板块ETF`,
            action: 'buy',
            category,
            suggestedAmount: difference,
            currentValue: 0,
            reason: '再平衡：增加该板块配置',
            priority: 'medium',
            isNew: categoryHoldings.length === 0
          });
        }
      }
    }

    res.json({
      status: 'success',
      data: {
        targets,
        adjustments: adjustments.sort((a, b) => b.suggestedAmount - a.suggestedAmount),
        summary: {
          totalAssets,
          cashToInvest,
          totalAfterRebalance: totalWithCash,
          totalAdjustments: adjustments.length
        }
      }
    });
  } catch (error) {
    console.error('Calculate rebalance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/rebalance/execute
// @desc    Execute rebalance — writes Transaction records and updates Holdings
// @access  Private
router.post('/execute', auth, async (req, res) => {
  try {
    const { adjustments } = req.body;

    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'adjustments array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const adjustment of adjustments) {
      const { symbol, action, suggestedAmount, notes } = adjustment;

      if (!symbol || !action || !suggestedAmount) {
        errors.push({ symbol, reason: 'Missing required fields' });
        continue;
      }

      const holding = await Holding.findOne({
        user: req.user._id,
        symbol: symbol.toUpperCase(),
        isActive: true
      });

      if (action === 'sell' || action === 'reduce') {
        if (!holding) {
          errors.push({ symbol, reason: 'Holding not found' });
          continue;
        }
        if (!holding.currentPrice || holding.currentPrice <= 0) {
          errors.push({ symbol, reason: 'Invalid current price, cannot calculate shares' });
          continue;
        }

        const sharesToSell = Math.floor(suggestedAmount / holding.currentPrice);
        if (sharesToSell <= 0) {
          errors.push({ symbol, reason: 'Suggested amount too small to sell any shares' });
          continue;
        }
        if (sharesToSell > holding.shares) {
          errors.push({ symbol, reason: `Cannot sell ${sharesToSell} shares, only ${holding.shares} held` });
          continue;
        }

        const amount = sharesToSell * holding.currentPrice;

        // Write transaction
        await Transaction.create({
          user: req.user._id,
          holding: holding._id,
          symbol: holding.symbol,
          type: 'sell',
          shares: sharesToSell,
          price: holding.currentPrice,
          amount,
          notes: notes || `再平衡 ${action === 'sell' ? '清仓' : '减仓'}`
        });

        // Update holding
        holding.shares -= sharesToSell;
        if (holding.shares <= 0) {
          holding.isActive = false;
        }
        holding.marketValue = holding.currentPrice * holding.shares;
        await holding.save();

        results.push({
          symbol: holding.symbol,
          name: holding.name,
          action,
          shares: sharesToSell,
          price: holding.currentPrice,
          amount,
          remainingShares: holding.shares,
          status: 'executed',
          message: `已卖出 ${sharesToSell} 股，成交金额 ¥${amount.toFixed(2)}`
        });

      } else if (action === 'buy') {
        // Buy orders reference new or existing positions — price must be supplied by caller
        const { price, shares: sharesToBuy, name, category } = adjustment;

        if (!price || price <= 0) {
          errors.push({ symbol, reason: 'price is required for buy orders' });
          continue;
        }
        if (!sharesToBuy || sharesToBuy <= 0) {
          errors.push({ symbol, reason: 'shares is required for buy orders' });
          continue;
        }

        const amount = price * sharesToBuy;
        let targetHolding = holding;

        if (!targetHolding) {
          // Create new holding if it doesn't exist yet
          if (!name || !category) {
            errors.push({ symbol, reason: 'name and category are required for new holdings' });
            continue;
          }
          targetHolding = await Holding.create({
            user: req.user._id,
            symbol: symbol.toUpperCase(),
            name,
            category,
            shares: sharesToBuy,
            avgCost: price,
            currentPrice: price,
            marketValue: amount
          });
        } else {
          // Update existing holding's avgCost
          const totalCost = targetHolding.avgCost * targetHolding.shares + amount;
          targetHolding.shares += sharesToBuy;
          targetHolding.avgCost = totalCost / targetHolding.shares;
          targetHolding.marketValue = targetHolding.currentPrice * targetHolding.shares;
          await targetHolding.save();
        }

        await Transaction.create({
          user: req.user._id,
          holding: targetHolding._id,
          symbol: symbol.toUpperCase(),
          type: 'buy',
          shares: sharesToBuy,
          price,
          amount,
          notes: notes || '再平衡 加仓'
        });

        results.push({
          symbol: symbol.toUpperCase(),
          name: targetHolding.name,
          action: 'buy',
          shares: sharesToBuy,
          price,
          amount,
          status: 'executed',
          message: `已买入 ${sharesToBuy} 股，成交金额 ¥${amount.toFixed(2)}`
        });
      }
    }

    // Recalculate portfolio after all adjustments
    const allHoldings = await Holding.find({ user: req.user._id, isActive: true });
    let portfolio = await Portfolio.findOne({ user: req.user._id });
    if (portfolio) {
      portfolio.calculateMetrics(allHoldings);
      await portfolio.save();
    }

    res.json({
      status: errors.length === 0 ? 'success' : 'partial',
      data: {
        executed: results,
        failed: errors,
        summary: {
          totalExecuted: results.length,
          totalFailed: errors.length,
          totalSellAmount: results
            .filter(r => r.action === 'sell' || r.action === 'reduce')
            .reduce((sum, r) => sum + (r.amount || 0), 0),
          totalBuyAmount: results
            .filter(r => r.action === 'buy')
            .reduce((sum, r) => sum + (r.amount || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Execute rebalance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/rebalance/history
// @desc    Get rebalance history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    // This would typically query a rebalance history collection
    // For now, return empty array
    res.json({
      status: 'success',
      data: {
        history: [],
        message: 'Rebalance history feature coming soon'
      }
    });
  } catch (error) {
    console.error('Get rebalance history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
