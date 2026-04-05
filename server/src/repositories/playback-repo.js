const db = require('../db');

const queries = {
  get: db.prepare('SELECT * FROM playback_state WHERE id = 1'),
  upsert: db.prepare(`
    INSERT INTO playback_state (id, current_video_id, position, is_playing, last_updated)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      current_video_id = excluded.current_video_id,
      position = excluded.position,
      is_playing = excluded.is_playing,
      last_updated = CURRENT_TIMESTAMP
  `),
};

module.exports = queries;
