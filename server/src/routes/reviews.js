const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const { ReviewEntry, Holding } = require('../models');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ─── 校验规则 ─────────────────────────────────────────────────────────────────
const createValidation = [
  body('title').trim().notEmpty().withMessage('标题不能为空').isLength({ max: 100 }),
  body('content').optional().isLength({ max: 10000 }),
  body('mood').optional().isIn(['bullish', 'neutral', 'bearish']).withMessage('无效的情绪值'),
  body('tags').optional().isArray().withMessage('tags 必须为数组'),
  body('date').optional().isISO8601().withMessage('日期格式无效').toDate(),
];

const updateValidation = [
  param('id').isMongoId().withMessage('无效的 ID'),
  body('title').optional().trim().notEmpty().isLength({ max: 100 }),
  body('content').optional().isLength({ max: 10000 }),
  body('mood').optional().isIn(['bullish', 'neutral', 'bearish']),
  body('tags').optional().isArray(),
];

// ─── 内部工具：快照当前持仓状态 ──────────────────────────────────────────────
async function capturePortfolioSnapshot(userId) {
  const holdings = await Holding.find({ user: userId, isActive: true });

  const totalAssets = holdings.reduce((s, h) => s + (h.marketValue || 0), 0);
  const totalCost   = holdings.reduce((s, h) => s + h.avgCost * h.shares, 0);
  const unrealizedPnL = totalAssets - totalCost;
  const pnlPercent = totalCost > 0
    ? parseFloat(((unrealizedPnL / totalCost) * 100).toFixed(2))
    : 0;

  const topHoldings = holdings
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
    .slice(0, 5)
    .map(h => ({
      symbol:      h.symbol,
      name:        h.name,
      marketValue: h.marketValue || 0,
      pnlPercent:  h.avgCost > 0
        ? parseFloat((((h.currentPrice - h.avgCost) / h.avgCost) * 100).toFixed(2))
        : 0
    }));

  return {
    totalAssets:   parseFloat(totalAssets.toFixed(2)),
    totalCost:     parseFloat(totalCost.toFixed(2)),
    unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
    pnlPercent,
    holdingsCount: holdings.length,
    topHoldings
  };
}

// ─── 路由 ─────────────────────────────────────────────────────────────────────

// @route   GET /api/v1/reviews
// @desc    获取当前用户的复盘列表（分页，按日期倒序）
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      ReviewEntry.find({ user: req.user._id })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      ReviewEntry.countDocuments({ user: req.user._id })
    ]);

    res.json({
      status: 'success',
      data: { entries, total, page, limit, hasMore: skip + entries.length < total }
    });
  } catch (err) {
    console.error('List reviews error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   POST /api/v1/reviews
// @desc    新建复盘日记（自动抓取当前持仓快照）
// @access  Private
router.post('/', auth, createValidation, validate(createValidation), async (req, res) => {
  try {
    const { title, content, mood, tags, date } = req.body;

    const snapshot = await capturePortfolioSnapshot(req.user._id);

    const entry = await ReviewEntry.create({
      user:              req.user._id,
      date:              date || new Date(),
      title,
      content:           content || '',
      mood:              mood    || 'neutral',
      tags:              tags    || [],
      portfolioSnapshot: snapshot
    });

    res.status(201).json({ status: 'success', data: { entry } });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/v1/reviews/:id
// @desc    获取单条复盘
// @access  Private
router.get(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('无效的 ID')],
  validate([param('id').isMongoId()]),
  async (req, res) => {
    try {
      const entry = await ReviewEntry.findOne({
        _id:  req.params.id,
        user: req.user._id
      });
      if (!entry) {
        return res.status(404).json({ status: 'error', message: '复盘记录不存在' });
      }
      res.json({ status: 'success', data: { entry } });
    } catch (err) {
      console.error('Get review error:', err);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  }
);

// @route   PUT /api/v1/reviews/:id
// @desc    更新复盘（只允许编辑文字内容，快照不变）
// @access  Private
router.put('/:id', auth, updateValidation, validate(updateValidation), async (req, res) => {
  try {
    const entry = await ReviewEntry.findOne({
      _id:  req.params.id,
      user: req.user._id
    });
    if (!entry) {
      return res.status(404).json({ status: 'error', message: '复盘记录不存在' });
    }

    const { title, content, mood, tags } = req.body;
    if (title   !== undefined) entry.title   = title;
    if (content !== undefined) entry.content = content;
    if (mood    !== undefined) entry.mood    = mood;
    if (tags    !== undefined) entry.tags    = tags;

    await entry.save();
    res.json({ status: 'success', data: { entry } });
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   DELETE /api/v1/reviews/:id
// @desc    删除复盘
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const entry = await ReviewEntry.findOneAndDelete({
      _id:  req.params.id,
      user: req.user._id
    });
    if (!entry) {
      return res.status(404).json({ status: 'error', message: '复盘记录不存在' });
    }
    res.json({ status: 'success', message: '复盘记录已删除' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;
