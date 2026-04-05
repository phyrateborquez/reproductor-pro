# Technical Design: Synchronized Video Player

## 1. Project Structure

```
reproductor-pro/
├── server/
│   ├── src/
│   │   ├── app.js                    # Express app factory
│   │   ├── server.js                 # Entry point (HTTP + Socket.IO)
│   │   ├── config/
│   │   │   └── index.js              # Env vars, constants, defaults
│   │   ├── db/
│   │   │   ├── index.js              # better-sqlite3 connection & init
│   │   │   └── migrations/
│   │   │       └── 001_initial.sql   # Schema DDL
│   │   ├── repositories/
│   │   │   ├── playlist-repo.js      # Playlist CRUD queries
│   │   │   └── playback-repo.js      # Playback state queries
│   │   ├── services/
│   │   │   ├── sync-engine.js        # Server authority loop (the "leader")
│   │   │   ├── playlist-manager.js   # Business logic for playlist ops
│   │   │   └── economic-service.js   # Economic data fetching & caching
│   │   ├── routes/
│   │   │   ├── admin-routes.js       # Admin page + API routes
│   │   │   └── public-routes.js      # Public embed page + player HTML
│   │   ├── middleware/
│   │   │   ├── auth.js               # Admin password guard
│   │   │   └── validate.js           # Request body validation
│   │   └── sockets/
│   │       ├── socket-handler.js     # Socket.IO event wiring
│   │       └── client-registry.js    # Track connected clients
│   ├── public/
│   │   ├── admin/
│   │   │   ├── index.html            # Admin dashboard
│   │   │   ├── admin.css             # Admin styles
│   │   │   └── admin.js              # Admin client logic
│   │   ├── player/
│   │   │   ├── index.html            # Embeddable player page
│   │   │   ├── player.css            # Player styles
│   │   │   └── player.js             # Player client logic
│   │   └── css/
│   │       └── shared.css            # Shared utility styles
│   ├── .env.example                  # Environment template
│   └── package.json
├── deploy/
│   ├── ecosystem.config.js           # PM2 configuration
│   └── nginx.conf                    # Reverse proxy template
├── .gitignore
└── README.md
```

### Rationale

- **Single repo, single deployable**: The server serves both the admin page and the embeddable player. No separate frontend build step.
- **`server/public/`**: Static assets served directly by Express. No bundler needed — vanilla JS, no frameworks.
- **`server/src/`**: Layered architecture (routes → services → repositories → db). Clear separation of concerns.
- **`deploy/`**: Deployment artifacts kept separate from application code.

---

## 2. Server Architecture

### 2.1 Express App Setup (`app.js`)

```
app.js responsibilities:
├── Create Express app
├── Apply middleware (cors, json, static)
├── Mount routes (/api/*, /admin)
├── Serve static files from public/
└── Export app (not start listening)
```

The app factory pattern keeps testing possible and separates configuration from execution.

**Middleware stack (order matters):**
1. `cors()` — configured with allowed origins from env
2. `express.json()` — body parsing
3. `express.static('public')` — serve HTML/CSS/JS
4. Route handlers

### 2.2 Socket.IO Integration (`server.js`)

```
server.js responsibilities:
├── Create HTTP server from Express app
├── Attach Socket.IO to HTTP server
├── Initialize database
├── Start sync engine
├── Wire socket handlers
└── Listen on port
```

Socket.IO is attached to the same HTTP server as Express, sharing the port. This simplifies deployment (single port, single process).

**Socket.IO configuration:**
```javascript
{
  cors: { origin: ALLOWED_ORIGINS },
  pingInterval: 10000,    // 10s heartbeat from Socket.IO itself
  pingTimeout: 5000,      // 5s timeout before declaring dead
  transports: ['websocket', 'polling']  // WebSocket preferred, polling fallback
}
```

### 2.3 Sync Engine (`sync-engine.js`)

This is the **core** of the system — the server-authority loop that maintains playback state.

**Architecture:**
```
SyncEngine
├── state: { currentVideo, position, isPlaying, startedAt, playlist }
├── loop: setInterval(1000ms) — advances position, checks for video end
├── broadcast: emits sync:state to all clients every 2s
├── driftCheck: compares client heartbeats, emits drift:correct if > 1s
└── playlistAdvance: loads next video, loops to first when playlist ends
```

