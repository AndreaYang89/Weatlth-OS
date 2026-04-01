/**
 * 定时行情刷新任务
 *
 * 按照 PRICE_REFRESH_CRON 表达式（默认每30分钟）拉取全部活跃持仓的最新价格，
 * 批量写入 MongoDB。
 *
 * 常用 cron 表达式示例（可在 .env 中配置 PRICE_REFRESH_CRON）:
 *   '* /30 * * * *'       每30分钟（去掉空格）
 *   '0 * /1 9-15 * 1-5'  A股交易时段每小时（去掉空格）
 *   '0 9,12,15 * * 1-5'  工作日 09:00 / 12:00 / 15:00
 *
 * 📌 当 MARKET_DATA_PROVIDER 切换为真实 API 后，此文件无需修改。
 */

const cron = require('node-cron');
const { Holding } = require('../models');
const marketDataService = require('../services/marketDataService');

const DEFAULT_CRON = '*/30 * * * *'; // 每30分钟

let _task = null;

/**
 * 执行一次价格刷新（也可由 /holdings/refresh-prices 手动触发）
 * @returns {{ updated: number, failed: number, error?: string }}
 */
async function refreshAllPrices() {
  const startTime = Date.now();
  console.log('[PriceRefresh] 开始刷新价格...');

  try {
    const holdings = await Holding.find({ isActive: true });
    if (holdings.length === 0) {
      console.log('[PriceRefresh] 无活跃持仓，跳过。');
      return { updated: 0, failed: 0 };
    }

    // 批量获取价格，把 currentPrice 作为 basePrice 传给 mock provider
    const symbolBasePairs = holdings.map(h => ({
      symbol: h.symbol,
      basePrice: h.currentPrice > 0 ? h.currentPrice : h.avgCost
    }));

    const priceMap = await marketDataService.getBatchPrices(symbolBasePairs);

    // 构建批量更新操作
    const bulkOps = [];
    let updated = 0;
    let failed = 0;

    for (const holding of holdings) {
      const priceData = priceMap.get(holding.symbol);
      if (priceData && priceData.price > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: holding._id },
            update: {
              $set: {
                currentPrice: priceData.price,
                marketValue: parseFloat((priceData.price * holding.shares).toFixed(2)),
                lastPriceUpdate: priceData.updatedAt,
                priceSource: priceData.source
              }
            }
          }
        });
        updated++;
      } else {
        failed++;
      }
    }

    if (bulkOps.length > 0) {
      await Holding.bulkWrite(bulkOps);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[PriceRefresh] 完成: 更新 ${updated} 条，失败 ${failed} 条（耗时 ${elapsed}ms）`);
    return { updated, failed };
  } catch (err) {
    console.error('[PriceRefresh] 错误:', err.message);
    return { updated: 0, failed: 0, error: err.message };
  }
}

/** 启动定时任务（在 app.js connectDB 成功后调用） */
function startPriceRefreshJob() {
  const cronExpr = process.env.PRICE_REFRESH_CRON || DEFAULT_CRON;

  if (!cron.validate(cronExpr)) {
    console.error(`[PriceRefresh] 无效的 cron 表达式: "${cronExpr}"，任务未启动。`);
    return;
  }

  _task = cron.schedule(cronExpr, refreshAllPrices, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  console.log(`[PriceRefresh] 定时任务已启动: ${cronExpr} (Asia/Shanghai)`);
  console.log(`[PriceRefresh] 行情来源: ${marketDataService.getProviderName()}`);
}

/** 停止定时任务 */
function stopPriceRefreshJob() {
  if (_task) {
    _task.stop();
    _task = null;
    console.log('[PriceRefresh] 定时任务已停止。');
  }
}

module.exports = { startPriceRefreshJob, stopPriceRefreshJob, refreshAllPrices };
