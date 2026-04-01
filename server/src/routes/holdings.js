const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const { Holding, Transaction } = require('../models');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { analyzeHolding } = require('../utils/aiAnalysis');
const { refreshAllPrices } = require('../jobs/priceRefresh');

// Validation rules
const createHoldingValidation = [
  body('symbol')
    .trim()
    .notEmpty()
    .withMessage('Stock symbol is required')
    .toUpperCase(),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Stock name is required'),
  body('category')
    .isIn(['消费', '新能源', '海外', '互联网', '科技', '金融', '医药', '其他'])
    .withMessage('Invalid category'),
  body('shares')
    .isFloat({ min: 0 })
    .withMessage('Shares must be a positive number'),
  body('avgCost')
    .isFloat({ min: 0 })
    .withMessage('Average cost must be a positive number'),
  body('currentPrice')
    .optional()
    .isFloat({ min: 0 })
];

const updateHoldingValidation = [
  body('shares')
    .optional()
    .isFloat({ min: 0 }),
  body('avgCost')
    .optional()
    .isFloat({ min: 0 }),
  body('currentPrice')
    .optional()
    .isFloat({ min: 0 }),
  body('strategy')
    .optional()
    .isIn(['持有', '定投', '加仓', '减仓', '止损', '观望']),
  body('notes')
    .optional()
    .trim()
];