**The Leader Loop (runs every 1 second):**
```
Every 1000ms:
  1. If isPlaying:
     elapsed = now - lastTick
     position += elapsed / 1000
  2. If position >= currentVideo.duration:
     advanceToNextVideo()
  3. lastTick = now
```

**Why 1 second**: Matches CyTube's proven pattern. Fast enough for smooth position tracking, slow enough to not overload the event loop.

**State broadcast (every 2 seconds):**
```
emit sync:state {
  videoId, position, isPlaying, playlist, timestamp
}
```

### 2.4 Playlist Manager (`playlist-manager.js`)

Business logic layer that sits between routes and the database repository:

```
PlaylistManager
├── addVideo(title, sourceUrl, sourceType, duration)
├── updateVideo(id, updates)
├── removeVideo(id)
├── reorderVideo(id, newOrderIndex)
├── getPlaylist() → ordered list
├── getNextVideo(currentId) → next in order, or first if at end
├── getFirstVideo() → video with order_index = 0
└── validateVideo(url, type) → throws if invalid
```

When the playlist changes, the manager calls `syncEngine.updatePlaylist()` which broadcasts `playlist:update` to all connected clients.

### 2.5 Admin API Routes (`admin-routes.js`)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/admin` | serve HTML | Yes | Admin dashboard |
| GET | `/api/playlist` | listPlaylist | Yes | Return ordered playlist |
| POST | `/api/playlist` | addVideo | Yes | Add video to playlist |
| PUT | `/api/playlist/:id` | updateVideo | Yes | Update video metadata |
| DELETE | `/api/playlist/:id` | removeVideo | Yes | Remove from playlist |
| PUT | `/api/playlist/reorder` | reorderPlaylist | Yes | Reorder via array of IDs |
| GET | `/api/playback` | getPlaybackState | Yes | Current playback info |

**Auth middleware (`auth.js`):**
Simple password check via header. The password is stored in `ADMIN_PASSWORD` env var.

```
Request header: X-Admin-Password: <password>
If missing or wrong → 401 Unauthorized
```

Why header instead of session: No state to manage, works with simple fetch calls from the admin JS, no cookies needed.

### 2.6 Public Routes (`public-routes.js`)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/player` | serve HTML | No | Embeddable player page |
| GET | `/api/economic` | getEconomicData | No | Current economic strip data |

The `/player` page is designed to be embedded via `<iframe>` on external sites.

---

## 3. Client Architecture

### 3.1 Player Adapter Interface

All video sources implement a common interface so the sync engine and client code are source-agnostic:

```javascript
// PlayerAdapter interface
{
  loadVideo(videoId)          // Load a specific video
  play()                      // Start playback
  pause()                     // Pause playback
  seekTo(seconds)             // Jump to position
  getPosition() → number      // Current playback position in seconds
  getDuration() → number      // Total duration in seconds
  getState() → 'playing'|'paused'|'buffering'|'ended'|'cued'
  setMuted(muted)             // Local mute control only
  destroy()                   // Clean up iframe/listeners
  on(event, callback)         // Event: 'ended', 'stateChange', 'error'
}
```

### 3.2 YouTube Adapter (`player-youtube.js`)

Uses the YouTube IFrame API (`https://www.youtube.com/iframe_api`).

**Key implementation details:**
- Creates an `<iframe>` with `controls=0&modestbranding=1&rel=0&disablekb=1`
- Listens to `onStateChange` events
- Maps YouTube states: `-1→unstarted, 0→ended, 1→playing, 2→paused, 3→buffering, 5→cued`
- `getPosition()` uses `player.getCurrentTime()`
- `seekTo()` uses `player.seekTo(seconds, true)`

**Gotcha**: Age-restricted videos cannot play in embeds. The admin should validate URLs before adding, and the server should handle `error` events by skipping to the next video.

**Gotcha**: Autoplay is blocked unless the user has interacted with the page. The player starts muted and shows a "Click to start" overlay on first load. After the first user click, the overlay disappears and the player follows server commands.

### 3.3 Dailymotion Adapter (`player-dailymotion.js`)

Uses the Dailymotion Player SDK (`https://api.dmcdn.net/all.js`).

