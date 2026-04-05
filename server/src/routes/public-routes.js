const path = require('path');
const economicService = require('../services/economic-service');

function createPublicRoutes() {
  const express = require('express');
  const router = express.Router();

  // Serve embeddable player page
  router.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/player/index.html'));
  });

  // Economic data endpoint (no auth required)
  router.get('/api/economic', (req, res) => {
    const data = economicService.getData();
    if (!data) {
      return res.status(503).json({ error: 'Economic data not yet available' });
    }
    res.json(data);
  });

  return router;
}

module.exports = createPublicRoutes;
