const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: [true, 'Stock symbol is required'],
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Stock name is required'],
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['消费', '新能源', '海外', '互联网', '科技', '金融', '医药', '其他']
  },
  shares: {
    type: Number,
    required: true,
    min: 0
  },
  avgCost: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  marketValue: {
    type: Number,
    default: 0
  },
  // Technical Rating
  technicalRating: {
    type: String,
    enum: ['strong', 'good', 'neutral', 'bad', 'weak'],
    default: 'neutral'
  },
  technicalDetail: {
    type: String,
    default: ''
  },
  // Market Rating
  marketRating: {
    type: String,
    enum: ['hot', 'warm', 'cool', 'cold'],
    default: 'warm'
  },
  marketDetail: {
    type: String,
    default: ''
  },
  // Overall Rating
  overallRating: {
    type: String,
    enum: ['strong-buy', 'buy', 'neutral', 'reduce', 'sell'],
    default: 'neutral'
  },
  starRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 3
  },
  // Strategy
  strategy: {
    type: String,
    enum: ['持有', '定投', '加仓', '减仓', '止损', '观望'],
    default: '持有'
  },
  // Risk Metrics
  stopLoss: {
    type: Number,
    default: null
  },
  takeProfit: {
    type: Number,
    default: null
  },
  // Metadata
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // 行情相关
  lastPriceUpdate: {
    type: Date,
    default: null
  },
  priceSource: {
    type: String,
    enum: ['manual', 'auto', 'mock'],
    default: 'manual'
  }
}, {
  timestamps: true
});

// Calculate unrealized P&L
holdingSchema.methods.getUnrealizedPnL = function() {
  if (!this.currentPrice || !this.avgCost) return 0;
  return (this.currentPrice - this.avgCost) * this.shares;
};

// Calculate P&L percentage
holdingSchema.methods.getPnLPercentage = function() {
  if (!this.currentPrice || !this.avgCost || this.avgCost === 0) return 0;
  return ((this.currentPrice - this.avgCost) / this.avgCost) * 100;
};

// Update market value
holdingSchema.methods.updateMarketValue = function() {
  this.marketValue = this.currentPrice * this.shares;
};

// Indexes
holdingSchema.index({ user: 1, symbol: 1 }, { unique: true });
holdingSchema.index({ user: 1, category: 1 });
holdingSchema.index({ user: 1, overallRating: 1 });

module.exports = mongoose.model('Holding', holdingSchema);