**Key implementation details:**
- Creates an iframe via `DM.player()` constructor
- Listens to events: `play`, `pause`, `ended`, `seeked`, `error`
- `getPosition()` uses `player.currentTime`
- `seekTo()` uses `player.seek(time)`
- Embed params: `controls=0&ui-logo=0&ui-highlight=0`

**Gotcha**: Dailymotion requires a Player ID from Dailymotion Studio for full SDK functionality, but basic iframe embed works without it. We use the basic embed approach.

### 3.4 Player Factory (`player-factory.js`)

```javascript
function createPlayer(sourceType, container, videoId) {
  switch (sourceType) {
    case 'youtube':    return new YouTubePlayer(container, videoId);
    case 'dailymotion': return new DailymotionPlayer(container, videoId);
    default: throw new Error(`Unknown source type: ${sourceType}`);
  }
}
```

The factory is called when the client receives `sync:state` with a new video. It destroys the current player instance and creates a new one.

### 3.5 Socket.IO Client Sync Logic (`player.js`)

**Connection flow:**
```
1. Client loads page
2. Connects to Socket.IO server
3. Emits client:ready
4. Receives sync:state { video, position, isPlaying, playlist, timestamp }
5. Calculates clockOffset = serverTimestamp - Date.now()
6. Creates player via factory
7. Loads video, seeks to position, plays/pauses per state
```

**Ongoing sync:**
```
Every 5s: emit client:heartbeat { position: player.getPosition(), timestamp: Date.now() }
On sync:state: update local state, seek if drift > 1s
On playlist:update: refresh playlist display
On video:advance: destroy current player, create new one
On drift:correct: seek to corrected position immediately
On error:video: show error overlay, wait for next video
```

### 3.6 Drift Detection and Correction

**Two-layer approach:**

**Layer 1 — Clock offset calculation (on connect):**
```
Client sends: { timestamp: Date.now() }
Server responds: { serverTime: Date.now() }
Client calculates: offset = serverTime - clientSendTime
All future time comparisons use: adjustedTime = Date.now() + offset
```

**Layer 2 — Position drift check (continuous):**
```
Server loop (every 1s):
  expectedPosition = state.position
  Client heartbeat reports: actualPosition

  drift = |expectedPosition - actualPosition|
  if drift > 1.0:
    emit drift:correct { position: expectedPosition }
    Client seeks immediately
```

**Why both layers**: Clock offset handles the case where client and server clocks differ. Position drift handles the case where the video player itself is lagging (buffering, slow decode, etc.).

### 3.7 Economic Data Strip

**Display design:**
```
┌─────────────────────────────────────────────┐
│  USD: $1.00  │  EUR: €0.92  │  BTC: $67,432 │
└─────────────────────────────────────────────┘
```

A thin horizontal bar below the video player showing 3 currency values with their symbols and current prices. Green/red color coding for 24h change direction.

**Implementation:**
- Server fetches data from a free API every 60 seconds
- Caches the result in memory
- Serves via `GET /api/economic`
- Client polls this endpoint every 60 seconds (independent of Socket.IO)
- Client updates the DOM with new values and a brief flash animation

**Why polling instead of Socket.IO**: Economic data is not time-critical, and polling keeps it decoupled from the sync protocol. If the economic API is slow or down, it doesn't affect video sync.

---

## 4. Database Layer

### 4.1 better-sqlite3 Setup (`db/index.js`)

```javascript
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, '../../data/reproductor.db'));

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations on startup
const migration = fs.readFileSync('./src/db/migrations/001_initial.sql', 'utf8');
db.exec(migration);

module.exports = db;
```

**Why WAL mode**: Allows concurrent readers while a writer is active. Important because the sync engine reads playback state every second while admin operations may write simultaneously.

**Database file location**: `server/data/reproductor.db` — kept outside `src/` so it's not accidentally committed.

### 4.2 Schema (`migrations/001_initial.sql`)

```sql
CREATE TABLE IF NOT EXISTS playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('youtube', 'dailymotion')),
    duration INTEGER NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playback_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),  -- singleton row
    current_video_id INTEGER REFERENCES playlist(id),
    position REAL NOT NULL DEFAULT 0,
    is_playing INTEGER NOT NULL DEFAULT 0,  -- 0 or 1
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for ordered playlist retrieval
CREATE INDEX IF NOT EXISTS idx_playlist_order ON playlist(order_index);
```

