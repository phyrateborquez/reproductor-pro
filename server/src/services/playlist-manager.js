const playlistRepo = require('../repositories/playlist-repo');

class PlaylistManager {
  constructor(syncEngine) {
    this.syncEngine = syncEngine;
  }

  async addVideo(title, sourceUrl, sourceType, duration) {
    const result = playlistRepo.insert.run(title, sourceUrl, sourceType, duration);
    const video = playlistRepo.getById.get(result.lastInsertRowid);
    // Update sync engine playlist
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
    return video;
  }

  async updateVideo(id, updates) {
    const existing = playlistRepo.getById.get(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    playlistRepo.update.run(
      updates.title || existing.title,
      updates.source_url || existing.source_url,
      updates.source_type || existing.source_type,
      updates.duration || existing.duration,
      id
    );
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
    return playlistRepo.getById.get(id);
  }

  async removeVideo(id) {
    const existing = playlistRepo.getById.get(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    playlistRepo.delete.run(id);
    if (this.syncEngine) {
      this.syncEngine.updatePlaylist();
    }
  }

  async reorderVideo(id, newOrderIndex) {
    const existing = playlistRepo.getById.get(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    playlistRepo.reorder.run(newOrderIndex, id);
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
    return playlistRepo.getAll.all();
  }

  getNextVideo(currentOrderIndex) {
    return playlistRepo.getNext.get(currentOrderIndex);
  }

  getFirstVideo() {
    return playlistRepo.getFirst.get();
  }
}

module.exports = PlaylistManager;