// @route   GET /api/v1/holdings
// @desc    Get all holdings for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { category, rating, sortBy = 'marketValue', order = 'desc' } = req.query;

    let query = { user: req.user._id, isActive: true };

    if (category) {
      query.category = category;
    }

    if (rating) {
      query.overallRating = rating;
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    const holdings = await Holding.find(query).sort(sortOptions);

    // Enrich with calculated fields
    const enrichedHoldings = holdings.map(holding => {
      const pnl = holding.getUnrealizedPnL();
      const pnlPercent = holding.getPnLPercentage();
      
      return {
        ...holding.toObject(),
        unrealizedPnL: pnl,
        unrealizedPnLPercent: pnlPercent,
        pnlColor: pnl >= 0 ? '#34d399' : '#ef4444'
      };
    });

    res.json({
      status: 'success',
      data: {
        holdings: enrichedHoldings,
        count: enrichedHoldings.length
      }
    });
  } catch (error) {
    console.error('Get holdings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/holdings/summary
// @desc    Get holdings summary using MongoDB aggregation for better performance
// @access  Private
router.get('/summary', auth, async (req, res) => {
  try {
    // Use MongoDB aggregation for efficient computation
    const [aggregateResult] = await Holding.aggregate([
      { $match: { user: req.user._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalHoldings: { $sum: 1 },
          totalMarketValue: { $sum: '$marketValue' },
          totalCost: { $sum: { $multiply: ['$avgCost', '$shares'] } },
          byCategory: {
            $push: {
              category: '$category',
              marketValue: '$marketValue'
            }
          },
          byRating: {
            $push: '$overallRating'
          }
        }
      }
    ]);

    // Initialize summary with defaults
    const summary = {
      totalHoldings: 0,
      byCategory: {},
      byRating: {
        'strong-buy': 0,
        'buy': 0,
        'neutral': 0,
        'reduce': 0,
        'sell': 0
      },
      totalMarketValue: 0,
      totalCost: 0,
      totalUnrealizedPnL: 0,
      totalPnLPercent: 0
    };

    if (aggregateResult) {
      summary.totalHoldings = aggregateResult.totalHoldings;
      summary.totalMarketValue = aggregateResult.totalMarketValue || 0;
      summary.totalCost = aggregateResult.totalCost || 0;
      summary.totalUnrealizedPnL = summary.totalMarketValue - summary.totalCost;
      summary.totalPnLPercent = summary.totalCost > 0 
        ? (summary.totalUnrealizedPnL / summary.totalCost) * 100 
        : 0;

      // Process category breakdown
      aggregateResult.byCategory.forEach((item) => {
        if (!summary.byCategory[item.category]) {
          summary.byCategory[item.category] = { count: 0, marketValue: 0 };
        }
        summary.byCategory[item.category].count++;
        summary.byCategory[item.category].marketValue += item.marketValue || 0;
      });

      // Process rating breakdown
      aggregateResult.byRating.forEach((rating) => {
        if (summary.byRating[rating] !== undefined) {
          summary.byRating[rating]++;
        }
      });
    }

    res.json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/holdings/refresh-prices
// @desc    手动触发一次价格刷新（内部调用 priceRefresh job）
// @access  Private
router.post('/refresh-prices', auth, async (req, res) => {
  try {
    const result = await refreshAllPrices();
    res.json({
      status: 'success',
      message: `价格刷新完成：更新 ${result.updated} 条，失败 ${result.failed} 条`,
      data: result
    });
  } catch (error) {
    console.error('Refresh prices error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Validation for holding ID
const holdingIdValidation = [
  param('id').isMongoId().withMessage('Invalid holding ID')
];

// @route   GET /api/v1/holdings/:id
// @desc    Get single holding
// @access  Private
router.get('/:id', auth, holdingIdValidation, validate(holdingIdValidation), async (req, res) => {
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

    const pnl = holding.getUnrealizedPnL();
    const pnlPercent = holding.getPnLPercentage();

    res.json({
      status: 'success',
      data: {
        holding: {
          ...holding.toObject(),
          unrealizedPnL: pnl,
          unrealizedPnLPercent: pnlPercent
        }
      }
    });
  } catch (error) {
    console.error('Get holding error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/holdings
// @desc    Create new holding
// @access  Private
router.post('/', auth, createHoldingValidation, validate(createHoldingValidation), async (req, res) => {
  try {
    const { symbol, name, category, shares, avgCost, currentPrice, notes } = req.body;

    // Check if holding already exists
    const existingHolding = await Holding.findOne({
      user: req.user._id,
      symbol: symbol.toUpperCase()
    });

    if (existingHolding) {
      return res.status(400).json({
        status: 'error',
        message: 'Holding for this symbol already exists. Please update instead.'
      });
    }

    const price = currentPrice || avgCost;
    const marketValue = price * shares;

    // Create holding
    const holding = new Holding({
      user: req.user._id,
      symbol: symbol.toUpperCase(),
      name,
      category,
      shares,
      avgCost,
      currentPrice: price,
      marketValue,
      notes
    });

    // Run AI analysis
    const analysis = analyzeHolding(holding);
    Object.assign(holding, analysis);

    await holding.save();

    // Create transaction record
    const transaction = new Transaction({
      user: req.user._id,
      holding: holding._id,
      symbol: symbol.toUpperCase(),
      type: 'buy',
      shares,
      price: avgCost,
      amount: avgCost * shares,
      notes: 'Initial purchase'
    });
    await transaction.save();

    res.status(201).json({
      status: 'success',
      message: 'Holding created successfully',
      data: { holding }
    });
  } catch (error) {
    console.error('Create holding error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   PUT /api/v1/holdings/:id
// @desc    Update holding
// @access  Private
router.put('/:id', auth, updateHoldingValidation, validate(updateHoldingValidation), async (req, res) => {
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

    const updates = req.body;

    // Update fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        holding[key] = updates[key];
      }
    });

    // Recalculate market value if price or shares changed
    if (updates.currentPrice || updates.shares) {
      holding.marketValue = holding.currentPrice * holding.shares;
    }

    // Re-run AI analysis if price changed significantly
    if (updates.currentPrice) {
      const analysis = analyzeHolding(holding);
      Object.assign(holding, analysis);
    }

    await holding.save();

    res.json({
      status: 'success',
      message: 'Holding updated successfully',
      data: { holding }
    });
  } catch (error) {
    console.error('Update holding error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/v1/holdings/:id
// @desc    Delete holding (soft delete)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
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

    holding.isActive = false;
    await holding.save();

    res.json({
      status: 'success',
      message: 'Holding deleted successfully'
    });
  } catch (error) {
    console.error('Delete holding error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Validation for transaction
const transactionValidation = [
  param('id').isMongoId().withMessage('Invalid holding ID'),
  body('type').isIn(['buy', 'sell']).withMessage('Type must be buy or sell'),
  body('shares').isFloat({ min: 0.01 }).withMessage('Shares must be positive'),
  body('price').isFloat({ min: 0.01 }).withMessage('Price must be positive')
];

// @route   POST /api/v1/holdings/:id/transaction
// @desc    Add transaction to holding
// @access  Private
router.post('/:id/transaction', auth, transactionValidation, validate(transactionValidation), async (req, res) => {
  try {
    const { type, shares, price, fees = 0, notes } = req.body;

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

    const amount = price * shares;

    // Create transaction
    const transaction = new Transaction({
      user: req.user._id,
      holding: holding._id,
      symbol: holding.symbol,
      type,
      shares,
      price,
      amount,
      fees,
      notes
    });
    await transaction.save();

    // Update holding
    if (type === 'buy') {
      const totalCost = holding.avgCost * holding.shares + amount;
      holding.shares += shares;
      holding.avgCost = totalCost / holding.shares;
    } else {
      holding.shares -= shares;
      if (holding.shares <= 0) {
        holding.isActive = false;
      }
    }

    holding.marketValue = holding.currentPrice * holding.shares;
    await holding.save();

    res.json({
      status: 'success',
      message: 'Transaction recorded successfully',
      data: { transaction, holding }
    });
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
