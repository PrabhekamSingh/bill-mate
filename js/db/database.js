/**
 * Database Wrapper
 * sql.js (WASM) + IndexedDB persistence layer
 */

import { SCHEMA_SQL, SEED_SQL, SCHEMA_VERSION } from './schema.js';
import { supabaseService } from './supabase.js';

const DB_NAME = 'billing_app_db';
const DB_STORE = 'sqlite_db';
const DB_KEY = 'main';

// CDN base for sql.js WASM
const SQLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';

class Database {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the database — load sql.js, restore from IndexedDB or create new
   */
  async init() {
    if (this.initialized) return this.db;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    try {
      this.SQL = await this._loadSqlJs();

      const savedDb = await this._loadFromIndexedDB();
      if (savedDb) {
        this.db = new this.SQL.Database(savedDb);
        console.log('[DB] Restored from IndexedDB');
        // Run any pending migrations
        await this._verifySchema();
      } else {
        this.db = new this.SQL.Database();
        this._executeSchema();
        console.log('[DB] New database created');
      }

      this.initialized = true;
      return this.db;
    } catch (error) {
      console.error('[DB] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load sql.js from CDN using initSqlJs
   */
  _loadSqlJs() {
    return new Promise((resolve, reject) => {
      // Already loaded
      if (window.initSqlJs) {
        window.initSqlJs({
          locateFile: (file) => `${SQLJS_CDN}${file}`
        }).then(resolve).catch(reject);
        return;
      }

      const script = document.createElement('script');
      script.src = `${SQLJS_CDN}sql-wasm.js`;
      script.onload = () => {
        window.initSqlJs({
          locateFile: (file) => `${SQLJS_CDN}${file}`
        }).then(resolve).catch(reject);
      };
      script.onerror = () => reject(new Error('Failed to load sql.js from CDN'));
      document.head.appendChild(script);
    });
  }

  /**
   * Execute schema SQL on a fresh database
   */
  _executeSchema() {
    this.db.exec(SCHEMA_SQL);
    this.db.exec(SEED_SQL);
    this.save();
  }

  /**
   * Verify schema version and run migrations if needed
   */
  async _verifySchema() {
    try {
      // Ensure all tables exist (SCHEMA_SQL uses CREATE TABLE IF NOT EXISTS)
      this.db.exec(SCHEMA_SQL);
      this.db.exec(SEED_SQL);

      // Ensure city column exists in customers table
      try {
        const custCols = this.all("PRAGMA table_info(customers)");
        if (!custCols.some(c => c.name === 'city')) {
          this.db.exec("ALTER TABLE customers ADD COLUMN city TEXT");
        }

        // Ensure stock_quantity, min_stock, location exist in items table
        const itemCols = this.all("PRAGMA table_info(items)");
        if (!itemCols.some(c => c.name === 'stock_quantity')) {
          this.db.exec("ALTER TABLE items ADD COLUMN stock_quantity REAL DEFAULT 0");
        }
        if (!itemCols.some(c => c.name === 'min_stock')) {
          this.db.exec("ALTER TABLE items ADD COLUMN min_stock REAL DEFAULT 5");
        }
        if (!itemCols.some(c => c.name === 'location')) {
          this.db.exec("ALTER TABLE items ADD COLUMN location TEXT DEFAULT ''");
        }

        // Ensure stock_quantity, min_stock, location exist in catalog_items table
        const catCols = this.all("PRAGMA table_info(catalog_items)");
        if (!catCols.some(c => c.name === 'stock_quantity')) {
          this.db.exec("ALTER TABLE catalog_items ADD COLUMN stock_quantity REAL DEFAULT 10");
        }
        if (!catCols.some(c => c.name === 'min_stock')) {
          this.db.exec("ALTER TABLE catalog_items ADD COLUMN min_stock REAL DEFAULT 5");
        }
        if (!catCols.some(c => c.name === 'location')) {
          this.db.exec("ALTER TABLE catalog_items ADD COLUMN location TEXT DEFAULT ''");
        }
      } catch (colErr) {
        console.warn('[DB] Migration check failed:', colErr);
      }

      const result = this.db.exec('SELECT version FROM schema_version LIMIT 1');
      if (result.length > 0 && result[0].values.length > 0) {
        const currentVersion = result[0].values[0][0];
        if (currentVersion < SCHEMA_VERSION) {
          this.db.run(`UPDATE schema_version SET version = ${SCHEMA_VERSION}`);
          this.save();
        }
      } else {
        this.db.exec(`INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION})`);
        this.save();
      }
    } catch (e) {
      console.warn('[DB] Schema verify error:', e);
      try {
        this._executeSchema();
      } catch (e2) {
        console.error('[DB] Schema fallback exec error:', e2);
      }
    }
  }

  /**
   * Load database binary from IndexedDB
   */
  _loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(DB_STORE)) {
          idb.createObjectStore(DB_STORE);
        }
      };

      request.onsuccess = (event) => {
        const idb = event.target.result;
        const tx = idb.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const getRequest = store.get(DB_KEY);

        getRequest.onsuccess = () => {
          idb.close();
          const res = getRequest.result;
          if (!res) {
            resolve(null);
            return;
          }
          const u8 = res instanceof Uint8Array ? res : new Uint8Array(res);
          console.log(`[DB] Restored ${u8.length} bytes from IndexedDB`);
          resolve(u8);
        };

        getRequest.onerror = () => {
          idb.close();
          reject(getRequest.error);
        };
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save current database to IndexedDB
   */
  save() {
    if (!this.db) return Promise.resolve();

    // Trigger async cloud sync to Supabase if configured
    if (supabaseService.isConfigured()) {
      supabaseService.syncAllLocalToSupabase(this).catch(err => console.warn('[Supabase] Sync background error:', err));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(DB_STORE)) {
          idb.createObjectStore(DB_STORE);
        }
      };

      request.onsuccess = (event) => {
        const idb = event.target.result;
        const tx = idb.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);

        const data = this.db.export(); // returns Uint8Array
        // Slice the buffer to ensure exact byte length is saved
        const bufferToSave = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const putRequest = store.put(bufferToSave, DB_KEY);

        putRequest.onsuccess = () => {
          idb.close();
          console.log(`[DB] Saved ${data.byteLength} bytes to IndexedDB`);
          resolve();
        };
        putRequest.onerror = () => {
          idb.close();
          console.error('[DB] Failed to save to IndexedDB:', putRequest.error);
          reject(putRequest.error);
        };
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Execute raw SQL and return results array
   */
  exec(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.exec(sql, params);
  }

  /**
   * Run a statement (INSERT/UPDATE/DELETE), returns { changes, lastInsertRowid }
   * Automatically persists to IndexedDB after mutation
   */
  run(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    const result = {
      changes: this.db.getRowsModified(),
      lastInsertRowid: this.db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] ?? null
    };
    const cleanSql = sql.trim().replace(/\s+/g, ' ').slice(0, 80);
    console.log(`[SQL EXEC] ${cleanSql}${params.length ? ' | Params: ' + JSON.stringify(params) : ''} -> (Modified: ${result.changes})`);
    this.save().catch(err => console.error('[DB] Auto-save error:', err));
    return result;
  }

  /**
   * Get a single row as object
   */
  get(sql, params = []) {
    const result = this.exec(sql, params);
    if (!result.length || !result[0].values.length) return null;
    const { columns, values } = result[0];
    return columns.reduce((obj, col, i) => { obj[col] = values[0][i]; return obj; }, {});
  }

  /**
   * Get all rows as array of objects
   */
  all(sql, params = []) {
    const result = this.exec(sql, params);
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => columns.reduce((obj, col, i) => { obj[col] = row[i]; return obj; }, {}));
  }

