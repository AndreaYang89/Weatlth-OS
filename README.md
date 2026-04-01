# WealthOS - 个人资产配置管理系统 (全栈版)

一个完整的个人资产配置管理系统，包含 React + Vite 前端和 Node.js + Express 后端。

## 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **图表**: Recharts
- **HTTP 客户端**: Axios
- **图标**: Lucide React

### 后端
- **框架**: Node.js + Express
- **数据库**: MongoDB + Mongoose
- **认证**: JWT
- **安全**: Helmet, bcryptjs
- **日志**: Morgan

## 项目结构

```
wealthos-fullstack/
├── client/                 # React 前端
│   ├── src/
│   │   ├── api/           # API 客户端
│   │   ├── components/    # UI 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── pages/         # 页面组件
│   │   ├── store/         # Zustand Store
│   │   ├── types/         # TypeScript 类型
│   │   └── utils/         # 工具函数
│   ├── Dockerfile
│   └── nginx.conf
├── server/                 # Node.js 后端
│   ├── src/
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # API 路由
│   │   ├── middleware/    # 中间件
│   │   └── utils/         # 工具函数
│   └── Dockerfile
├── docker-compose.yml      # Docker Compose 配置
└── package.json           # 根目录配置
```

## 快速开始

### 方式一：本地开发

1. **安装依赖**
```bash
# 安装所有依赖
npm run install:all

# 或者分别安装
cd client && npm install
cd ../server && npm install
```

2. **配置环境变量**
```bash
# 服务端
cd server
cp .env.example .env
# 编辑 .env 文件，设置 MongoDB URI 和 JWT Secret

# 客户端
cd ../client
cp .env.example .env.local
```

3. **启动开发服务器**
```bash
# 在项目根目录
npm run dev

# 这将同时启动前端 (http://localhost:5173) 和后端 (http://localhost:3000)
```

### 方式二：Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 方式三：腾讯云部署

1. **购买腾讯云服务器** (推荐 Ubuntu 22.04)
2. **安装 Docker 和 Docker Compose**
3. **上传项目文件**
4. **运行部署脚本**

```bash
# 在服务器上
cd /var/www/wealthos
docker-compose up -d
```

## 功能特性

- ✅ 用户注册/登录 (JWT 认证)
- ✅ 持仓管理 (CRUD)
- ✅ 投资组合概览
- ✅ 资产配置可视化
- ✅ AI 智能评估 (技术面 + 市场面)
- ✅ 风险指标计算
- ✅ 调仓建议
- ✅ 响应式设计

## API 文档

### 认证
- `POST /api/v1/auth/register` - 注册
- `POST /api/v1/auth/login` - 登录
- `GET /api/v1/auth/me` - 获取用户信息

### 持仓
- `GET /api/v1/holdings` - 获取所有持仓
- `POST /api/v1/holdings` - 创建持仓
- `PUT /api/v1/holdings/:id` - 更新持仓
- `DELETE /api/v1/holdings/:id` - 删除持仓

### 投资组合
- `GET /api/v1/portfolio` - 投资组合概览
- `POST /api/v1/portfolio/refresh` - 刷新数据

### AI 分析
- `GET /api/v1/analysis` - AI 分析结果
- `POST /api/v1/analysis/analyze` - 运行分析

### 调仓
- `GET /api/v1/rebalance` - 调仓建议

## 环境变量

### 服务端 (.env)
| 变量 | 说明 | 默认值 |
|------|------|--------|
| NODE_ENV | 运行环境 | development |
| PORT | 服务端口 | 3000 |
| MONGODB_URI | MongoDB 连接字符串 | mongodb://localhost:27017/wealthos |
| JWT_SECRET | JWT 密钥 | required |
| JWT_EXPIRE | Token 过期时间 | 7d |

### 客户端 (.env.local)
| 变量 | 说明 | 默认值 |
|------|------|--------|
| VITE_API_URL | API 基础 URL | http://localhost:3000/api/v1 |

## 开发命令

```bash
# 启动开发服务器 (前端 + 后端)
npm run dev

# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev

# 构建前端
npm run build

# 生产环境启动
npm start

# Docker 操作
npm run docker:build
npm run docker:up
npm run docker:down
```

## 生产部署

### 使用 Docker Compose

```bash
# 设置环境变量
export JWT_SECRET=your-super-secret-key

# 启动服务
docker-compose up -d
```

### 手动部署

1. **构建前端**
```bash
cd client
npm install
npm run build
```

2. **部署后端**
```bash
cd ../server
npm install --production
npm start
```

3. **配置 Nginx**
使用 `client/nginx.conf` 作为参考配置。

## 许可证

MIT
