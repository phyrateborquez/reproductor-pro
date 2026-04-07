const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Cliente de Turso (libSQL) — se inicializa una sola vez
let client = null;

/**
 * Inicializa la conexión al cliente libSQL.
 * En producción usa Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
 * En desarrollo usa un archivo SQLite local como fallback.
 */
async function initDatabase() {
  if (config.tursoUrl && config.tursoAuthToken) {
    // Modo producción: Turso en la nube
    client = createClient({
      url: config.tursoUrl,
      authToken: config.tursoAuthToken,
    });
    console.log('[db] Conectado a Turso (remoto)');
  } else {
    // Modo desarrollo: SQLite local via libSQL (mismo driver, sin red)
    const dataDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    client = createClient({ url: `file:${config.dbPath}` });
    console.log('[db] Conectado a SQLite local:', config.dbPath);
  }

  // Ejecutar migración inicial (CREATE TABLE IF NOT EXISTS — idempotente)
  const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  // Turso ejecuta scripts multi-statement como transacción con executeMultiple
  await client.executeMultiple(migration);

  console.log('[db] Migraciones aplicadas correctamente');
  return client;
}

// Obtener el cliente (falla si no fue inicializado)
function getDb() {
  if (!client) {
    throw new Error('Base de datos no inicializada. Llama a initDatabase() primero.');
  }
  return client;
}

/**
 * Ejecuta una query de escritura (INSERT, UPDATE, DELETE).
 * @returns {ResultSet} resultado con lastInsertRowid, rowsAffected
 */
async function run(sql, params = []) {
  return client.execute({ sql, args: params });
}

/**
 * Obtiene la primera fila del resultado, o null si no hay resultados.
 */
async function get(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Obtiene todas las filas del resultado.
 */
async function all(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows;
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all,
};
