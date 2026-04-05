class ClientRegistry {
  constructor() {
    this.clients = new Map(); // socketId → { connectedAt, lastHeartbeat, reportedPosition }
  }

  register(socketId) {
    this.clients.set(socketId, {
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      reportedPosition: 0,
    });
  }

  unregister(socketId) {
    this.clients.delete(socketId);
  }

  updateHeartbeat(socketId, position) {
    const client = this.clients.get(socketId);
    if (client) {
      client.lastHeartbeat = Date.now();
      client.reportedPosition = position;
    }
  }

  getCount() {
    return this.clients.size;
  }

  getInfo() {
    return Array.from(this.clients.entries()).map(([id, info]) => ({
      socketId: id,
      ...info,
    }));
  }
}

module.exports = ClientRegistry;
