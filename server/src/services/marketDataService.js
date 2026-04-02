/**
 * Market Data Service
 *
 * 📌 INTEGRATION POINT: 接入真实行情时，在下方注册新 provider 并设置 .env 中的
 *    MARKET_DATA_PROVIDER 即可，无需修改调用方代码。
 *
 * 已支持的 provider（通过 MARKET_DATA_PROVIDER 环境变量切换）:
 *   - 'mock'      : 模拟价格，基于当前价格随机浮动 ±2%（默认，无需 API Key）
 *   - 'tencent'   : 腾讯财经 API  [TODO - 取消注释即可启用]
 *   - 'eastmoney' : 东方财富 API  [TODO - 取消注释即可启用]
 *   - 'akshare'   : AKShare Python bridge [TODO - 需自建 REST 中间层]
 *
 * 所有 provider 必须实现以下接口：
 *   getPrice(symbol, basePrice?)  → { price, change, changePercent, source, updatedAt }
 *   getBatchPrices([{symbol, basePrice}]) → Map<symbol, priceData>
 */

const PROVIDER = process.env.MARKET_DATA_PROVIDER || 'mock';

// ─── Mock Provider ─────────────────────────────────────────────────────────────
// 在 currentPrice 基础上施加 ±2% 随机波动，模拟行情刷新
const mockProvider = {
  async getPrice(symbol, basePrice = null) {
    await _simulateLatency();
    const base = basePrice || _deterministicBase(symbol);
    const variation = (Math.random() - 0.5) * 0.04; // ±2%
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

// ─── TODO: 腾讯财经 Provider ───────────────────────────────────────────────────
// A股前缀: sh=上交所, sz=深交所；港股: hk；美股: us
//
// const tencentProvider = {
//   async getPrice(symbol, _basePrice) {
//     const axios = require('axios');
//     // 示例: symbol='600519' → 'sh600519'；需自行根据代码规则补前缀
//     const prefix = symbol.startsWith('6') ? 'sh' : 'sz';
//     const url = `https://qt.gtimg.cn/q=${prefix}${symbol}`;
//     const { data } = await axios.get(url, { timeout: 5000 });
//     // 返回格式: v_sh600519="1~贵州茬茅...~1800.00~..."
//     const parts = data.split('~');
//     const price = parseFloat(parts[3]);
//     const prevClose = parseFloat(parts[4]);
//     const change = parseFloat((price - prevClose).toFixed(3));
//     const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2));
//     return { price, change, changePercent, source: 'tencent', updatedAt: new Date() };
//   },
//   async getBatchPrices(symbolBasePairs) {
//     // 腾讯支持批量查询：qt.gtimg.cn/q=sh600519,sz000001,...
//     const axios = require('axios');
//     const codes = symbolBasePairs.map(({ symbol }) =>
//       (symbol.startsWith('6') ? 'sh' : 'sz') + symbol
//     ).join(',');
//     const { data } = await axios.get(`https://qt.gtimg.cn/q=${codes}`, { timeout: 8000 });
//     const results = new Map();
//     // TODO: 解析批量返回格式
//     return results;
//   }
// };

// ─── TODO: 东方财富 Provider ──────────────────────────────────────────────────
// const eastmoneyProvider = {
//   async getPrice(symbol, _basePrice) {
//     // GET https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f43,f170,f171
//     // f43=现价(×100), f170=涨跌幅(×100), f171=涨跌额(×100)
//     throw new Error('EastMoney provider not yet implemented');
//   },
//   async getBatchPrices(symbolBasePairs) {
//     throw new Error('EastMoney provider not yet implemented');
//   }
// };

// ─── TODO: Tushare Pro Provider ───────────────────────────────────────────────
// 需要在 .env 中设置: TUSHARE_API_TOKEN=your_token
// 注意: Tushare Pro 的 daily 接口为日线行情（非实时），适合收盘后更新持仓成本参考价
//
// const tushareProvider = {
//   async getPrice(symbol, _basePrice) {
//     const axios = require('axios');
//     const token = process.env.TUSHARE_API_TOKEN;
//     // Tushare ts_code 格式: 上交所 600519.SH, 深交所 000001.SZ
//     const exchange = symbol.startsWith('6') ? 'SH' : 'SZ';
//     const tsCode = `${symbol}.${exchange}`;
//     const { data } = await axios.post('https://api.tushare.pro', {
//       api_name: 'daily',
//       token,
//       params: { ts_code: tsCode, limit: 1 },
//       fields: 'ts_code,close,change,pct_chg',
//     }, { timeout: 8000 });
//     if (!data.data || !data.data.items || data.data.items.length === 0) {
//       throw new Error(`Tushare 未返回 ${tsCode} 数据`);
//     }
//     // items[0] 对应 fields 顺序: [ts_code, close, change, pct_chg]
//     const [, close, change, pctChg] = data.data.items[0];
//     return {
//       price: parseFloat(close),
//       change: parseFloat(change),
//       changePercent: parseFloat(pctChg),
//       source: 'tushare',
//       updatedAt: new Date(),
//     };
//   },
//   async getBatchPrices(symbolBasePairs) {
//     const results = new Map();
//     for (const { symbol, basePrice } of symbolBasePairs) {
//       try {
//         results.set(symbol, await this.getPrice(symbol, basePrice));
//       } catch (err) {
//         console.error(`[Tushare] ${symbol} 获取失败:`, err.message);
//       }
//     }
//     return results;
//   }
// };

// ─── TODO: AKShare Bridge Provider ──────────────────────────────────────────
// 需要在本地运行一个 Python FastAPI 服务暴露 AKShare 接口
// const akshareProvider = {
//   async getPrice(symbol, _basePrice) {
//     const axios = require('axios');
//     const bridgeUrl = process.env.AKSHARE_BRIDGE_URL || 'http://localhost:8001';
//     const { data } = await axios.get(`${bridgeUrl}/realtime/${symbol}`, { timeout: 5000 });
//     return { price: data.price, change: data.change, changePercent: data.changePercent,
//              source: 'akshare', updatedAt: new Date() };
//   },
//   async getBatchPrices(symbolBasePairs) {
//     throw new Error('AKShare batch not yet implemented');
//   }
// };

// ─── Provider 注册表 ──────────────────────────────────────────────────────────
const providers = {
  mock: mockProvider,
  // tencent: tencentProvider,     // ← 取消注释并设置 MARKET_DATA_PROVIDER=tencent
  // eastmoney: eastmoneyProvider, // ← 取消注释并设置 MARKET_DATA_PROVIDER=eastmoney
  // tushare: tushareProvider,     // ← 取消注释并设置 MARKET_DATA_PROVIDER=tushare
  // akshare: akshareProvider,     // ← 取消注释并设置 MARKET_DATA_PROVIDER=akshare
};

function getProvider() {
  const p = providers[PROVIDER];
  if (!p) {
    console.warn(`[MarketData] 未知 provider "${PROVIDER}"，回退到 mock`);
    return providers.mock;
  }
  return p;
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────
const marketDataService = {
  getProviderName: () => PROVIDER,

  async getPrice(symbol, basePrice = null) {
    try {
      return await getProvider().getPrice(symbol, basePrice);
    } catch (err) {
      console.error(`[MarketData] getPrice 失败 ${symbol}:`, err.message);
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

// ─── 内部工具函数 ─────────────────────────────────────────────────────────────
function _simulateLatency() {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 80 + 20));
}

// 当 holding 没有 currentPrice 时，用 symbol 生成一个稳定的基准价
function _deterministicBase(symbol) {
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 10 + (hash % 990);
}

module.exports = marketDataService;
