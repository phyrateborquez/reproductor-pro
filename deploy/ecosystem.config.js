module.exports = {
  apps: [{
    name: 'reproductor-pro',
    cwd: '/opt/reproductor-pro/server',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      ALLOWED_ORIGINS: 'https://yourdomain.com',
      COINGECKO_URL: 'https://api.coingecko.com/api/v3/simple/price',
    },
    max_memory_restart: '500M',
    error_file: '/var/log/pm2/reproductor-pro-error.log',
    out_file: '/var/log/pm2/reproductor-pro-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
