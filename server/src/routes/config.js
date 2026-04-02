const express = require('express');
const router = express.Router();

// 内存中存储当前配置（重启后重置，持久化请改 .env）
let currentConfig = {
  marketDataProvider: process.env.MARKET_DATA_PROVIDER || 'mock',
  priceRefreshCron:   process.env.PRICE_REFRESH_CRON   || '*/30 * * * *',
  aiProvider:         process.env.AI_PROVIDER          || 'mock',
  anthropicApiKey:    process.env.ANTHROPIC_API_KEY    ? '***已配置***' : '',
  openaiApiKey:       process.env.OPENAI_API_KEY       ? '***已配置***' : '',
  akshareBridgeUrl:   process.env.AKSHARE_BRIDGE_URL   || '',
};

// GET /api/v1/config — 读取当前配置（供前端展示）
router.get('/', (req, res) => {
  res.json({ status: 'success', data: currentConfig });
});

// PUT /api/v1/config — 更新配置
router.put('/', (req, res) => {
  const allowed = [
    'marketDataProvider', 'priceRefreshCron', 'aiProvider',
    'anthropicApiKey', 'openaiApiKey', 'akshareBridgeUrl',
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
        akshareBridgeUrl:   'AKSHARE_BRIDGE_URL',
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

module.exports = router;
