const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  totalAssets: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  unrealizedPnL: {
    type: Number,
    default: 0
  },
  unrealizedPnLPercent: {
    type: Number,
    default: 0
  },
  // Asset Allocation
  allocation: [{
    category: String,
    amount: Number,
    percentage: Number,
    color: String
  }],
  // Risk Metrics
  riskMetrics: {
    beta: {
      type: Number,
      default: 0
    },
    sharpeRatio: {
      type: Number,
      default: 0
    },
    maxDrawdown: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    },
    concentrationRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  // Health Score
  healthScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 70
  },
  // Last Updated
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate portfolio metrics
portfolioSchema.methods.calculateMetrics = function(holdings) {
  let totalValue = 0;
  let totalCost = 0;
  let categoryMap = {};

  holdings.forEach(holding => {
    const value = holding.currentPrice * holding.shares;
    const cost = holding.avgCost * holding.shares;
    totalValue += value;
    totalCost += cost;

    // Group by category
    if (!categoryMap[holding.category]) {
      categoryMap[holding.category] = 0;
    }
    categoryMap[holding.category] += value;
  });

  this.totalAssets = totalValue;
  this.totalCost = totalCost;
  this.unrealizedPnL = totalValue - totalCost;
  this.unrealizedPnLPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  // Calculate allocation percentages
  const colors = {
    '消费': '#6366f1',
    '新能源': '#f59e0b',
    '海外': '#10b981',
    '互联网': '#8b5cf6',
    '科技': '#06b6d4',
    '金融': '#64748b',
    '医药': '#ec4899',
    '其他': '#94a3b8'
  };

  this.allocation = Object.entries(categoryMap).map(([category, amount]) => ({
    category,
    amount,
    percentage: totalValue > 0 ? (amount / totalValue) * 100 : 0,
    color: colors[category] || '#94a3b8'
  }));

  // Check concentration risk
  const maxAllocation = Math.max(...this.allocation.map(a => a.percentage), 0);
  if (maxAllocation > 40) {
    this.riskMetrics.concentrationRisk = 'high';
  } else if (maxAllocation > 25) {
    this.riskMetrics.concentrationRisk = 'medium';
  } else {
    this.riskMetrics.concentrationRisk = 'low';
  }

  this.lastUpdated = new Date();
};

module.exports = mongoose.model('Portfolio', portfolioSchema);
