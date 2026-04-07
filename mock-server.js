/**
 * 轻量 mock API server，用于本地 UI 测试（不依赖 MongoDB）
 * 运行：node mock-server.js
 */
const http = require('http');

const PORTFOLIO = {
  totalAssets: 258640.5,
  totalCost: 220000,
  unrealizedPnL: 38640.5,
  unrealizedPnLPercent: 17.56,
  allocation: [
    { category: '消费',   amount: 90000, percentage: 34.8, color: '#6366f1' },
    { category: '新能源', amount: 75000, percentage: 29.0, color: '#f59e0b' },
    { category: '互联网', amount: 55000, percentage: 21.3, color: '#8b5cf6' },
    { category: '其他',   amount: 38640, percentage: 14.9, color: '#94a3b8' },
  ],
  riskMetrics: { beta: 1.12, sharpeRatio: 1.38, maxDrawdown: 8.4, winRate: 67, concentrationRisk: 'medium' },
  healthScore: 72,
  lastUpdated: new Date().toISOString(),
};

const HOLDINGS = [
  { _id: '1', symbol: '600519', name: '贵州茅台', category: '消费',   shares: 10,  avgCost: 1680, currentPrice: 1756, marketValue: 17560, overallRating: 'buy',     starRating: 4, strategy: '持有', technicalRating: 'good',   marketRating: 'warm', aiScore: 78, isActive: true, unrealizedPnL: 760,  unrealizedPnLPercent: 4.52 },
  { _id: '2', symbol: '300750', name: '宁德时代', category: '新能源', shares: 50,  avgCost: 188,  currentPrice: 205,  marketValue: 10250, overallRating: 'neutral', starRating: 3, strategy: '观望', technicalRating: 'neutral', marketRating: 'cool', aiScore: 55, isActive: true, unrealizedPnL: 850,  unrealizedPnLPercent: 9.04 },
  { _id: '3', symbol: '00700',  name: '腾讯控股', category: '互联网', shares: 100, avgCost: 320,  currentPrice: 368,  marketValue: 36800, overallRating: 'buy',     starRating: 4, strategy: '加仓', technicalRating: 'strong',  marketRating: 'hot',  aiScore: 82, isActive: true, unrealizedPnL: 4800, unrealizedPnLPercent: 15.0 },
];

const ANALYSIS = {
  healthScore: 72,
  ratingDistribution: { 'strong-buy': 0, buy: 2, neutral: 1, reduce: 0, sell: 0 },
  risks: [{ type: 'concentration', severity: 'medium', message: '消费板块占比偏高', percentage: 35 }],
  holdings: HOLDINGS.map(h => ({ ...h, aiScore: h.aiScore })),
  summary: { totalHoldings: 3, strongHoldings: 2, weakHoldings: 0, averageScore: 72 },
};

