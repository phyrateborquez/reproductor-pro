const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { validateVideoBody } = require('../middleware/validate');
const PlaylistManager = require('../services/playlist-manager');

function createAdminRoutes(playlistManager, syncEngine) {
  const express = require('express');
  const router = express.Router();

  // Serve admin dashboard
  router.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
  });

  // All API routes require auth
  router.use('/api', requireAuth);

  // GET /api/playlist - Return ordered playlist
  router.get('/api/playlist', (req, res) => {
    const playlist = playlistManager.getPlaylist();
    res.json(playlist);
  });

  // POST /api/playlist - Add video to playlist
  router.post('/api/playlist', validateVideoBody, async (req, res) => {
    try {
      const { title, source_url, source_type, duration } = req.body;
      const video = await playlistManager.addVideo(title, source_url, source_type, duration);
      res.status(201).json(video);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/playlist/:id - Update video metadata
  router.put('/api/playlist/:id', async (req, res) => {
    try {
      const video = await playlistManager.updateVideo(
        parseInt(req.params.id, 10),
        req.body
      );
      res.json(video);
    } catch (err) {
      if (err.message === 'Video not found') {
        return res.status(404).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/playlist/:id - Remove from playlist
  router.delete('/api/playlist/:id', async (req, res) => {
    try {
      await playlistManager.removeVideo(parseInt(req.params.id, 10));
      res.status(204).send();
    } catch (err) {
      if (err.message === 'Video not found') {
        return res.status(404).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/playlist/reorder - Reorder via array of IDs
  router.put('/api/playlist/reorder', async (req, res) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Body must be an array of {id, orderIndex}' });
      }
      await playlistManager.reorderPlaylist(req.body);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/playback - Current playback info
  router.get('/api/playback', (req, res) => {
    res.json(syncEngine.getState());
  });

  // POST /api/playback/play
  router.post('/api/playback/play', (req, res) => {
    const started = syncEngine.play();
    if (!started) {
      return res.status(400).json({ error: 'No videos in playlist' });
    }
    res.json(syncEngine.getState());
  });

  // POST /api/playback/pause
  router.post('/api/playback/pause', (req, res) => {
    syncEngine.pause();
    res.json(syncEngine.getState());
  });

  // POST /api/playback/skip
  router.post('/api/playback/skip', (req, res) => {
    syncEngine.skip();
    res.json(syncEngine.getState());
  });

  // POST /api/playback/seek
  router.post('/api/playback/seek', (req, res) => {
    const position = parseFloat(req.body.position);
    if (isNaN(position) || position < 0) {
      return res.status(400).json({ error: 'Valid position required' });
    }
    syncEngine.seekTo(position);
    res.json(syncEngine.getState());
  });

  return router;
}

module.exports = createAdminRoutes;
