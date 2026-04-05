require('dotenv').config();

const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  adminPassword: process.env.ADMIN_PASSWORD,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || (isProduction ? [] : ['*']),
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/reproductor.db'),
  coingeckoUrl: process.env.COINGECKO_URL || 'https://api.coingecko.com/api/v3/simple/price',
  driftThreshold: parseFloat(process.env.DRIFT_THRESHOLD) || 1,
  broadcastInterval: parseInt(process.env.BROADCAST_INTERVAL, 10) || 2000,
  isProduction,
};
