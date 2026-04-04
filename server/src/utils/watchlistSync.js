/**
 * watchlistSync.js
 *
 * 将当前活跃持仓同步到关注列表。
 * 仅在持仓写入路径（创建/更新/删除/导入/交易）中调用，
 * 不在读路径中调用，避免每次 GET 触发不必要的 DB 写操作。
 *
 * 调用方式（fire-and-forget，不阻塞响应）：
 *   syncHoldingWatchlist(userId).catch(err => console.error('[watchlistSync]', err));
 */

const { Holding, WatchlistItem } = require('../models');

/**
 * @param {import('mongoose').Types.ObjectId | string} userId
 */
async function syncHoldingWatchlist(userId) {
  const [holdings, existing] = await Promise.all([
    Holding.find({ user: userId, isActive: true }).select('symbol name').lean(),
    WatchlistItem.find({ user: userId }).lean(),
  ]);

  const existingBySymbol = new Map(existing.map(item => [item.symbol, item]));
  const activeSymbols    = new Set(holdings.map(h => h.symbol));
  const ops              = [];
  const now              = new Date();

  // 新增或更新持仓项
  for (const holding of holdings) {
    const cur = existingBySymbol.get(holding.symbol);
    if (!cur) {
      ops.push({
        insertOne: {
          document: {
            user: userId,
            symbol: holding.symbol,
            name: holding.name,
            group: 'holding',
            source: 'holding',
            createdAt: now,
            updatedAt: now,
          },
        },
      });
    } else if (cur.group !== 'holding' || cur.source !== 'holding' || cur.name !== holding.name) {
      ops.push({
        updateOne: {
          filter: { _id: cur._id },
          update: {
            $set: {
              name: holding.name,
              group: 'holding',
              source: 'holding',
              updatedAt: now,
            },
          },
        },
      });
    }
  }

  // 已卖出的持仓项降级为手动观察
  for (const item of existing) {
    if (item.source === 'holding' && !activeSymbols.has(item.symbol)) {
      ops.push({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              group: item.group === 'holding' ? 'watching' : item.group,
              source: 'manual',
              updatedAt: now,
            },
          },
        },
      });
    }
  }

  if (ops.length > 0) {
    await WatchlistItem.bulkWrite(ops, { ordered: false });
  }
}

async function needsWatchlistBackfill(userId) {
  const [activeHoldingCount, holdingWatchlistCount] = await Promise.all([
    Holding.countDocuments({ user: userId, isActive: true }),
    WatchlistItem.countDocuments({ user: userId, source: 'holding' }),
  ]);

  return activeHoldingCount > 0 && holdingWatchlistCount === 0;
}

module.exports = {
  syncHoldingWatchlist,
  needsWatchlistBackfill,
};
