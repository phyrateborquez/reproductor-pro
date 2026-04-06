const db = require('../db');

const queries = {
  get: () => db.get('SELECT * FROM playback_state WHERE id = 1'),
  
  upsert: (currentVideoId, position, isPlaying) => {
    // Check if exists
    const existing = db.get('SELECT * FROM playback_state WHERE id = 1');
    
    if (existing) {
      db.run(
        'UPDATE playback_state SET current_video_id = ?, position = ?, is_playing = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1',
        [currentVideoId, position, isPlaying ? 1 : 0]
      );
    } else {
      db.run(
        'INSERT INTO playback_state (id, current_video_id, position, is_playing, last_updated) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)',
        [currentVideoId, position, isPlaying ? 1 : 0]
      );
    }
    
    return db.get('SELECT * FROM playback_state WHERE id = 1');
  },
};

module.exports = queries;
