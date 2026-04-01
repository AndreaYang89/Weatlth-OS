const mongoose = require('mongoose');

// 创建复盘时自动快照的持仓数据结构
const portfolioSnapshotSchema = new mongoose.Schema({
  totalAssets:   { type: Number, default: 0 },
  totalCost:     { type: Number, default: 0 },
  unrealizedPnL: { type: Number, default: 0 },
  pnlPercent:    { type: Number, default: 0 },
  holdingsCount: { type: Number, default: 0 },
  topHoldings: [{
    symbol:      String,
    name:        String,
    marketValue: Number,
    pnlPercent:  Number,
    _id: false
  }]
}, { _id: false });

const reviewEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  title: {
    type: String,
    required: [true, '标题不能为空'],
    trim: true,
    maxlength: [100, '标题最多100字']
  },
  content: {
    type: String,
    default: '',
    maxlength: [10000, '正文最多10000字']
  },
  // 情绪标记：看涨 / 中性 / 看跌
  mood: {
    type: String,
    enum: ['bullish', 'neutral', 'bearish'],
    default: 'neutral'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 20
  }],
  // 写入时自动抓取的持仓快照
  portfolioSnapshot: portfolioSnapshotSchema
}, {
  timestamps: true
});

// 按用户+日期倒序查询
reviewEntrySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('ReviewEntry', reviewEntrySchema);
