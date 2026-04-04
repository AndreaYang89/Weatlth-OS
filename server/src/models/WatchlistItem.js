const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  group: {
    type: String,
    enum: ['holding', 'watching', 'custom'],
    default: 'watching',
  },
  source: {
    type: String,
    enum: ['manual', 'holding'],
    default: 'manual',
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
}, {
  timestamps: true,
});

watchlistItemSchema.index({ user: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('WatchlistItem', watchlistItemSchema);
