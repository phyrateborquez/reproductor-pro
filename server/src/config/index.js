require('dotenv').config();

const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  adminPassword: process.env.ADMIN_PASSWORD,

  // CRIT-02: Secreto para firmar las cookies de sesión (debe ser largo y aleatorio)
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-cambiar-en-produccion',

  // Turso (libSQL) — base de datos en la nube
  // Si no se definen, el servidor usa SQLite local (solo para desarrollo)
  tursoUrl: process.env.TURSO_DATABASE_URL || null,
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || null,

  // CORS: Origenes permitidos (incluye FuturoAlternativo)
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : (isProduction
        ? ['https://www.futuroalternativo.net', 'https://futuroalternativo.net']
        : ['http://localhost:3000']),

  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/reproductor.db'),
  driftThreshold: parseFloat(process.env.DRIFT_THRESHOLD) || 1,
  broadcastInterval: parseInt(process.env.BROADCAST_INTERVAL, 10) || 2000,
  isProduction,
};
