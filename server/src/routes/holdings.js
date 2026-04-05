const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const { Holding, Transaction } = require('../models');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { analyzeHolding } = require('../utils/aiAnalysis'); // mock，用于初始创建时的快速分析
const aiService = require('../services/aiService');
const { refreshAllPrices } = require('../jobs/priceRefresh');
const { syncHoldingWatchlist } = require('../utils/watchlistSync');

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

// @route   POST /api/v1/holdings/import
// @desc    Bulk upsert holdings from CSV/Excel import
// @access  Private
function normalizeImportedSymbol(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^=/, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function parseImportedNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[,\uFF0C]/g, '')
    .replace(/[%￥¥元股份天]/g, '')
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

router.post('/import', auth, async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No items provided' });
    }

    let created = 0, updated = 0, failed = 0;
    const errors = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      try {
        const { symbol, name, category, shares, avgCost, currentPrice, notes } = item;
        const sym = normalizeImportedSymbol(symbol);
        const cleanName = String(name || '').trim();
        const cleanShares = parseImportedNumber(shares);
        const cleanAvgCost = parseImportedNumber(avgCost);
        const cleanCurrentPrice = parseImportedNumber(currentPrice);
        if (!sym || !cleanName || cleanShares <= 0 || cleanAvgCost <= 0) {
          failed++;
          errors.push({
            index,
            symbol: sym || String(symbol || '').trim(),
            name: cleanName,
            reason: !sym ? '缺少或无法识别代码' :
              !cleanName ? '缺少名称' :
              cleanShares <= 0 ? '持有数量无效' : '单位成本无效'
          });
          continue;
        }

        const price = cleanCurrentPrice || cleanAvgCost;
        const marketValue = price * cleanShares;
        const patch = {
          name: cleanName,
          category: category || '其他',
          shares: cleanShares,
          avgCost: cleanAvgCost,
          currentPrice: price,
          marketValue
        };
        if (notes !== undefined) patch.notes = notes;

        const existing = await Holding.findOne({ user: req.user._id, symbol: sym });
        if (existing) {
          Object.assign(existing, patch);
          const analysis = analyzeHolding(existing);
          Object.assign(existing, analysis);
          await existing.save();
          updated++;
        } else {
          const holding = new Holding({ user: req.user._id, symbol: sym, ...patch });
          const analysis = analyzeHolding(holding);
          Object.assign(holding, analysis);
          await holding.save();
          const Transaction = require('../models').Transaction;
          await new Transaction({
            user: req.user._id, holding: holding._id, symbol: sym,
            type: 'buy', shares: cleanShares, price: cleanAvgCost, amount: cleanAvgCost * cleanShares, notes: 'Import'
          }).save();
          created++;
        }
      } catch (e) {
        failed++;
        errors.push({
          index,
          symbol: normalizeImportedSymbol(item?.symbol),
          name: String(item?.name || '').trim(),
          reason: e.message || '保存失败'
        });
      }
    }

    syncHoldingWatchlist(req.user._id).catch(err => {
      console.error('[watchlistSync] import sync failed:', err);
    });

    res.json({ status: 'success', data: { created, updated, failed, errors } });
  } catch (error) {
    console.error('Import holdings error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// ── 规则引擎（与前端保持一致，作为 AI 前的快速通道）────────────
const VALID_CATEGORIES = ['消费', '新能源', '海外', '互联网', '科技', '金融', '医药', '其他'];
function guessCategoryByRule(symbol, name) {
  if (/^[A-Za-z]+$/.test(symbol)) return '海外';
  if (/^\d{4,5}$/.test(symbol))   return '海外';
  if (/银行|证券|保险|信托|期货|基金|券商|资产管理|投资控股|租赁/.test(name))        return '金融';
  if (/医药|医疗|生物|制药|药业|健康|医院|基因|疫苗|诊断|试剂|医械/.test(name))      return '医药';
  if (/新能源|光伏|风电|储能|锂电|电池|氢能|充电|太阳能|风能|绿电/.test(name))       return '新能源';
  if (/消费|食品|饮料|白酒|啤酒|零售|百货|超市|家居|服装|餐饮|日化|酿酒|乳业/.test(name)) return '消费';
  if (/互联网|网络|游戏|电商|直播|社交|在线|云|SaaS/.test(name))                    return '互联网';
  if (/科技|芯片|半导体|通信|电子|软件|数字|智能|机器人|航天|卫星|激光|雷达|仪器/.test(name)) return '科技';
  return null; // 规则拿不准，交给 AI
}

// @route   POST /api/v1/holdings/classify
// @desc    批量推断类别（规则优先，规则不确定时调用 AI provider）
// @access  Private
router.post('/classify', auth, async (req, res) => {
  try {
    const items = req.body; // [{ symbol, name }, ...]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No items' });
    }

    const needAI = [];
    const result = items.map((item, idx) => {
      const sym = String(item.symbol || '').trim();
      const name = String(item.name || '').trim();
      const ruled = guessCategoryByRule(sym, name);
      if (ruled) return { symbol: sym, category: ruled };
      needAI.push({ idx, sym, name });
      return { symbol: sym, category: '其他' }; // 占位，后面覆盖
    });

    // AI 批量分类（仅对规则拿不准的）
    if (needAI.length > 0) {
      const provider = process.env.AI_PROVIDER || 'mock';
      if (provider !== 'mock') {
        const OpenAI = require('openai');
        const Anthropic = require('@anthropic-ai/sdk').Anthropic;
        const prompt = `请将以下股票/资产归入类别。类别只能从这几个中选：${VALID_CATEGORIES.join('、')}。
以 JSON 数组返回，格式：[{"symbol":"代码","category":"类别"},...]，不要其他文字。

${needAI.map(x => `${x.sym} ${x.name}`).join('\n')}`;

        try {
          let text = '';
          if (provider === 'deepseek' || provider === 'kimi' || provider === 'mimo') {
            const key =
              provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY :
              provider === 'kimi' ? process.env.KIMI_API_KEY :
              process.env.MIMO_API_KEY;
            const baseURL =
              provider === 'deepseek' ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1') :
              provider === 'kimi' ? (process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1') :
              (process.env.MIMO_BASE_URL || 'https://openrouter.ai/api/v1');
            const model =
              provider === 'deepseek'
                ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
                : provider === 'kimi'
                  ? (process.env.KIMI_MODEL || 'moonshot-v1-8k')
                  : (process.env.MIMO_MODEL || 'xiaomi/mimo-v2-flash');
            if (key) {
              const client = new OpenAI({
                apiKey: key,
                baseURL,
                timeout: 15000,
                maxRetries: 0,
                ...(provider === 'mimo'
                  ? {
                      defaultHeaders: {
                        'HTTP-Referer': process.env.MIMO_HTTP_REFERER || 'https://wealthos.local',
                        'X-Title': process.env.MIMO_APP_NAME || 'WealthOS',
                      },
                    }
                  : {}),
              });
              let r;
              try {
                r = await client.chat.completions.create({
                  model,
                  messages: [{ role: 'user', content: prompt }],
                  response_format: { type: 'json_object' },
                  max_tokens: 512,
                });
              } catch (err) {
                const bodyText = JSON.stringify(err.error || err.response?.data || '');
                const maybeFormatIssue =
                  (err.status || err.statusCode) === 400 &&
                  /response_format|json_object|unsupported|invalid/i.test(bodyText + err.message);
                if (!maybeFormatIssue) throw err;
                r = await client.chat.completions.create({
                  model,
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 512,
                });
              }
              text = r.choices?.[0]?.message?.content || '';
            }
          } else if (provider === 'claude') {
            const key = process.env.ANTHROPIC_API_KEY;
            if (key) {
              const client = new Anthropic({ apiKey: key });
              const r = await client.messages.create({
                model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                messages: [{ role: 'user', content: prompt }],
              });
              text = r.content[0]?.text || '';
            }
          } else if (provider === 'openai') {
            const key = process.env.OPENAI_API_KEY;
            if (key) {
              const client = new OpenAI({ apiKey: key, timeout: 15000, maxRetries: 0 });
              const r = await client.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                max_tokens: 512,
              });
              text = r.choices?.[0]?.message?.content || '';
            }
          }

          if (text) {
            const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
            const match = cleaned.match(/\[[\s\S]*\]/);
            if (match) {
              const aiResult = JSON.parse(match[0]);
              for (const item of aiResult) {
                const entry = needAI.find(x => x.sym === item.symbol);
                if (entry && VALID_CATEGORIES.includes(item.category)) {
                  result[entry.idx].category = item.category;
                }
              }
            }
          }
        } catch (aiErr) {
          console.warn('[classify] AI 分类失败，使用规则结果:', aiErr.message);
        }
      }
    }

    res.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Classify error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
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

    syncHoldingWatchlist(req.user._id).catch(err => {
      console.error('[watchlistSync] create sync failed:', err);
    });

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

    syncHoldingWatchlist(req.user._id).catch(err => {
      console.error('[watchlistSync] update sync failed:', err);
    });

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

    syncHoldingWatchlist(req.user._id).catch(err => {
      console.error('[watchlistSync] delete sync failed:', err);
    });

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

    syncHoldingWatchlist(req.user._id).catch(err => {
      console.error('[watchlistSync] transaction sync failed:', err);
    });

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
