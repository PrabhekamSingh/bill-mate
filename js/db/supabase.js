/**
 * Supabase Database Sync Module
 * Additive cloud persistence alongside local IndexedDB & CSV
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from '../config.js';

const STORAGE_KEY = 'supabase_config';

class SupabaseService {
  constructor() {
    this.client = null;
    this.config = this._loadConfig();
    if (this.config.url && this.config.key && this.config.enabled) {
      this._initClient();
    }
  }

  _loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url || parsed.key) return parsed;
      }
    } catch (e) {
      console.warn('[Supabase] Failed to load config:', e);
    }
    // Fallback to js/config.js
    return {
      url: CONFIG.SUPABASE_URL || '',
      key: CONFIG.SUPABASE_ANON_KEY || '',
      enabled: CONFIG.SUPABASE_ENABLED ?? false
    };
  }

  saveConfig(url, key, enabled = true) {
    this.config = { url: url.trim(), key: key.trim(), enabled: !!enabled };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error('[Supabase] Failed to save config:', e);
    }
    if (this.config.url && this.config.key && this.config.enabled) {
      this._initClient();
    } else {
      this.client = null;
    }
    return this.isConfigured();
  }

  _initClient() {
    try {
      this.client = createClient(this.config.url, this.config.key);
      console.log('[Supabase] Client initialized successfully');
    } catch (e) {
      console.error('[Supabase] Client initialization failed:', e);
      this.client = null;
    }
  }

  isConfigured() {
    if (!this.client || !this.config.url || !this.config.key || !this.config.enabled) {
      return false;
    }
    const url = (this.config.url || '').toLowerCase();
    if (url.includes('yourprojectid') || url.includes('example.com') || url.includes('xyzcompany')) {
      return false;
    }
    return true;
  }

  _withTimeout(promise, ms = 4000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase network timeout exceeded (4s)')), ms))
    ]);
  }

  async testConnection() {
    if (!this.config.url || !this.config.key) {
      throw new Error('Supabase URL and Anon Key are required');
    }
    try {
      const testClient = createClient(this.config.url, this.config.key);
      const queryPromise = testClient.from('customers').select('count', { count: 'exact', head: true });
      const { data, error } = await this._withTimeout(queryPromise, 5000);
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return true;
    } catch (err) {
      throw new Error('Supabase connection test failed: ' + err.message);
    }
  }

  /**
   * Sync a single record mutation to Supabase (upsert)
   */
  async upsert(table, record) {
    if (!this.isConfigured()) return;
    try {
      const { error } = await this.client.from(table).upsert(record);
      if (error) {
        console.warn(`[Supabase] Upsert error on ${table}:`, error.message);
      } else {
        console.log(`[Supabase] Synced record to ${table}`);
      }
    } catch (e) {
      console.warn(`[Supabase] Error syncing ${table}:`, e.message);
    }
  }

  /**
   * Delete a record from Supabase
   */
  async delete(table, id) {
    if (!this.isConfigured()) return;
    try {
      const { error } = await this.client.from(table).delete().eq('id', id);
      if (error) console.warn(`[Supabase] Delete error on ${table}:`, error.message);
    } catch (e) {
      console.warn(`[Supabase] Error deleting from ${table}:`, e.message);
    }
  }

  /**
   * Auto-sync on application startup:
   * 1. Check table existence
   * 2. Pull Supabase records into local DB if present
   * 3. Push local DB records to Supabase if Supabase is empty
   */
  async autoSyncOnStartup(db) {
    if (!this.isConfigured()) {
      console.log('[SUPABASE STARTUP] Supabase not configured. Running in offline/local mode.');
      return;
    }

    try {
      console.log('%c☁️ [SUPABASE STARTUP] Initializing cloud sync & loading data…', 'color:#0284c7;font-weight:bold;');
      await this.syncSupabaseToLocal(db);
    } catch (e) {
      console.warn('[SUPABASE STARTUP NOTICE]', e.message);
    }
  }

  /**
   * Sync all local data tables to Supabase Cloud DB
   */
  async syncAllLocalToSupabase(db) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please save your URL and Anon Key in Settings.');
    }

    const tables = ['customers', 'items', 'catalog_items', 'bills', 'bill_items', 'payments'];
    const summary = {};

    console.log('%c☁️ [SUPABASE SYNC] Pushing local DB tables to cloud…', 'color:#0284c7;font-weight:bold;');
    for (const table of tables) {
      const rows = db.all(`SELECT * FROM ${table}`);
      if (rows.length > 0) {
        const { error } = await this.client.from(table).upsert(rows);
        if (error) {
          console.error(`[SUPABASE ERROR] Sync failed for ${table}:`, error.message);
          throw new Error(`Failed syncing table ${table}: ${error.message}. Ensure supabase_schema.sql has been run.`);
        }
      }
      summary[table] = rows.length;
      console.log(`   └─ Table '${table}': ${rows.length} records synced to Supabase`);
    }

    console.log('%c✅ [SUPABASE SYNC COMPLETE] All tables in sync with cloud DB', 'color:#16a34a;font-weight:bold;');
    return summary;
  }

  /**
   * Sync all data from Supabase Cloud DB to local sql.js (IndexedDB)
   */
  async syncSupabaseToLocal(db) {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please save your URL and Anon Key in Settings.');
    }

    const tables = ['customers', 'items', 'catalog_items', 'bills', 'bill_items', 'payments'];
    const fetchedData = {};
    let totalRecords = 0;

    console.log('%c📥 [SUPABASE PULL] Fetching cloud tables from Supabase on startup…', 'color:#0284c7;font-weight:bold;');
    for (const table of tables) {
      try {
        const queryPromise = this.client.from(table).select('*');
        const { data, error } = await this._withTimeout(queryPromise, 4000);
        if (error) {
          if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('not find')) {
            console.warn(`[SUPABASE NOTICE] Table '${table}' does not exist in Supabase yet. Run supabase_schema.sql in Supabase SQL Editor.`);
          } else {
            console.warn(`[SUPABASE NOTICE] Error fetching ${table}:`, error.message);
          }
          fetchedData[table] = [];
        } else {
          fetchedData[table] = data || [];
          totalRecords += fetchedData[table].length;
          console.log(`   └─ Fetched '${table}': ${fetchedData[table].length} records from cloud`);
        }
      } catch (e) {
        console.warn(`[SUPABASE NOTICE] Could not fetch table ${table}:`, e.message);
        fetchedData[table] = [];
      }
    }

    if (totalRecords > 0) {
      db.transaction((dbInst) => {
        // Upsert customers
        (fetchedData.customers || []).forEach(r => {
          dbInst.run(
            `INSERT OR REPLACE INTO customers (id, name, phone, email, address, city, opening_balance, created_at) VALUES (?,?,?,?,?,?,?,?)`,
            [r.id, r.name, r.phone, r.email, r.address, r.city || null, r.opening_balance || 0, r.created_at]
          );
        });
        // Upsert items
        (fetchedData.items || []).forEach(r => {
          dbInst.run(
            `INSERT OR REPLACE INTO items (id, customer_id, name, unit, rate, gst_rate, category, hsn_code, stock_quantity, min_stock, location, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [r.id, r.customer_id, r.name, r.unit, r.rate, r.gst_rate, r.category || '', r.hsn_code || '', r.stock_quantity || 0, r.min_stock || 5, r.location || '', r.created_at]
          );
        });
        // Upsert catalog_items
        (fetchedData.catalog_items || []).forEach(r => {
          dbInst.run(
            `INSERT OR REPLACE INTO catalog_items (id, name, category, unit, rate, gst_rate, hsn_code, description, stock_quantity, min_stock, location, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [r.id, r.name, r.category, r.unit, r.rate, r.gst_rate, r.hsn_code, r.description, r.stock_quantity || 10, r.min_stock || 5, r.location || '', r.active ?? 1, r.created_at]
          );
        });
        // Upsert bills
        (fetchedData.bills || []).forEach(r => {
          dbInst.run(
            `INSERT OR REPLACE INTO bills (id, customer_id, bill_number, bill_date, subtotal, gst_total, total, carry_forward, paid, balance, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [r.id, r.customer_id, r.bill_number, r.bill_date, r.subtotal, r.gst_total, r.total, r.carry_forward, r.paid, r.balance, r.notes, r.created_at]
          );
        });
        // Upsert bill_items
        (fetchedData.bill_items || []).forEach(r => {
          dbInst.run(
            `INSERT OR REPLACE INTO bill_items (id, bill_id, item_id, catalog_item_id, description, quantity, unit, rate, gst_rate, amount, gst_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [r.id, r.bill_id, r.item_id, r.catalog_item_id, r.description, r.quantity, r.unit, r.rate, r.gst_rate, r.amount, r.gst_amount]
          );
        });
        // Upsert payments
        (fetchedData.payments || []).forEach(r => {
          dbInst.run(
            `INSERT OR REPLACE INTO payments (id, customer_id, bill_id, amount, payment_date, mode, reference, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
            [r.id, r.customer_id, r.bill_id, r.amount, r.payment_date, r.mode, r.reference, r.notes, r.created_at]
          );
        });
      });
      console.log('%c✅ [SUPABASE LOAD COMPLETE] Successfully loaded and merged Supabase cloud data into local DB!', 'color:#16a34a;font-weight:bold;');
    } else {
      console.log('[SUPABASE STARTUP] No existing records found in Supabase. Checking if local DB should be pushed to cloud...');
      const custCount = db.get('SELECT COUNT(*) as c FROM customers')?.c || 0;
      if (custCount > 0) {
        await this.syncAllLocalToSupabase(db);
      }
    }

    return fetchedData;
  }
}

export const supabaseService = new SupabaseService();