**Singleton playback_state**: The `CHECK(id = 1)` constraint ensures only one row exists. This is the current playback state — there's only ever one "now."

### 4.3 Repository Queries

**playlist-repo.js:**
```javascript
// All queries are prepared statements for performance
const queries = {
  getAll: db.prepare('SELECT * FROM playlist ORDER BY order_index ASC'),
  getById: db.prepare('SELECT * FROM playlist WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO playlist (title, source_url, source_type, duration, order_index)
    VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(order_index) + 1 FROM playlist), 0))
  `),
  update: db.prepare(`
    UPDATE playlist SET title = ?, source_url = ?, source_type = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  delete: db.prepare('DELETE FROM playlist WHERE id = ?'),
  reorder: db.prepare('UPDATE playlist SET order_index = ? WHERE id = ?'),
  reorderBatch: db.transaction((items) => {
    // items = [{id, orderIndex}, ...]
    for (const item of items) {
      queries.reorder.run(item.orderIndex, item.id);
    }
  }),
  getFirst: db.prepare('SELECT * FROM playlist ORDER BY order_index ASC LIMIT 1'),
  getNext: db.prepare('SELECT * FROM playlist WHERE order_index > ? ORDER BY order_index ASC LIMIT 1'),
};
```

**playback-repo.js:**
```javascript
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
```

**Persistence strategy**: The sync engine calls `playbackRepo.upsert()` every 5 seconds (not every tick) to avoid excessive disk I/O. On server restart, the engine reads the last saved state and resumes from there.

---

## 5. Sync Protocol Details

### 5.1 Timing Intervals

| Interval | Component | Value | Purpose |
|----------|-----------|-------|---------|
| Leader loop | Server | 1000ms | Advance playback position, check for video end |
| State broadcast | Server | 2000ms | Emit `sync:state` to all clients |
| Heartbeat | Client | 5000ms | Emit `client:heartbeat` with current position |
| Drift check | Server | On heartbeat | Compare expected vs actual position |
| DB persist | Server | 5000ms | Save playback state to SQLite |
| Economic fetch | Server | 60000ms | Refresh currency data |
| Economic poll | Client | 60000ms | Fetch updated economic data |
| Socket.IO ping | Socket.IO | 10000ms | Connection health check |

### 5.2 Server Lead Loop Implementation

```
class SyncEngine {
  constructor(io, playlistRepo, playbackRepo) {
    this.state = {
      currentVideo: null,
      position: 0,
      isPlaying: false,
      startedAt: null,
      lastTick: Date.now(),
      playlist: []
    };
    this.clients = new Map(); // socketId → { lastHeartbeat, reportedPosition }
  }

  start() {
    // Load persisted state
    const saved = this.playbackRepo.get();
    if (saved?.current_video_id) {
      this.state.currentVideo = this.playlistRepo.getById(saved.current_video_id);
      this.state.position = saved.position;
      this.state.isPlaying = saved.is_playing === 1;
    }

    // Load playlist
    this.state.playlist = this.playlistRepo.getAll();

    // Start the leader loop
    this.loopInterval = setInterval(() => this._tick(), 1000);

    // Start state broadcast
    this.broadcastInterval = setInterval(() => this._broadcastState(), 2000);

    // If was playing, resume
    if (this.state.isPlaying && this.state.currentVideo) {
      this.state.startedAt = Date.now() - (this.state.position * 1000);
    }
  }

  _tick() {
    if (!this.state.isPlaying || !this.state.currentVideo) return;

    const now = Date.now();
    const elapsed = (now - this.state.lastTick) / 1000;
    this.state.position += elapsed;
    this.state.lastTick = now;

    // Check if video ended
    if (this.state.position >= this.state.currentVideo.duration) {
      this._advanceVideo();
    }
  }

  _advanceVideo() {
    const next = this.playlistRepo.getNext(this.state.currentVideo.order_index);
    if (next) {
      this.state.currentVideo = next;
    } else {
      // Loop: go back to first video
      this.state.currentVideo = this.playlistRepo.getFirst();
    }

    if (!this.state.currentVideo) {
      this.state.isPlaying = false;
      return;
    }

    this.state.position = 0;
    this.state.startedAt = Date.now();

    // Notify all clients
    this.io.emit('video:advance', {
      video: this.state.currentVideo,
      position: 0,
      timestamp: Date.now()
    });
  }

  _broadcastState() {
    this.io.emit('sync:state', {
      video: this.state.currentVideo,
      position: this.state.position,
      isPlaying: this.state.isPlaying,
      playlist: this.state.playlist,
      timestamp: Date.now()
    });
  }
}
```

### 5.3 Clock Offset Calculation

```
On client connect:
  1. Client emits: client:ready { clientTime: Date.now() }
  2. Server responds: sync:state { ..., serverTime: Date.now() }
  3. Client calculates:
     clockOffset = serverTime - clientTime
     adjustedNow() = Date.now() + clockOffset

  On every heartbeat:
  4. Client sends: client:heartbeat { position: player.getPosition(), clientTime: Date.now() }
  5. Server calculates drift:
     expectedPosition = state.position
     actualPosition = heartbeat.position
     drift = |expectedPosition - actualPosition|
  6. If drift > 1.0:
     Server emits: drift:correct { position: expectedPosition, timestamp: Date.now() }
     Client seeks immediately to position
```

---

## 6. Admin Page Design

### 6.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  🎬 ReproductorPro — Admin                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ Add Video ────────────────────────────────────┐ │
│  │ Title: [________________]                      │ │
│  │ URL:   [________________]                      │ │
│  │ Type:  [YouTube ▼] [Dailymotion]               │ │
│  │ Duration (sec): [____]                         │ │
│  │ [Add to Playlist]                              │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Playlist ─────────────────────────────────────┐ │
│  │ # │ Title        │ Duration │ Actions          │ │
│  │═══│══════════════│══════════│══════════════════│ │
│  │ ☰ │ Video 1      │ 3:42     │ [Edit] [Delete]  │ │
│  │ ☰ │ Video 2      │ 5:10     │ [Edit] [Delete]  │ │
│  │ ☰ │ Video 3      │ 2:55     │ [Edit] [Delete]  │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Playback Status ──────────────────────────────┐ │
│  │ Now Playing: Video 2 @ 1:23 / 5:10             │ │
│  │ Status: ▶ Playing                              │ │
│  │ Connected clients: 3                           │ │
│  │ [⏸ Pause] [▶ Play] [⏭ Skip]                   │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.2 Authentication

- Password stored in `ADMIN_PASSWORD` environment variable
- Admin page shows a login form if not authenticated
- On successful login, the password is stored in `sessionStorage` (not localStorage — cleared on tab close)
- Every API request includes `X-Admin-Password` header
- Server validates on every request (stateless, no sessions to manage)

**Login flow:**
```
1. GET /admin → server checks X-Admin-Password header
2. If missing → return login HTML page
3. User enters password → JS stores in sessionStorage
4. All subsequent fetch() calls include header from sessionStorage
5. If 401 → clear sessionStorage, show login form again
```

### 6.3 Reorder UI

Simple drag-and-drop using the HTML5 Drag and Drop API (no library needed):

- Each row has a drag handle (☰)
- `draggable="true"` on each row
- On `dragstart`: store the row's ID in `dataTransfer`
- On `dragover`: show drop indicator
- On `drop`: reorder the array in memory, send `PUT /api/playlist/reorder` with the new order
- Server persists and broadcasts `playlist:update`

**Fallback**: If drag-and-drop is not supported (some mobile browsers), include up/down arrow buttons on each row.

### 6.4 Admin JS Architecture (`admin.js`)

```
admin.js
├── Auth module — login, logout, header management
├── Playlist module — fetch, render, add, edit, delete, reorder
├── Playback module — fetch status, play/pause/skip controls
├── Socket.IO client — listen for client count updates
└── API helper — fetch wrapper with auth header
```

---

## 7. Economic Data Strip

### 7.1 API Source

**CoinGecko Free API** (`https://api.coingecko.com/api/v3/simple/price`)

```
GET https://api.coingecko.com/api/v3/simple/price
  ?ids=bitcoin
  &vs_currencies=usd,eur
  &include_24hr_change=true
```

**Response:**
```json
{
  "bitcoin": {
    "usd": 67432.15,
    "eur": 61987.43,
    "usd_24h_change": 2.34,
    "eur_24h_change": 1.87
  }
}
```

**Why CoinGecko**: Free tier allows 10-30 calls/minute (more than enough for 60s interval), no API key required for basic endpoint, reliable uptime.

**Rate limit handling**: If the API returns 429 (Too Many Requests), the server keeps serving the last cached value and retries after 120 seconds.

### 7.2 Server-Side Service (`economic-service.js`)

```javascript
class EconomicService {
  constructor() {
    this.cache = null;
    this.lastFetch = 0;
    this.FETCH_INTERVAL = 60000; // 60 seconds
  }

  async fetchData() {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.cache = this._format(data);
      this.lastFetch = Date.now();
    } catch (err) {
      console.error('Economic data fetch failed:', err.message);
      // Keep serving stale cache
    }
  }

  _format(raw) {
    const btc = raw.bitcoin;
    return {
      usd: { value: btc.usd, change: btc.usd_24h_change },
      eur: { value: btc.eur, change: btc.eur_24h_change },
      // Extensible: add more currencies here
      lastUpdated: this.lastFetch
    };
  }

  getData() {
    return this.cache;
  }

  startAutoFetch() {
    this.fetchData(); // initial fetch
    setInterval(() => this.fetchData(), this.FETCH_INTERVAL);
  }
}
```

### 7.3 Client Display (`player.js` — economic strip module)

```javascript
class EconomicStrip {
  constructor(container) {
    this.container = container;
    this.render({ usd: null, eur: null, btc: null });
  }

  async update() {
    const res = await fetch('/api/economic');
    const data = await res.json();
    this.render(data);
  }

  render(data) {
    this.container.innerHTML = `
      <span class="eco-item">
        USD: $${formatNum(data.usd?.value)}
        <span class="change ${changeClass(data.usd?.change)}">${formatChange(data.usd?.change)}</span>
      </span>
      <span class="eco-separator">│</span>
      <span class="eco-item">
        EUR: €${formatNum(data.eur?.value)}
        <span class="change ${changeClass(data.eur?.change)}">${formatChange(data.eur?.change)}</span>
      </span>
      <span class="eco-separator">│</span>
      <span class="eco-item">
        BTC: $${formatNum(data.btc?.value)}
        <span class="change ${changeClass(data.btc?.change)}">${formatChange(data.btc?.change)}</span>
      </span>
    `;
  }
}
```

**Styling**: Dark background, light text, green for positive change, red for negative change. Compact single-line layout.

---

## 8. Security

### 8.1 Admin Authentication

- Password stored as `ADMIN_PASSWORD` in `.env` (never committed)
- Compared using constant-time comparison to prevent timing attacks:
  ```javascript
  const crypto = require('crypto');
  function verifyPassword(input, expected) {
    const inputHash = crypto.createHash('sha256').update(input).digest();
    const expectedHash = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(inputHash, expectedHash);
  }
  ```
- Failed attempts are logged (rate limiting is out of scope for v1, but the log enables manual detection)

### 8.2 CORS Configuration

```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Admin-Password'],
  credentials: false  // No cookies, no credentials needed
}));
```

- `ALLOWED_ORIGINS` is a comma-separated list in `.env`
- The player page (`/player`) can be embedded via iframe on any origin — iframe embedding is not restricted by CORS
- Admin API is restricted to specific origins

### 8.3 Input Validation

All admin POST/PUT requests are validated:

```javascript
// validate.js
function validateVideo(body) {
  const errors = [];
  if (!body.title || typeof body.title !== 'string' || body.title.length > 200) {
    errors.push('Title is required (max 200 chars)');
  }
  if (!body.source_url || !isValidUrl(body.source_url)) {
    errors.push('Valid URL is required');
  }
  if (!['youtube', 'dailymotion'].includes(body.source_type)) {
    errors.push('Source type must be youtube or dailymotion');
  }
  if (!body.duration || typeof body.duration !== 'number' || body.duration <= 0) {
    errors.push('Duration must be a positive number (seconds)');
  }
  return errors;
}
```

- URL validation checks for valid YouTube/Dailymotion URL patterns
- Duration is validated as a positive number
- Title is sanitized (no HTML — stored as plain text, rendered with `textContent`)

### 8.4 Additional Measures

- **SQLite parameterized queries**: All queries use prepared statements — no SQL injection possible
- **No file uploads**: Admin only accepts text data — no upload endpoints
- **Helmet.js** (optional): Can add `helmet()` middleware for security headers (X-Content-Type-Options, X-Frame-Options for admin page only — not player page since it needs to be embeddable)
- **Rate limiting** (future): Can add `express-rate-limit` to admin endpoints if brute-force becomes a concern

---

## 9. Deployment

### 9.1 Oracle Cloud Free ARM Setup

**Instance specs** (Free Tier):
- ARM Ampere A1 Compute: 4 OCPUs, 24 GB RAM (more than enough)
- Ubuntu 22.04 LTS
- 200 GB block storage

**Prerequisites on the server:**
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Clone repo
git clone <repo-url> /opt/reproductor-pro
cd /opt/reproductor-pro/server
npm ci --production
```

### 9.2 Process Management (PM2)

**`deploy/ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'reproductor-pro',
    cwd: '/opt/reproductor-pro/server',
    script: 'src/server.js',
    instances: 1,          // Single instance — SQLite doesn't support multi-process
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      ALLOWED_ORIGINS: 'https://yourdomain.com',
      COINGECKO_URL: 'https://api.coingecko.com/api/v3/simple/price'
    },
    max_memory_restart: '500M',
    error_file: '/var/log/pm2/reproductor-pro-error.log',
    out_file: '/var/log/pm2/reproductor-pro-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

