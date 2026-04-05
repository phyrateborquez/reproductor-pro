const playlistRepo = require('../repositories/playlist-repo');
const playbackRepo = require('../repositories/playback-repo');
const config = require('../config');

class SyncEngine {
  constructor(io) {
    this.io = io;
    this.state = {
      currentVideo: null,
      position: 0,
      isPlaying: false,
      startedAt: null,
      lastTick: Date.now(),
      playlist: [],
    };
    this.clients = new Map(); // socketId → { lastHeartbeat, reportedPosition }
    this.loopInterval = null;
    this.broadcastInterval = null;
    this.persistInterval = null;
  }

  start() {
    // Load persisted state
    const saved = playbackRepo.get();
    if (saved?.current_video_id) {
      this.state.currentVideo = playlistRepo.getById.get(saved.current_video_id);
      this.state.position = saved.position;
      this.state.isPlaying = saved.is_playing === 1;
    }

    // Load playlist
    this.state.playlist = playlistRepo.getAll.all();

    // Start the leader loop
    this.loopInterval = setInterval(() => this._tick(), 1000);

    // Start state broadcast
    this.broadcastInterval = setInterval(
      () => this._broadcastState(),
      config.broadcastInterval
    );

    // Persist playback state every 5 seconds
    this.persistInterval = setInterval(() => this._persistState(), 5000);

    // If was playing, resume
    if (this.state.isPlaying && this.state.currentVideo) {
      this.state.startedAt = Date.now() - this.state.position * 1000;
    }

    console.log('[sync] Engine started', {
      video: this.state.currentVideo?.title || 'none',
      position: this.state.position,
      isPlaying: this.state.isPlaying,
      playlistSize: this.state.playlist.length,
    });
  }

  stop() {
    if (this.loopInterval) clearInterval(this.loopInterval);
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    if (this.persistInterval) clearInterval(this.persistInterval);
    this._persistState(); // final save
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
    const next = playlistRepo.getNext.get(this.state.currentVideo.order_index);
    if (next) {
      this.state.currentVideo = next;
    } else {
      // Loop: go back to first video
      this.state.currentVideo = playlistRepo.getFirst.get();
    }

    if (!this.state.currentVideo) {
      this.state.isPlaying = false;
      this._persistState();
      return;
    }

    this.state.position = 0;
    this.state.startedAt = Date.now();

    // Notify all clients
    this.io.emit('video:advance', {
      video: this.state.currentVideo,
      position: 0,
      timestamp: Date.now(),
    });

    this._persistState();
  }

  _broadcastState() {
    this.io.emit('sync:state', {
      video: this.state.currentVideo,
      position: this.state.position,
      isPlaying: this.state.isPlaying,
      playlist: this.state.playlist,
      timestamp: Date.now(),
    });
  }

  _persistState() {
    playbackRepo.upsert.run(
      1,
      this.state.currentVideo?.id || null,
      this.state.position,
      this.state.isPlaying ? 1 : 0
    );
  }

  updatePlaylist() {
    this.state.playlist = playlistRepo.getAll.all();
    this.io.emit('playlist:update', { playlist: this.state.playlist });
  }

  play() {
    if (!this.state.currentVideo) {
      const first = playlistRepo.getFirst.get();
      if (!first) return false;
      this.state.currentVideo = first;
      this.state.position = 0;
    }
    this.state.isPlaying = true;
    this.state.startedAt = Date.now();
    this.state.lastTick = Date.now();
    this._broadcastState();
    this._persistState();
    return true;
  }

  pause() {
    this.state.isPlaying = false;
    this._broadcastState();
    this._persistState();
  }

  skip() {
    if (!this.state.currentVideo) return;
    this._advanceVideo();
  }

  seekTo(position) {
    this.state.position = Math.max(0, position);
    this.state.lastTick = Date.now();
    this._broadcastState();
    this._persistState();
  }

  addClient(socketId) {
    this.clients.set(socketId, {
      lastHeartbeat: Date.now(),
      reportedPosition: 0,
    });
  }

  removeClient(socketId) {
    this.clients.delete(socketId);
  }

  handleHeartbeat(socketId, position) {
    const client = this.clients.get(socketId);
    if (!client) return;

    client.lastHeartbeat = Date.now();
    client.reportedPosition = position;

    const expectedPosition = this.state.position;
    const drift = Math.abs(expectedPosition - position);

    if (drift > config.driftThreshold) {
      this.io.to(socketId).emit('drift:correct', {
        position: expectedPosition,
        timestamp: Date.now(),
      });
    }
  }

  getClientCount() {
    return this.clients.size;
  }

  getState() {
    return {
      video: this.state.currentVideo,
      position: this.state.position,
      isPlaying: this.state.isPlaying,
      playlist: this.state.playlist,
      clients: this.getClientCount(),
    };
  }
}

module.exports = SyncEngine;
