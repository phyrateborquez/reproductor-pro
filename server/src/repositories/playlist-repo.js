const db = require('../db');

const queries = {
  getAll: () => db.all('SELECT * FROM playlist ORDER BY order_index ASC'),
  
  getById: (id) => db.get('SELECT * FROM playlist WHERE id = ?', [id]),
  
  insert: (title, sourceUrl, sourceType, duration) => {
    // Get max order_index first
    const maxOrder = db.get('SELECT MAX(order_index) as max FROM playlist');
    const orderIndex = (maxOrder && maxOrder.max !== null) ? maxOrder.max + 1 : 0;
    
    db.run(
      'INSERT INTO playlist (title, source_url, source_type, duration, order_index) VALUES (?, ?, ?, ?, ?)',
      [title, sourceUrl, sourceType, duration, orderIndex]
    );
    return db.get('SELECT * FROM playlist WHERE id = last_insert_rowid()');
  },
  
  update: (id, title, sourceUrl, sourceType, duration) => {
    db.run(
      'UPDATE playlist SET title = ?, source_url = ?, source_type = ?, duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, sourceUrl, sourceType, duration, id]
    );
    return db.get('SELECT * FROM playlist WHERE id = ?', [id]);
  },
  
  delete: (id) => {
    db.run('DELETE FROM playlist WHERE id = ?', [id]);
  },
  
  reorder: (id, orderIndex) => {
    db.run('UPDATE playlist SET order_index = ? WHERE id = ?', [orderIndex, id]);
  },
  
  reorderBatch: (items) => {
    for (const item of items) {
      db.run('UPDATE playlist SET order_index = ? WHERE id = ?', [item.orderIndex, item.id]);
    }
    db.saveDatabase();
  },
  
  getFirst: () => db.get('SELECT * FROM playlist ORDER BY order_index ASC LIMIT 1'),
  
  getNext: (currentOrderIndex) => db.get('SELECT * FROM playlist WHERE order_index > ? ORDER BY order_index ASC LIMIT 1', [currentOrderIndex]),
  
  count: () => {
    const result = db.get('SELECT COUNT(*) as count FROM playlist');
    return result ? result.count : 0;
  },
};

module.exports = queries;
