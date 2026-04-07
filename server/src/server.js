const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const db = require('./db');
const SyncEngine = require('./services/sync-engine');
const PlaylistManager = require('./services/playlist-manager');
const economicService = require('./services/economic-service');
const createApp = require('./app');
const createSocketHandlers = require('./sockets/socket-handler');

// Validate required config
if (!config.adminPassword) {
  console.error('ERROR: ADMIN_PASSWORD environment variable is required');
  process.exit(1);
}

async function start() {
  // Initialize database (async for libSQL/Turso)
  console.log('[db] Initializing database...');
  await db.initDatabase();
  console.log('[db] Database initialized');

  // Create HTTP server first
  const server = http.createServer();

  // Attach Socket.IO first (so we can pass it to syncEngine)
  const io = new Server(server, {
    cors: {
      origin: config.allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  // Create services
  const syncEngine = new SyncEngine(io);
  const playlistManager = new PlaylistManager(syncEngine);
  const app = createApp(syncEngine, playlistManager);

  // Wire socket handlers
  createSocketHandlers(io, syncEngine);

  // Start sync engine (now async)
  await syncEngine.start();

  // Start economic data auto-fetch
  economicService.startAutoFetch();

  // Attach Express to HTTP server
  server.on('request', app);

  // Start listening
  server.listen(config.port, () => {
    console.log(`[server] Listening on port ${config.port} (${config.nodeEnv})`);
    console.log(`[server] Admin: http://localhost:${config.port}/admin`);
    console.log(`[server] Player: http://localhost:${config.port}/player`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received, shutting down...');
    syncEngine.stop();
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[server] SIGINT received, shutting down...');
    syncEngine.stop();
    server.close(() => {
      process.exit(0);
    });
  });
}

start().catch(err => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

module.exports = { };
