const Database = require("better-sqlite3");
const path = require("path");

// Singleton — one connection shared across the entire application
// Node.js module caching ensures this file is only executed once
const db = new Database(path.join(__dirname, "../expenses.db"));

// WAL mode allows reads and writes to happen simultaneously
// Default journal mode blocks reads during writes
db.pragma("journal_mode = WAL");

// Create the expenses table if it does not already exist
// Running this on every startup is safe — CREATE TABLE IF NOT EXISTS is idempotent
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id                TEXT PRIMARY KEY,
    amount            INTEGER NOT NULL CHECK(amount > 0),
    category          TEXT NOT NULL,
    description       TEXT NOT NULL,
    date              TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    idempotency_key   TEXT UNIQUE
  );
`);

module.exports = db;