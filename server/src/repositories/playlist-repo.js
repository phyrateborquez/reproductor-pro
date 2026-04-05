const db = require('../db');

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
    for (const item of items) {
      queries.reorder.run(item.orderIndex, item.id);
    }
  }),
  getFirst: db.prepare('SELECT * FROM playlist ORDER BY order_index ASC LIMIT 1'),
  getNext: db.prepare('SELECT * FROM playlist WHERE order_index > ? ORDER BY order_index ASC LIMIT 1'),
  count: db.prepare('SELECT COUNT(*) as count FROM playlist'),
};

module.exports = queries;
