const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ====== مسار قاعدة البيانات ======
let dbPath;
if (process.env.NODE_ENV === 'production' && fs.existsSync('/data')) {
  dbPath = '/data/chat.db';
} else {
  dbPath = path.join(__dirname, 'chat.db');
}

console.log('📁 Database path:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ====== إنشاء الجداول ======
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT,
    user1_id INTEGER,
    user2_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    expires_at DATETIME,
    expire_duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    ip TEXT,
    user_agent TEXT,
    action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS banned_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ====== الغرفة العامة الافتراضية ======
const publicRoom = db.prepare(`SELECT id FROM conversations WHERE type='public' LIMIT 1`).get();
if (!publicRoom) {
  db.prepare(`INSERT INTO conversations (type, name) VALUES ('public', 'الغرفة العامة')`).run();
}

// ====== واجهة متوافقة مع sqlite3 ======
const wrapper = {
  get(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    if (!Array.isArray(params)) params = params == null ? [] : [params];

    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params);
      if (cb) cb(null, row);
      return row;
    } catch (e) {
      if (cb) cb(e);
      else throw e;
    }
  },

  all(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    if (!Array.isArray(params)) params = params == null ? [] : [params];

    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      if (cb) cb(null, rows);
      return rows;
    } catch (e) {
      if (cb) cb(e);
      else throw e;
    }
  },

  run(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    if (!Array.isArray(params)) params = params == null ? [] : [params];

    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      const ctx = { lastID: result.lastInsertRowid, changes: result.changes };
      if (cb) cb.call(ctx, null);
      return result;
    } catch (e) {
      if (cb) cb.call(null, e);
      else throw e;
    }
  },

  raw: db
};

module.exports = wrapper;
