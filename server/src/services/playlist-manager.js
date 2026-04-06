const playlistRepo = require('../repositories/playlist-repo');

class PlaylistManager {
  constructor(syncEngine) {
    this.syncEngine = syncEngine;
  }

  async addVideo(title, sourceUrl, sourceType, duration) {
    const video = playlistRepo.insert(title, sourceUrl, sourceType, duration);
    // Update sync engine playlist
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
    return video;
  }

  async updateVideo(id, updates) {
    const existing = playlistRepo.getById(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    const video = playlistRepo.update(
      id,
      updates.title || existing.title,
      updates.source_url || existing.source_url,
      updates.source_type || existing.source_type,
      updates.duration || existing.duration
    );
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
    return video;
  }

  async removeVideo(id) {
    const existing = playlistRepo.getById(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    playlistRepo.delete(id);
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
  }

  async reorderVideo(id, newOrderIndex) {
    const existing = playlistRepo.getById(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    playlistRepo.reorder(id, newOrderIndex);
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
  }

  async reorderPlaylist(orderArray) {
    // orderArray = [{id, orderIndex}, ...]
    const items = orderArray.map((item, index) => ({
      id: item.id,
      orderIndex: item.orderIndex ?? index,
    }));
    playlistRepo.reorderBatch(items);
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
  }

  getPlaylist() {
    return playlistRepo.getAll();
  }

  getNextVideo(currentOrderIndex) {
    return playlistRepo.getNext(currentOrderIndex);
  }

  getFirstVideo() {
    return playlistRepo.getFirst();
  }
}

module.exports = PlaylistManager;
