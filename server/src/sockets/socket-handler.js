const ClientRegistry = require('./client-registry');

function createSocketHandlers(io, syncEngine) {
  const registry = new ClientRegistry();

  io.on('connection', (socket) => {
    console.log(`[socket] Client connected: ${socket.id} (total: ${registry.getCount() + 1})`);

    // Register client
    registry.register(socket.id);
    syncEngine.addClient(socket.id);

    // Send current state immediately
    socket.emit('sync:state', {
      video: syncEngine.state.currentVideo,
      position: syncEngine.state.position,
      isPlaying: syncEngine.state.isPlaying,
      playlist: syncEngine.state.playlist,
      timestamp: Date.now(),
    });

    // Handle client ready
    socket.on('client:ready', (data) => {
      console.log(`[socket] Client ready: ${socket.id}`);
      io.emit('client:count', { count: registry.getCount() });
    });

    // Handle client heartbeat
    socket.on('client:heartbeat', (data) => {
      registry.updateHeartbeat(socket.id, data.position);
      syncEngine.handleHeartbeat(socket.id, data.position);
    });

    // Handle client reconnect
    socket.on('client:reconnect', (data) => {
      console.log(`[socket] Client reconnected: ${socket.id}, last known position: ${data.lastKnownPosition}`);
      syncEngine.handleHeartbeat(socket.id, data.lastKnownPosition);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      registry.unregister(socket.id);
      syncEngine.removeClient(socket.id);
      console.log(`[socket] Client disconnected: ${socket.id} (total: ${registry.getCount()})`);
      io.emit('client:count', { count: registry.getCount() });
    });
  });

  // Expose client count for API
  return {
    getClientCount: () => registry.getCount(),
  };
}

module.exports = createSocketHandlers;
