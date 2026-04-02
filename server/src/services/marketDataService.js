/**
 * Market Data Service
 *
 * provider 通过配置页或 MARKET_DATA_PROVIDER 环境变量切换，运行时动态生效。
 *   - 'mock'      : 模拟价格 ±2% 随机波动（默认）
 *   - 'tencent'   : 腾讯财经 API（免费，A股实时）
 *   - 'eastmoney' : 东方财富 API（免费，A股实时）
 *   - 'tushare'   : Tushare Pro（日线收盘价，需 Token）
 *   - 'akshare'   : AKShare Python bridge（需本地服务）
 */

const axios = require('axios');

// ─── Mock Provider ─────────────────────────────────────────────────────────────
const mockProvider = {
  async getPrice(symbol, basePrice = null) {
    const base = basePrice || _deterministicBase(symbol);
    const variation = (Math.random() - 0.5) * 0.04;
    const price = parseFloat((base * (1 + variation)).toFixed(3));
    const change = parseFloat((price - base).toFixed(3));
    const changePercent = parseFloat(((change / base) * 100).toFixed(2));
    return { price, change, changePercent, source: 'mock', updatedAt: new Date() };
  },
  async getBatchPrices(symbolBasePairs) {
    const results = new Map();
    for (const { symbol, basePrice } of symbolBasePairs) {
      results.set(symbol, await this.getPrice(symbol, basePrice));
    }
    return results;
  }
};

// ─── 腾讯财经 Provider ────────────────────────────────────────────────────────
const tencentProvider = {
  async getPrice(symbol, _basePrice) {
    const prefix = symbol.startsWith('6') ? 'sh' : 'sz';
    const url = `https://qt.gtimg.cn/q=${prefix}${symbol}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const parts = data.split('~');
    if (parts.length < 5) throw new Error(`腾讯行情解析失败: ${data.slice(0, 80)}`);
    const price = parseFloat(parts[3]);
    const prevClose = parseFloat(parts[4]);
    const change = parseFloat((price - prevClose).toFixed(3));
    const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2));
    console.log(`[MarketData:tencent] ${symbol} → ¥${price}`);
    return { price, change, changePercent, source: 'tencent', updatedAt: new Date() };
  },
  async getBatchPrices(symbolBasePairs) {
    const codes = symbolBasePairs.map(({ symbol }) =>
      (symbol.startsWith('6') ? 'sh' : 'sz') + symbol
    ).join(',');
    const { data } = await axios.get(`https://qt.gtimg.cn/q=${codes}`, { timeout: 8000 });
    const results = new Map();
    // 每条格式: v_sh600519="...~现价~昨收~..."
    const lines = data.split('\n').filter(l => l.includes('='));
    for (const line of lines) {
      const parts = line.split('~');
      if (parts.length < 5) continue;
      const rawSymbol = line.match(/v_[a-z]{2}(\d+)/)?.[1];
      if (!rawSymbol) continue;
      const price = parseFloat(parts[3]);
      const prevClose = parseFloat(parts[4]);
      if (isNaN(price) || price <= 0) continue;
      const change = parseFloat((price - prevClose).toFixed(3));
      const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2));
      results.set(rawSymbol, { price, change, changePercent, source: 'tencent', updatedAt: new Date() });
    }
    return results;
  }
};

// ─── Tushare Pro Provider ─────────────────────────────────────────────────────
// 注意: daily 接口返回最近交易日收盘价（非实时），适合收盘后更新
const tushareProvider = {
  async getPrice(symbol, _basePrice) {
    const token = process.env.TUSHARE_API_TOKEN;
    if (!token) throw new Error('TUSHARE_API_TOKEN 未配置');
    const exchange = symbol.startsWith('6') ? 'SH' : 'SZ';
    const tsCode = `${symbol}.${exchange}`;
    console.log(`[MarketData:tushare] 查询 ${tsCode}...`);
    const { data } = await axios.post('https://api.tushare.pro', {
      api_name: 'daily',
      token,
      params: { ts_code: tsCode, limit: 1 },
      fields: 'ts_code,close,change,pct_chg',
    }, { timeout: 10000 });
    if (!data.data?.items?.length) throw new Error(`Tushare 未返回 ${tsCode} 数据（积分不足或非交易日）`);
    const [, close, change, pctChg] = data.data.items[0];
    console.log(`[MarketData:tushare] ${tsCode} → ¥${close}`);
    return {
      price: parseFloat(close),
      change: parseFloat(change),
      changePercent: parseFloat(pctChg),
      source: 'tushare',
      updatedAt: new Date(),
    };
  },
  async getBatchPrices(symbolBasePairs) {
    const results = new Map();
    for (const { symbol, basePrice } of symbolBasePairs) {
      try {
        results.set(symbol, await this.getPrice(symbol, basePrice));
      } catch (err) {
        console.error(`[MarketData:tushare] ${symbol} 失败: ${err.message}`);
      }
    }
    return results;
  }
};

// ─── AKShare Bridge Provider ──────────────────────────────────────────────────
const akshareProvider = {
  async getPrice(symbol, _basePrice) {
    const bridgeUrl = process.env.AKSHARE_BRIDGE_URL || 'http://localhost:8001';
    const { data } = await axios.get(`${bridgeUrl}/realtime/${symbol}`, { timeout: 5000 });
    return { price: data.price, change: data.change, changePercent: data.changePercent, source: 'akshare', updatedAt: new Date() };
  },
  async getBatchPrices(symbolBasePairs) {
    const results = new Map();
    for (const { symbol, basePrice } of symbolBasePairs) {
      try { results.set(symbol, await this.getPrice(symbol, basePrice)); }
      catch (err) { console.error(`[MarketData:akshare] ${symbol} 失败: ${err.message}`); }
    }
    return results;
  }
};

// ─── Provider 注册表 ──────────────────────────────────────────────────────────
const providers = {
  mock:      mockProvider,
  tencent:   tencentProvider,
  tushare:   tushareProvider,
  akshare:   akshareProvider,
};

function getProviderName() {
  return process.env.MARKET_DATA_PROVIDER || 'mock';
}

function getProvider() {
  const name = getProviderName();
  const p = providers[name];
  if (!p) {
    console.warn(`[MarketData] 未知 provider "${name}"，回退到 mock`);
    return providers.mock;
  }
  return p;
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────
const marketDataService = {
  getProviderName,

  async getPrice(symbol, basePrice = null) {
    try {
      return await getProvider().getPrice(symbol, basePrice);
    } catch (err) {
      console.error(`[MarketData] getPrice 失败 ${symbol}: ${err.message}`);
      return null;
    }
  },

  async getBatchPrices(symbolBasePairs) {
    try {
      return await getProvider().getBatchPrices(symbolBasePairs);
    } catch (err) {
      console.error('[MarketData] getBatchPrices 失败:', err.message);
      return new Map();
    }
  }
};

// ─── 内部工具 ──────────────────────────────────────────────────────────────────
function _deterministicBase(symbol) {
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 10 + (hash % 990);
}

module.exports = marketDataService;
