const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/db');
const playlistRepo = require('../src/repositories/playlist-repo');

async function importPlaylist() {
  try {
    // Read the UTF-16LE JSON Lines file from yt-dlp
    const jsonPath = path.join(__dirname, '../../playlist.json');
    const content = fs.readFileSync(jsonPath, 'utf16le');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    console.log(`Found ${lines.length} lines.`);
    
    // Convert to objects
    const items = lines.map(line => {
      try {
        return JSON.parse(line.trim());
      } catch(e) { return null; }
    }).filter(i => i);

    console.log(`Parsed ${items.length} valid JSON objects.`);
    if (items.length > 0) {
        console.log(`Sample: Title=${items[0].title}, Duration=${items[0].duration}`);
    }

    await db.initDatabase();
    
    console.log('Clearing existing playlist...');
    await db.run('DELETE FROM playlist');
    
    try {
        await db.run('DELETE FROM playback_state'); 
    } catch(e) {
        console.log('Warning: could not delete playback_state (maybe table missing or empty)');
    }

    let inserted = 0;
    for (const item of items) {
      if (!item.id || !item.title) continue;
      
      const title = item.title;
      const url = `https://youtube.com/watch?v=${item.id}`;
      const duration = item.duration || 0; // duration is usually in seconds
      
      await playlistRepo.insert(title, url, duration);
      inserted++;
      if (inserted % 10 === 0) console.log(`Inserted ${inserted}/${items.length}...`);
    }
    
    console.log(`Done! Inserted ${inserted} videos successfully.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

importPlaylist();
