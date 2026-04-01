const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  holding: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Holding',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  shares: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true
  },
  fees: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for querying user's transaction history
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, symbol: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