**Start and enable on boot:**
```bash
pm2 start deploy/ecosystem.config.js --env production
pm2 save
pm2 startup  # generates systemd service
```

### 9.3 HTTPS

**Option A — Let's Encrypt with Nginx (recommended):**

```
Internet → :443 → Nginx (SSL termination) → :3000 → Node.js
```

**`deploy/nginx.conf`:**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";  # WebSocket support
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

**Certbot setup:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run  # verify auto-renewal
```

**Option B — Self-signed (development only):**
Not recommended for production, but useful for local testing. The Socket.IO client would need to accept the self-signed cert.

### 9.4 Frontend Embedding (GitHub Pages / Cloudflare Pages)

The player is embeddable via iframe from any site:

```html
<iframe
  src="https://yourdomain.com/player"
  width="800"
  height="500"
  frameborder="0"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>
```

**Important**: The iframe `src` must be HTTPS (required for autoplay in modern browsers). The embedding page can be on any domain — no CORS restriction on iframes.

### 9.5 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | HTTP port |
| `ADMIN_PASSWORD` | **Yes** | — | Admin panel password |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `NODE_ENV` | No | `development` | `production` enables optimizations |
| `DB_PATH` | No | `./data/reproductor.db` | SQLite file path |
| `COINGECKO_URL` | No | (default URL) | Override for economic API |
| `DRIFT_THRESHOLD` | No | 1 | Seconds of drift before correction |
| `BROADCAST_INTERVAL` | No | 2000 | ms between sync:state broadcasts |

---

## Appendix A: Socket.IO Event Reference

### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `sync:state` | `{ video, position, isPlaying, playlist, timestamp }` | Every 2s, and on connect |
| `playlist:update` | `{ playlist }` | When playlist changes |
| `video:advance` | `{ video, position, timestamp }` | When current video ends |
| `drift:correct` | `{ position, timestamp }` | When client drift > threshold |
| `error:video` | `{ message, videoId }` | When video fails to load |

### Client → Server

| Event | Payload | When |
|-------|---------|------|
| `client:ready` | `{ clientTime }` | On page load + Socket.IO connect |
| `client:heartbeat` | `{ position, clientTime }` | Every 5s |
| `client:reconnect` | `{ lastKnownPosition, clientTime }` | On Socket.IO reconnect |

---

## Appendix B: State Machine

```
                    ┌─────────────┐
                    │   IDLE      │ ← No video in playlist
                    └──────┬──────┘
                           │ add video + play
                    ┌──────▼──────┐
              ┌─────│  PLAYING    │─────┐
              │     └──────┬──────┘     │
              │            │ video ends │
              │     ┌──────▼──────┐     │
              │     │  ADVANCING  │     │
              │     └──────┬──────┘     │
              │            │ has next?  │
              │     ┌──────▼──────┐     │
              │  yes│             │no   │
              │     │  PLAYING    │     │
              │     │ (next video)│     │
              │     └─────────────┘     │
              │                         │
              │     ┌─────────────┐     │
              └─────│   PAUSED    │─────┘
                    └─────────────┘
```