const WATCHLIST = [
  { id: 'w1', symbol: '600519', name: '贵州茅台', group: 'holding', source: 'holding' },
  { id: 'w2', symbol: '300750', name: '宁德时代', group: 'holding', source: 'holding' },
  { id: 'w3', symbol: '002594', name: '比亚迪',   group: 'watching', source: 'manual' },
];

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
  res.end(JSON.stringify({ status: 'success', data }));
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });
    return res.end();
  }

  const url = req.url || '';
  console.log(`${req.method} ${url}`);

  // Auth
  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    return json(res, { user: { id: '1', username: 'demo', email: 'demo@wealthos.dev', profile: { riskProfile: 'moderate' }, settings: { currency: 'CNY', notifications: { email: false, push: false } }, createdAt: '2025-01-01' }, token: 'mock-jwt-token' });
  }
  if (url.includes('/auth/me')) return json(res, { user: { id: '1', username: 'demo', email: 'demo@wealthos.dev', profile: { riskProfile: 'moderate' }, settings: { currency: 'CNY', notifications: {} }, createdAt: '2025-01-01' } });

  // Portfolio
  if (url.includes('/portfolio/refresh')) return json(res, { message: 'refreshed' });
  if (url.match(/\/portfolio/)) return json(res, { portfolio: PORTFOLIO, topHoldings: HOLDINGS.slice(0, 3) });

  // Holdings
  if (url.includes('/holdings/refresh-prices')) return json(res, { updated: 3, failed: 0 });
  if (url.match(/\/holdings/)) return json(res, { holdings: HOLDINGS });

  // Analysis
  if (url.includes('/analysis/analyze')) return json(res, { analysis: ANALYSIS, recommendations: [] });
  if (url.match(/\/analysis/)) return json(res, { analysis: ANALYSIS });

  // Rebalance
  if (url.match(/\/rebalance/)) return json(res, { recommendations: [], currentAllocation: [], targetAllocation: [] });

  // Stocks - watchlist
  if (url.includes('/stocks/watchlist/check')) return json(res, { inWatchlist: false });
  if (url.includes('/stocks/watchlist')) return json(res, WATCHLIST);
  if (url.includes('/stocks/hot')) return json(res, HOLDINGS.map(h => ({ symbol: h.symbol, name: h.name, price: h.currentPrice, changePercent: 1.2 })));
  if (url.match(/\/stocks\/.*\/quote/)) {
    const sym = (url.match(/\/stocks\/([^/]+)\/quote/) || [])[1] || '600519';
    const stockMap = { '600519': { name:'贵州茅台', price:1756, change:20.5 }, '300750': { name:'宁德时代', price:205, change:3.2 }, '00700': { name:'腾讯控股', price:368, change:4.8 }, '002594': { name:'比亚迪', price:188, change:-1.5 } };
    const s = stockMap[sym] || { name:`股票${sym}`, price:100, change:1.2 };
    return json(res, { symbol: sym, name: s.name, price: s.price, change: s.change, changePercent: parseFloat(((s.change / (s.price - s.change)) * 100).toFixed(2)), pe: 28.4, pb: 9.1, high52w: s.price * 1.15, low52w: s.price * 0.82, updateTime: new Date().toISOString() });
  }
  if (url.match(/\/stocks\/.*\/technical/)) return json(res, { symbol: '600519', trend: 'up', signal: 'bullish', rsi: 58.2, ma5: 1740, ma20: 1700, signals: [{ type: 'buy', description: '短期均线上穿长期均线', indicator: 'MA' }] });
  if (url.match(/\/stocks\/.*\/valuation/)) return json(res, { symbol: '600519', peTtm: 28.4, pb: 9.1, ps: null, pePercentile: 42, pbPercentile: 55 });
  if (url.match(/\/stocks\/.*\/financial/)) return json(res, { symbol: '600519', roe: 0.32, grossMargin: 0.92, revenueGrowth: 12.6, profitGrowth: 13.8, dataAvailable: true });
  if (url.match(/\/stocks\/.*\/news/)) return json(res, [{ title: '贵州茅台：机构维持买入评级', source: '中信证券', publishTime: new Date().toISOString(), sentiment: 'positive' }]);
  if (url.match(/\/stocks\/.*\/events/)) return json(res, [{ id: 'e1', title: '2026年中报披露', eventDate: '2026-08-20', eventType: 'earnings' }]);
  if (url.match(/\/stocks\/.*\/ratings/)) return json(res, [{ rating: 'buy', targetPrice: 1920, analyst: '中信证券', date: '2026-03-18' }]);
  if (url.match(/\/stocks\/.*\/analysis/)) return json(res, { overallScore: 66, recommendation: 'buy', summary: '估值合理，技术面偏多，建议持有。' });
  if (url.match(/\/stocks\/.*\/history/)) {
    const pts = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10), close: 1680 + i * 2.5, open: 1678 + i * 2.4, high: 1695 + i * 2.5, low: 1665 + i * 2.3, volume: 500000 }));
    return json(res, pts);
  }

  // Reviews
  if (url.match(/\/reviews/)) return json(res, { entries: [], total: 0 });

  // Transactions
  if (url.match(/\/transactions/)) return json(res, { transactions: [] });

  // Config
  if (url.match(/\/config/)) return json(res, { aiProvider: 'mock' });

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
});

server.listen(3000, () => console.log('Mock API server running on http://localhost:3000'));
