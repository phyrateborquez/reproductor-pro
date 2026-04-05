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

// Create Express app
const syncEngine = new SyncEngine();
const playlistManager = new PlaylistManager(syncEngine);
const app = createApp(syncEngine, playlistManager);

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
});

// Wire socket handlers
createSocketHandlers(io, syncEngine);

// Start sync engine
syncEngine.start();

// Start economic data auto-fetch
economicService.startAutoFetch();

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
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down...');
  syncEngine.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

module.exports = { app, server, io, syncEngine };
