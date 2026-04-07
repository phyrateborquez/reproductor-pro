const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const config = require('./config');
const createAdminRoutes = require('./routes/admin-routes');
const createPublicRoutes = require('./routes/public-routes');

function createApp(syncEngine, playlistManager) {
  const app = express();

  // ================================================================
  // HELMET (CRIT-03) — Headers de seguridad HTTP
  // Configura CSP, X-Frame-Options, HSTS, etc.
  // frame-ancestors permite que FuturoAlternativo embeba el /player
  // ================================================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Scripts permitidos: propios + YouTube + Dailymotion SDK
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com", "https://api.dmcdn.net"],
        // Iframes que EL PLAYER puede mostrar (YouTube, Dailymotion)
        frameSrc: ["'self'", "https://www.youtube.com", "https://www.dailymotion.com"],
        // Quién puede embeber ESTE SERVIDOR en un iframe (FuturoAlternativo)
        frameAncestors: ["'self'", "https://www.futuroalternativo.net", "https://futuroalternativo.net"],
        imgSrc: ["'self'", "data:", "https://*"],
        // WebSockets para Socket.IO
        connectSrc: ["'self'", "ws:", "wss:", "https://www.futuroalternativo.net"],
        // Fonts de Google
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      },
    },
    // X-Frame-Options: deshabilitado porque usamos la directiva CSP frame-ancestors
    // que es más moderna y granular
    frameguard: false,
  }));

  // ================================================================
  // SESSION (CRIT-02) — Cookies HttpOnly para autenticación de admin
  // Reemplaza el sessionStorage inseguro del frontend
  // ================================================================
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'rp.sid', // Nombre opaco, no revela el framework
    cookie: {
      httpOnly: true,                        // JS no puede leerla (previene robo via XSS)
      secure: config.isProduction,           // Solo HTTPS en producción
      sameSite: config.isProduction ? 'strict' : 'lax', // Previene CSRF
      maxAge: 8 * 60 * 60 * 1000,           // 8 horas de sesión
    },
  }));

  // ================================================================
  // CORS — Control de origenes permitidos
  // ================================================================
  app.use(cors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],        // Ya no se necesita X-Admin-Password como header
    credentials: true,                       // Necesario para enviar cookies en CORS
  }));

  // Limite de tamaño del body (ALTA-02) — Previene DoS por payloads gigantes
  app.use(express.json({ limit: '10kb' }));

  // Archivos estáticos
  app.use(express.static(path.join(__dirname, '../public')));

  // ================================================================
  // RATE LIMITING (CRIT-01) — Frena ataques de fuerza bruta
  // ================================================================
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    max: 100,                  // Máximo 100 peticiones por IP por ventana
    message: { error: 'Demasiadas peticiones. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);

  // Montar rutas
  app.use(createAdminRoutes(playlistManager, syncEngine));
  app.use(createPublicRoutes());

  return app;
}

module.exports = createApp;
