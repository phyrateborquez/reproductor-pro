const playlistRepo = require('../repositories/playlist-repo');

class PlaylistManager {
  constructor(syncEngine) {
    this.syncEngine = syncEngine;
  }

  async addVideo(title, sourceUrl, sourceType, duration) {
    const video = await playlistRepo.insert(title, sourceUrl, sourceType, duration);
    // Update sync engine playlist
    if (this.syncEngine) {
      await this.syncEngine.updatePlaylist();
    }
    return video;
  }

  async updateVideo(id, updates) {
    const existing = await playlistRepo.getById(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    const video = await playlistRepo.update(
      id,
      updates.title || existing.title,
      updates.source_url || existing.source_url,
      updates.source_type || existing.source_type,
      updates.duration || existing.duration
    );
    if (this.syncEngine) {
      await this.syncEngine.updatePlaylist();
    }
    return video;
  }

  async removeVideo(id) {
    const existing = await playlistRepo.getById(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    await playlistRepo.delete(id);
    if (this.syncEngine) {
      await this.syncEngine.updatePlaylist();
    }
  }

  async reorderVideo(id, newOrderIndex) {
    const existing = await playlistRepo.getById(id);
    if (!existing) {
      throw new Error('Video not found');
    }
    await playlistRepo.reorder(id, newOrderIndex);
    if (this.syncEngine) {
      await this.syncEngine.updatePlaylist();
    }
  }

  async reorderPlaylist(orderArray) {
    // orderArray = [{id, orderIndex}, ...]
    const items = orderArray.map((item, index) => ({
      id: item.id,
      orderIndex: item.orderIndex ?? index,
    }));
    await playlistRepo.reorderBatch(items);
    if (this.syncEngine) {
      await this.syncEngine.updatePlaylist();
    }
  }

  async getPlaylist() {
    return await playlistRepo.getAll();
  }

  async getNextVideo(currentOrderIndex) {
    return await playlistRepo.getNext(currentOrderIndex);
  }

  async getFirstVideo() {
    return await playlistRepo.getFirst();
  }
}

module.exports = PlaylistManager;
