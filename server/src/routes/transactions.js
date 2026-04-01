const express = require('express');
const { param, query } = require('express-validator');
const router = express.Router();
const { Transaction, Holding } = require('../models');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

// @route   GET /api/v1/transactions
// @desc    Get all transactions for current user (paginated)
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  query('symbol').optional().trim().toUpperCase(),
  query('type').optional().isIn(['buy', 'sell']).withMessage('type must be buy or sell')
], validate([
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['buy', 'sell'])
]), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.symbol) filter.symbol = req.query.symbol;
    if (req.query.type) filter.type = req.query.type;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('holding', 'name category'),
      Transaction.countDocuments(filter)
    ]);

    res.json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/v1/transactions/summary
// @desc    Buy/sell totals per symbol, overall realized breakdown
// @access  Private
router.get('/summary', auth, async (req, res) => {
  try {
    const [result] = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$symbol',
          totalBought: {
            $sum: { $cond: [{ $eq: ['$type', 'buy'] }, '$amount', 0] }
          },
          totalSold: {
            $sum: { $cond: [{ $eq: ['$type', 'sell'] }, '$amount', 0] }
          },
          buyCount: {
            $sum: { $cond: [{ $eq: ['$type', 'buy'] }, 1, 0] }
          },
          sellCount: {
            $sum: { $cond: [{ $eq: ['$type', 'sell'] }, 1, 0] }
          },
          totalFees: { $sum: '$fees' },
          lastDate: { $max: '$date' }
        }
      },
      { $sort: { lastDate: -1 } }
    ]);

    // Overall totals
    const overall = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalInvested: {
            $sum: { $cond: [{ $eq: ['$type', 'buy'] }, '$amount', 0] }
          },
          totalReturned: {
            $sum: { $cond: [{ $eq: ['$type', 'sell'] }, '$amount', 0] }
          },
          totalFees: { $sum: '$fees' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        bySymbol: Array.isArray(result) ? result : (result ? [result] : []),
        overall: overall[0] || {
          totalInvested: 0,
          totalReturned: 0,
          totalFees: 0,
          totalTransactions: 0
        }
      }
    });
  } catch (error) {
    console.error('Get transaction summary error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/v1/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', auth, [
  param('id').isMongoId().withMessage('Invalid transaction ID')
], validate([param('id').isMongoId()]), async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('holding', 'name category symbol');

    if (!transaction) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }

    res.json({ status: 'success', data: { transaction } });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;
