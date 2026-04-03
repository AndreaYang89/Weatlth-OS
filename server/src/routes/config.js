const express = require('express');
const router = express.Router();

// 内存中存储当前配置（重启后重置，持久化请改 .env）
let currentConfig = {
  marketDataProvider: process.env.MARKET_DATA_PROVIDER || 'mock',
  priceRefreshCron:   process.env.PRICE_REFRESH_CRON   || '*/30 * * * *',
  aiProvider:         process.env.AI_PROVIDER          || 'mock',
  anthropicApiKey:    process.env.ANTHROPIC_API_KEY    ? '***已配置***' : '',
  openaiApiKey:       process.env.OPENAI_API_KEY       ? '***已配置***' : '',
  deepseekApiKey:     process.env.DEEPSEEK_API_KEY     ? '***已配置***' : '',
  kimiApiKey:         process.env.KIMI_API_KEY         ? '***已配置***' : '',
  akshareBridgeUrl:   process.env.AKSHARE_BRIDGE_URL   || '',
  tushareApiToken:    process.env.TUSHARE_API_TOKEN    ? '***已配置***' : '',
};

// GET /api/v1/config — 读取当前配置（供前端展示）
router.get('/', (req, res) => {
  res.json({ status: 'success', data: currentConfig });
});

// PUT /api/v1/config — 更新配置
router.put('/', (req, res) => {
  const allowed = [
    'marketDataProvider', 'priceRefreshCron', 'aiProvider',
    'anthropicApiKey', 'openaiApiKey', 'deepseekApiKey', 'kimiApiKey',
    'akshareBridgeUrl', 'tushareApiToken',
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      currentConfig[key] = req.body[key];
      // 同步到 process.env 使后续服务读取生效
      const envKey = {
        marketDataProvider: 'MARKET_DATA_PROVIDER',
        priceRefreshCron:   'PRICE_REFRESH_CRON',
        aiProvider:         'AI_PROVIDER',
        anthropicApiKey:    'ANTHROPIC_API_KEY',
        openaiApiKey:       'OPENAI_API_KEY',
        deepseekApiKey:     'DEEPSEEK_API_KEY',
        kimiApiKey:         'KIMI_API_KEY',
        akshareBridgeUrl:   'AKSHARE_BRIDGE_URL',
        tushareApiToken:    'TUSHARE_API_TOKEN',
      }[key];
      if (envKey && req.body[key] && !req.body[key].startsWith('***')) {
        process.env[envKey] = req.body[key];
      }
    }
  }

  console.log('[config] 配置已更新:', {
    marketDataProvider: currentConfig.marketDataProvider,
    aiProvider: currentConfig.aiProvider,
  });

  res.json({ status: 'success', message: '配置已更新', data: currentConfig });
});

// GET /api/v1/config/status — 诊断接口：显示当前运行时 provider 和 key 状态
router.get('/status', (req, res) => {
  const aiProvider    = process.env.AI_PROVIDER            || 'mock';
  const marketProvider = process.env.MARKET_DATA_PROVIDER  || 'mock';

  const status = {
    ai: {
      provider:  aiProvider,
      isReal:    aiProvider !== 'mock',
      keyPresent: {
        deepseek:  !!process.env.DEEPSEEK_API_KEY,
        kimi:      !!process.env.KIMI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openai:    !!process.env.OPENAI_API_KEY,
      },
      activeKeyOk: (() => {
        if (aiProvider === 'deepseek')  return !!process.env.DEEPSEEK_API_KEY;
        if (aiProvider === 'kimi')      return !!process.env.KIMI_API_KEY;
        if (aiProvider === 'claude')    return !!process.env.ANTHROPIC_API_KEY;
        if (aiProvider === 'openai')    return !!process.env.OPENAI_API_KEY;
        return true; // mock 不需要 key
      })(),
    },
    market: {
      provider:  marketProvider,
      isReal:    marketProvider !== 'mock',
      keyPresent: {
        tushare:   !!process.env.TUSHARE_API_TOKEN,
        akshare:   !!process.env.AKSHARE_BRIDGE_URL,
      },
      activeKeyOk: (() => {
        if (marketProvider === 'tushare') return !!process.env.TUSHARE_API_TOKEN;
        if (marketProvider === 'akshare') return !!process.env.AKSHARE_BRIDGE_URL;
        return true; // mock / tencent / eastmoney 不需要 key
      })(),
    },
    warning: [],
  };

  // 生成警告
  if (status.ai.isReal && !status.ai.activeKeyOk) {
    status.warning.push(`⚠️  AI provider 设为 "${aiProvider}" 但对应 API Key 未配置，将降级为 mock`);
  }
  if (status.market.isReal && !status.market.activeKeyOk) {
    status.warning.push(`⚠️  行情 provider 设为 "${marketProvider}" 但对应 Token 未配置，将降级为 mock`);
  }

  res.json({ status: 'success', data: status });
});

module.exports = router;
