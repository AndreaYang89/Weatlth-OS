module.exports = {
  apps: [
    {
      name: 'wealthos',
      script: 'src/app.js',
      cwd: '/opt/wealthos',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志配置
      out_file: '/var/log/wealthos/out.log',
      error_file: '/var/log/wealthos/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