  /**
   * Execute a function inside a transaction
   */
  transaction(fn) {
    if (!this.db) throw new Error('Database not initialized');
    console.log('[DB TRANSACTION] BEGIN TRANSACTION');
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = fn(this);
      this.db.run('COMMIT');
      console.log('[DB TRANSACTION] COMMIT TRANSACTION');
      this.save();
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      console.error('[DB TRANSACTION] ROLLBACK TRANSACTION:', e.message);
      throw e;
    }
  }

  /**
   * Export all data as JSON object
   */
  exportToJson() {
    if (!this.db) return null;
    const tables = ['customers', 'items', 'bills', 'bill_items', 'payments'];
    const data = {};
    for (const table of tables) {
      data[table] = this.all(`SELECT * FROM ${table}`);
    }
    return {
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  /**
   * Import all data from a JSON backup
   */
  importFromJson(jsonData) {
    if (!this.db) throw new Error('Database not initialized');
    this.transaction((db) => {
      db.run('DELETE FROM bill_items');
      db.run('DELETE FROM payments');
      db.run('DELETE FROM bills');
      db.run('DELETE FROM items');
      db.run('DELETE FROM customers');

      const { data } = jsonData;

      (data.customers || []).forEach(r => {
        db.run(
          `INSERT INTO customers (id, name, phone, email, address, city, opening_balance, created_at) VALUES (?,?,?,?,?,?,?,?)`,
          [r.id, r.name, r.phone, r.email, r.address, r.city || null, r.opening_balance, r.created_at]
        );
      });

      (data.items || []).forEach(r => {
        db.run(
          `INSERT INTO items (id, customer_id, name, unit, rate, gst_rate, created_at) VALUES (?,?,?,?,?,?,?)`,
          [r.id, r.customer_id, r.name, r.unit, r.rate, r.gst_rate, r.created_at]
        );
      });

      (data.bills || []).forEach(r => {
        db.run(
          `INSERT INTO bills (id, customer_id, bill_number, bill_date, subtotal, gst_total, total, carry_forward, paid, balance, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.id, r.customer_id, r.bill_number, r.bill_date, r.subtotal, r.gst_total, r.total, r.carry_forward, r.paid, r.balance, r.notes, r.created_at]
        );
      });

      (data.bill_items || []).forEach(r => {
        db.run(
          `INSERT INTO bill_items (id, bill_id, item_id, description, quantity, rate, gst_rate, amount, gst_amount) VALUES (?,?,?,?,?,?,?,?,?)`,
          [r.id, r.bill_id, r.item_id, r.description, r.quantity, r.rate, r.gst_rate, r.amount, r.gst_amount]
        );
      });

      (data.payments || []).forEach(r => {
        db.run(
          `INSERT INTO payments (id, customer_id, bill_id, amount, payment_date, mode, reference, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
          [r.id, r.customer_id, r.bill_id, r.amount, r.payment_date, r.mode, r.reference, r.notes, r.created_at]
        );
      });
    });
  }

  /**
   * Clear all data
   */
  clearAll() {
    if (!this.db) return;
    this.transaction((db) => {
      db.run('DELETE FROM bill_items');
      db.run('DELETE FROM payments');
      db.run('DELETE FROM bills');
      db.run('DELETE FROM items');
      db.run('DELETE FROM customers');
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      this.initPromise = null;
    }
  }
}

export const db = new Database();