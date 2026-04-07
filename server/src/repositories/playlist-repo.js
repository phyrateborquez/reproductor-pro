const db = require('../db');

const queries = {
  getAll: () => db.all('SELECT * FROM playlist ORDER BY order_index ASC'),

  getById: (id) => db.get('SELECT * FROM playlist WHERE id = ?', [id]),

  insert: async (title, sourceUrl, sourceType, duration) => {
    // Obtener el máximo order_index actual
    const maxOrder = await db.get('SELECT MAX(order_index) as max FROM playlist');
    const orderIndex = (maxOrder && maxOrder.max !== null) ? Number(maxOrder.max) + 1 : 0;

    const result = await db.run(
      'INSERT INTO playlist (title, source_url, source_type, duration, order_index) VALUES (?, ?, ?, ?, ?)',
      [title, sourceUrl, sourceType, duration, orderIndex]
    );

    // Obtener el registro insertado usando lastInsertRowid
    return db.get('SELECT * FROM playlist WHERE id = ?', [Number(result.lastInsertRowid)]);
  },

  update: async (id, title, sourceUrl, sourceType, duration) => {
    await db.run(
      'UPDATE playlist SET title = ?, source_url = ?, source_type = ?, duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, sourceUrl, sourceType, duration, id]
    );
    return db.get('SELECT * FROM playlist WHERE id = ?', [id]);
  },

  delete: (id) => db.run('DELETE FROM playlist WHERE id = ?', [id]),

  reorder: (id, orderIndex) =>
    db.run('UPDATE playlist SET order_index = ? WHERE id = ?', [orderIndex, id]),

  reorderBatch: async (items) => {
    for (const item of items) {
      await db.run('UPDATE playlist SET order_index = ? WHERE id = ?', [item.orderIndex, item.id]);
    }
  },

  getFirst: () => db.get('SELECT * FROM playlist ORDER BY order_index ASC LIMIT 1'),

  getNext: (currentOrderIndex) =>
    db.get(
      'SELECT * FROM playlist WHERE order_index > ? ORDER BY order_index ASC LIMIT 1',
      [currentOrderIndex]
    ),

  count: async () => {
    const result = await db.get('SELECT COUNT(*) as count FROM playlist');
    return result ? Number(result.count) : 0;
  },
};

module.exports = queries;
