const db = require('../db');

const queries = {
  get: () => db.get('SELECT * FROM playback_state WHERE id = 1'),

  upsert: async (currentVideoId, position, isPlaying) => {
    const existing = await db.get('SELECT id FROM playback_state WHERE id = 1');

    if (existing) {
      await db.run(
        'UPDATE playback_state SET current_video_id = ?, position = ?, is_playing = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1',
        [currentVideoId, position, isPlaying ? 1 : 0]
      );
    } else {
      await db.run(
        'INSERT INTO playback_state (id, current_video_id, position, is_playing, last_updated) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)',
        [currentVideoId, position, isPlaying ? 1 : 0]
      );
    }

    return db.get('SELECT * FROM playback_state WHERE id = 1');
  },
};

module.exports = queries;
