const path = require('path');

function createPublicRoutes() {
  const express = require('express');
  const router = express.Router();

  // Endpoint de salud — lo usa UptimeRobot para mantener Render despierto
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
  });

  // Serve embeddable player page
  router.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/player/index.html'));
  });

  return router;
}

module.exports = createPublicRoutes;
