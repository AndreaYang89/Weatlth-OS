# Bug 修复总结

## 修复列表

### 🔴 安全相关

#### 1. MongoDB 无密码问题
**文件**: `docker-compose.yml`

**修复前**:
```yaml
environment:
  - MONGO_INITDB_DATABASE=wealthos
```

**修复后**:
```yaml
environment:
  - MONGO_INITDB_DATABASE=wealthos
  - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME:-admin}
  - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:-changeme-in-production}
```

- 添加了 MongoDB 认证
- 移除了生产环境的端口暴露
- 更新了 MONGODB_URI 包含认证信息

#### 2. CORS 全开问题
**文件**: `server/src/app.js`

**修复前**:
```javascript
app.use(cors());
```

**修复后**:
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS || '').split(',') 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
```

#### 3. JWT fallback 弱密钥
**文件**: `server/src/utils/jwt.js`, `server/src/middleware/auth.js`

**修复前**:
```javascript
process.env.JWT_SECRET || 'your-secret-key'
```

**修复后**:
```javascript
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    console.warn('WARNING: Using development JWT secret...');
    return 'dev-secret-not-for-production-' + Date.now();
  }
  return secret;
};
```

- 生产环境强制要求设置 JWT_SECRET
- 开发环境使用随机生成的临时密钥

---

### 🟠 逻辑 Bug

#### 4. validate 中间件传参错误
**文件**: `server/src/routes/auth.js`, `server/src/routes/holdings.js`

**修复前**:
```javascript
validate([body()])  // ❌ 没有参数
validate([param()]) // ❌ 没有参数
```

**修复后**:
```javascript
const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('...'),
  body('newPassword').isLength({ min: 6 }).withMessage('...')
];
validate(changePasswordValidation)  // ✅ 使用定义好的验证规则

const holdingIdValidation = [
  param('id').isMongoId().withMessage('Invalid holding ID')
];
validate(holdingIdValidation)
```

#### 5. 404 和 Error Handler 顺序写反
**文件**: `server/src/app.js`

**修复前**:
```javascript
// Error handler first (WRONG!)
app.use((err, req, res, next) => { ... });
// 404 handler after (will never be reached)
app.use((req, res) => { ... });
```

**修复后**:
```javascript
// 404 Handler - must be before error handler
app.use((req, res) => { ... });

// Error Handling Middleware - must be last
app.use((err, req, res, next) => { ... });
```

---

### 🟡 性能优化

#### 6. GET /summary 使用 aggregate
**文件**: `server/src/routes/holdings.js`

**修复前**:
```javascript
const holdings = await Holding.find({ user: req.user._id, isActive: true });
// 然后在 JS 中循环聚合
```

**修复后**:
```javascript
const [aggregateResult] = await Holding.aggregate([
  { $match: { user: req.user._id, isActive: true } },
  {
    $group: {
      _id: null,
      totalHoldings: { $sum: 1 },
      totalMarketValue: { $sum: '$marketValue' },
      totalCost: { $sum: { $multiply: ['$avgCost', '$shares'] } },
      // ...
    }
  }
]);
```

- 使用 MongoDB 聚合管道在数据库层面完成计算
- 减少数据传输和内存使用

---

### 🟢 代码质量

#### 7. 统一 req.userId 和 req.user._id
**文件**: `server/src/routes/*.js`, `server/src/middleware/auth.js`

**修复**:
- 所有路由统一使用 `req.user._id`
- 中间件不再设置 `req.userId`
- 保持代码风格一致性

#### 8. aiAnalysis 说明
**文件**: `server/src/utils/aiAnalysis.js`

**添加说明**:
```javascript
/**
 * ⚠️ IMPORTANT DISCLAIMER:
 * This module provides SIMULATED analysis for demonstration purposes only.
 * It is NOT real AI analysis and should NOT be used for actual investment decisions.
 * 
 * How it works:
 * - Technical ratings are generated based on a deterministic hash of the stock symbol
 * - Market ratings are based on the symbol hash combined with category
 * - The same stock symbol will ALWAYS produce the same rating (deterministic)
 * - Results do NOT reflect actual market conditions or technical indicators
 */
```

---

### 🔵 部署改进

#### 9. MongoDB healthcheck
**文件**: `docker-compose.yml`

**添加**:
```yaml
healthcheck:
  test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
  interval: 10s
  timeout: 10s
  retries: 5
  start_period: 40s

depends_on:
  mongo:
    condition: service_healthy
```

- 确保 MongoDB 完全就绪后才启动 server
- 避免连接失败导致的启动错误

---

## 验证清单

- [x] `npm run dev` 本地开发正常
- [x] `docker-compose up -d` Docker 部署正常
- [x] JWT 认证流程正常
- [x] 所有 API 端点响应正确
- [x] MongoDB 聚合查询性能提升
- [x] 404 和错误处理顺序正确

## 环境变量更新

### 服务端 (.env)
```bash
# 新增
ALLOWED_ORIGINS=http://localhost,https://yourdomain.com

# 生产环境必须设置
JWT_SECRET=your-secure-random-string-min-32-chars
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-password
```

### Docker Compose 环境变量
```bash
# 生产环境部署前必须设置
export JWT_SECRET=your-secure-random-string-min-32-chars
export MONGO_ROOT_PASSWORD=your-secure-mongodb-password
export ALLOWED_ORIGINS=https://yourdomain.com
```
