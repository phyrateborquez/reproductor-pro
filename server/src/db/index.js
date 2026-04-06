const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load sql.js (WebAssembly)
const SQL = require('sql.js');

// Database instance
let db = null;

// Initialize database asynchronously
async function initDatabase() {
  // Initialize SQL.js
  const sqlPromise = initSqlJs();
  const SQL = await sqlPromise;
  
  // Load existing database if it exists, otherwise create new one
  let dbData = null;
  if (fs.existsSync(config.dbPath)) {
    dbData = fs.readFileSync(config.dbPath);
  }
  
  if (dbData) {
    db = new SQL.Database(dbData);
  } else {
    db = new SQL.Database();
  }
  
  // Run migrations
  const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  db.run(migration);
  
  // Save to persist schema
  saveDatabase();
  
  return db;
}

// Save database to file (call after any write operation)
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  }
}

// Get database instance
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Helper for synchronous prepare (wraps sql.js sync API)
function prepare(sql) {
  return db.prepare(sql);
}

// Helper for running queries with params
function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase(); // Persist changes
}

// Helper for getting single row
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Helper for getting all rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = {
  initDatabase,
  getDb,
  prepare,
  run,
  get,
  all,
  saveDatabase
};
