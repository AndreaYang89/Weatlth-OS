#!/bin/bash
# WealthOS - 本地上传脚本（在 Windows Git Bash 中运行）
# 用法: bash upload.sh <你的SSH用户名>
# 示例: bash upload.sh ubuntu

SERVER_IP="43.157.59.181"
SERVER_USER="${1:-ubuntu}"
SERVER_DIR="/opt/wealthos"
LOCAL_SERVER="wealthOS/wealthos-fullstack/server"

echo "=== 上传 WealthOS 后端到 $SERVER_USER@$SERVER_IP ==="

# 1. 在服务器上创建目录
ssh "$SERVER_USER@$SERVER_IP" "sudo mkdir -p $SERVER_DIR && sudo chown $SERVER_USER:$SERVER_USER $SERVER_DIR"

# 2. 上传服务器代码（排除 node_modules 和本地 .env）
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '*.log' \
  "$LOCAL_SERVER/" \
  "$SERVER_USER@$SERVER_IP:$SERVER_DIR/"

echo ""
echo "上传完成！"
echo ""
echo "下一步，SSH 到服务器执行："
echo "  ssh $SERVER_USER@$SERVER_IP"
echo "  sudo mkdir -p /var/log/wealthos"
echo "  cd $SERVER_DIR && npm install --production"
echo "  # 首次部署："
echo "  bash $SERVER_DIR/deploy.sh"
echo "  # 或仅重启应用（已部署过）："
echo "  cd $SERVER_DIR && pm2 restart wealthos"
