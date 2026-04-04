const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const { WatchlistItem } = require('../models');
const stockDataService = require('../services/stockDataService');
const { syncHoldingWatchlist, needsWatchlistBackfill } = require('../utils/watchlistSync');

const VALID_PERIODS = ['1m', '3m', '6m', '1y', '2y', '5y', 'all'];
const VALID_GROUPS = ['holding', 'watching', 'custom'];

function ok(data, message) {
  return {
    status: 'success',
    ...(message ? { message } : {}),
    data,
  };
}

function fail(message) {
  return {
    status: 'error',
    message,
  };
}

function isValidSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  return /^[\w.]{1,20}$/.test(symbol.trim());
}

async function getSortedWatchlist(userId) {
  if (await needsWatchlistBackfill(userId)) {
    await syncHoldingWatchlist(userId);
  }
  const items = await WatchlistItem.find({ user: userId })
    .sort({ group: 1, updatedAt: -1, createdAt: -1 })
    .lean();

  const order = { holding: 0, watching: 1, custom: 2 };

  return items
    .sort((a, b) => {
      const groupDiff = (order[a.group] ?? 99) - (order[b.group] ?? 99);
      if (groupDiff !== 0) return groupDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .map(item => ({
      id: item._id.toString(),
      symbol: item.symbol,
      name: item.name,
      group: item.group,
      source: item.source,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
}

router.use(auth);

router.get('/search', async (req, res) => {
  try {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
    if (keyword.length < 2) {
      return res.status(400).json(fail('搜索关键词至少 2 个字符'));
    }

    const data = await stockDataService.searchStocks(keyword);
    res.json(ok(data));
  } catch (error) {
    console.error('stocks/search error:', error);
    res.status(500).json(fail(error.message || '搜索失败'));
  }
});

router.get('/hot', async (req, res) => {
  try {
    const hotSymbols = ['000001', '600519', '00700', '300750', '510300', '002594'];
    const data = await Promise.all(
      hotSymbols.map(symbol => stockDataService.getQuote(symbol).catch(() => null))
    );
    res.json(ok(data.filter(Boolean)));
  } catch (error) {
    console.error('stocks/hot error:', error);
    res.status(500).json(fail(error.message || '获取热门股票失败'));
  }
});

router.post('/batch/quote', async (req, res) => {
  try {
    const symbols = Array.isArray(req.body.symbols) ? req.body.symbols : [];

    if (symbols.length === 0) {
      return res.status(400).json(fail('请提供有效的股票代码数组'));
    }

    if (symbols.length > 50) {
      return res.status(400).json(fail('单次最多查询 50 只股票'));
    }

    if (symbols.some(symbol => !isValidSymbol(symbol))) {
      return res.status(400).json(fail('包含无效的股票代码'));
    }

    const data = await stockDataService.getBatchQuote(symbols);
    res.json(ok(data));
  } catch (error) {
    console.error('stocks/batch/quote error:', error);
    res.status(500).json(fail(error.message || '批量获取行情失败'));
  }
});

router.get('/watchlist', async (req, res) => {
  try {
    const data = await getSortedWatchlist(req.user._id);
    res.json(ok(data));
  } catch (error) {
    console.error('stocks/watchlist get error:', error);
    res.status(500).json(fail(error.message || '获取关注列表失败'));
  }
});

/**
 * 轻量查询：判断某支股票是否在当前用户的关注列表中
 * GET /api/v1/stocks/watchlist/check?symbol=600519
 */
router.get('/watchlist/check', async (req, res) => {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
    if (!symbol || !isValidSymbol(symbol)) {
      return res.status(400).json(fail('请提供有效的股票代码'));
    }
    if (await needsWatchlistBackfill(req.user._id)) {
      await syncHoldingWatchlist(req.user._id);
    }
    const item = await WatchlistItem.findOne({ user: req.user._id, symbol }).lean();
    res.json(ok(item ? {
      inWatchlist: true,
      id: item._id.toString(),
      group: item.group,
      source: item.source,
    } : { inWatchlist: false }));
  } catch (error) {
    console.error('stocks/watchlist/check error:', error);
    res.status(500).json(fail(error.message || '查询失败'));
  }
});

router.post('/watchlist', async (req, res) => {
  try {
    const symbol = typeof req.body.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const group = typeof req.body.group === 'string' ? req.body.group : 'watching';

    if (!symbol || !name) {
      return res.status(400).json(fail('symbol 和 name 为必填项'));
    }

    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    if (!VALID_GROUPS.includes(group)) {
      return res.status(400).json(fail('group 只能为 holding / watching / custom'));
    }

    const existing = await WatchlistItem.findOne({ user: req.user._id, symbol });
    if (existing) {
      return res.status(409).json(fail('该股票已在关注列表中'));
    }

    const created = await WatchlistItem.create({
      user: req.user._id,
      symbol,
      name,
      group,
      source: 'manual',
    });

    res.status(201).json(ok({
      id: created._id.toString(),
      symbol: created.symbol,
      name: created.name,
      group: created.group,
      source: created.source,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }, '已添加到关注列表'));
  } catch (error) {
    console.error('stocks/watchlist create error:', error);
    res.status(500).json(fail(error.message || '添加关注失败'));
  }
});

router.delete('/watchlist/:id', async (req, res) => {
  try {
    const item = await WatchlistItem.findOne({ _id: req.params.id, user: req.user._id });

    if (!item) {
      return res.status(404).json(fail('关注项不存在'));
    }

    if (item.source === 'holding') {
      return res.status(400).json(fail('该标的是持仓同步项，请先在持仓中处理'));
    }

    await item.deleteOne();
    res.json(ok(null, '已从关注列表移除'));
  } catch (error) {
    console.error('stocks/watchlist delete error:', error);
    res.status(500).json(fail(error.message || '移除关注失败'));
  }
});

router.get('/:symbol/quote', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getQuote(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/quote error:`, error);
    res.status(500).json(fail(error.message || '获取行情失败'));
  }
});

router.get('/:symbol/valuation', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getValuation(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/valuation error:`, error);
    res.status(500).json(fail(error.message || '获取估值数据失败'));
  }
});

router.get('/:symbol/financial', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getFinancial(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/financial error:`, error);
    res.status(500).json(fail(error.message || '获取财务数据失败'));
  }
});

router.get('/:symbol/technical', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getTechnical(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/technical error:`, error);
    res.status(500).json(fail(error.message || '获取技术指标失败'));
  }
});

router.get('/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const period = typeof req.query.period === 'string' ? req.query.period : '1y';

    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json(fail('无效的周期参数'));
    }

    const data = await stockDataService.getHistory(symbol, period);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/history error:`, error);
    res.status(500).json(fail(error.message || '获取历史行情失败'));
  }
});

router.get('/:symbol/news', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getNews(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/news error:`, error);
    res.status(500).json(fail(error.message || '获取资讯失败'));
  }
});

router.get('/:symbol/events', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getKeyEvents(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/events error:`, error);
    res.status(500).json(fail(error.message || '获取关键事件失败'));
  }
});

router.get('/:symbol/ratings', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getAnalystRatings(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/ratings error:`, error);
    res.status(500).json(fail(error.message || '获取机构评级失败'));
  }
});

router.get('/:symbol/analysis', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isValidSymbol(symbol)) {
      return res.status(400).json(fail('无效的股票代码'));
    }

    const data = await stockDataService.getAIAnalysis(symbol);
    res.json(ok(data));
  } catch (error) {
    console.error(`stocks/${req.params.symbol}/analysis error:`, error);
    res.status(500).json(fail(error.message || '获取 AI 分析失败'));
  }
});

module.exports = router;
