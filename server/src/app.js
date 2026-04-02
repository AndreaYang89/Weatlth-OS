const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Security check: JWT_SECRET must be set in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not set in production environment');
  process.exit(1);
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
}

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Database Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wealthos', {
      // MongoDB connection options
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Routes
const apiPrefix = process.env.API_PREFIX || '/api/v1';

app.use(`${apiPrefix}/auth`, require('./routes/auth'));
app.use(`${apiPrefix}/portfolio`, require('./routes/portfolio'));
app.use(`${apiPrefix}/holdings`, require('./routes/holdings'));
app.use(`${apiPrefix}/analysis`, require('./routes/analysis'));
app.use(`${apiPrefix}/rebalance`, require('./routes/rebalance'));
app.use(`${apiPrefix}/transactions`, require('./routes/transactions'));
app.use(`${apiPrefix}/reviews`, require('./routes/reviews'));
app.use(`${apiPrefix}/config`, require('./routes/config'));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'WealthOS API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Info Route
app.get('/api', (req, res) => {
  res.json({
    name: 'WealthOS API',
    version: '1.0.0',
    description: 'Personal Asset Allocation Management System',
    endpoints: {
      auth: `${apiPrefix}/auth`,
      portfolio: `${apiPrefix}/portfolio`,
      holdings: `${apiPrefix}/holdings`,
      analysis: `${apiPrefix}/analysis`,
      rebalance: `${apiPrefix}/rebalance`,
      health: '/health'
    }
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// 404 Handler - must be before error handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Error Handling Middleware - must be last
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
const { startPriceRefreshJob } = require('./jobs/priceRefresh');

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // 启动定时价格刷新（连上数据库后再启动）
  startPriceRefreshJob();
});

module.exports = app;
