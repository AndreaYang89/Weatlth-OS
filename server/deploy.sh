#!/bin/bash
# WealthOS Server Deployment Script
# Ubuntu Server 24.04 LTS
# Run as root or sudo user

set -e

echo "=== WealthOS 服务器部署 ==="

# ─── 1. 系统更新 ──────────────────────────────────────────────────────────────
echo "[1/6] 更新系统包..."
apt-get update -y && apt-get upgrade -y

# ─── 2. 安装 Node.js 20.x ─────────────────────────────────────────────────────
echo "[2/6] 安装 Node.js 20.x..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node -v)  npm: $(npm -v)"

# ─── 3. 安装 MongoDB 7.x ──────────────────────────────────────────────────────
echo "[3/6] 安装 MongoDB 7.x..."
if ! command -v mongod &> /dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" \
    | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -y
  apt-get install -y mongodb-org
fi

# 启动 MongoDB 并设为开机自启
systemctl start mongod
systemctl enable mongod
echo "MongoDB: $(mongod --version | head -1)"

# ─── 4. 安装 PM2 & Nginx ──────────────────────────────────────────────────────
echo "[4/6] 安装 PM2 和 Nginx..."
npm install -g pm2
apt-get install -y nginx

# ─── 5. 部署应用 ──────────────────────────────────────────────────────────────
echo "[5/6] 部署应用..."
APP_DIR=/opt/wealthos

mkdir -p $APP_DIR
# 将上传的文件解压到 /opt/wealthos（upload.sh 会处理这一步）
# 如果已有文件则跳过
if [ -f "$APP_DIR/package.json" ]; then
  echo "应用文件已存在，安装依赖..."
  cd $APP_DIR && npm install --production
fi

# 创建 .env（首次部署时）
if [ ! -f "$APP_DIR/.env" ]; then
  cat > $APP_DIR/.env << 'ENVEOF'
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb://127.0.0.1:27017/wealthos

JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_SECRET_STRING
JWT_EXPIRE=30d

API_PREFIX=/api/v1

MARKET_DATA_PROVIDER=mock
PRICE_REFRESH_CRON=*/30 * * * *

AI_PROVIDER=mock
ENVEOF
  echo "⚠️  请编辑 $APP_DIR/.env 修改 JWT_SECRET！"
fi

# ─── 6. 配置 Nginx ─────────────────────────────────────────────────────────────
echo "[6/6] 配置 Nginx..."
cat > /etc/nginx/sites-available/wealthos << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    # API 反向代理
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/wealthos /etc/nginx/sites-enabled/wealthos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# ─── 启动应用 ──────────────────────────────────────────────────────────────────
if [ -f "$APP_DIR/ecosystem.config.js" ]; then
  cd $APP_DIR
  pm2 start ecosystem.config.js --env production
  pm2 save
  pm2 startup | tail -1 | bash  # 设置 PM2 开机自启
fi

echo ""
echo "=== 部署完成 ==="
echo "API 地址: http://43.157.59.181/api/v1"
echo "健康检查: curl http://43.157.59.181/api/v1/health"
echo ""
echo "常用命令:"
echo "  pm2 status          # 查看应用状态"
echo "  pm2 logs wealthos   # 查看日志"
echo "  pm2 restart wealthos # 重启应用"
