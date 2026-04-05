const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const createAdminRoutes = require('./routes/admin-routes');
const createPublicRoutes = require('./routes/public-routes');

function createApp(syncEngine, playlistManager) {
  const app = express();

  // Middleware stack (order matters)
  app.use(cors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Admin-Password'],
    credentials: false,
  }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Mount routes
  app.use(createAdminRoutes(playlistManager, syncEngine));
  app.use(createPublicRoutes());

  return app;
}

module.exports = createApp;
