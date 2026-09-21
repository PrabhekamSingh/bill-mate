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
    return !!(this.client && this.config.url && this.config.key && this.config.enabled);
  }

  async testConnection() {
    if (!this.config.url || !this.config.key) {
      throw new Error('Supabase URL and Anon Key are required');
    }
    try {
      const testClient = createClient(this.config.url, this.config.key);
      const { data, error } = await testClient.from('customers').select('count', { count: 'exact', head: true });
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
          throw new Error(`Failed syncing table ${table}: ${error.message}`);
        }
      }
      summary[table] = rows.length;
      console.log(`   └─ Table '${table}': ${rows.length} records synced`);
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
    const summary = {};

    console.log('%c📥 [SUPABASE PULL] Fetching cloud tables from Supabase…', 'color:#0284c7;font-weight:bold;');
    for (const table of tables) {
      const { data, error } = await this.client.from(table).select('*');
      if (error) throw new Error(`Failed fetching ${table} from Supabase: ${error.message}`);
      summary[table] = data ? data.length : 0;
      console.log(`   └─ Fetched '${table}': ${summary[table]} records from cloud`);
    }

    // Wrap local DB update in a transaction
    db.transaction((dbInst) => {
      dbInst.run('DELETE FROM bill_items');
      dbInst.run('DELETE FROM payments');
      dbInst.run('DELETE FROM bills');
      dbInst.run('DELETE FROM items');
      dbInst.run('DELETE FROM catalog_items');
      dbInst.run('DELETE FROM customers');
    });

    return summary;
  }
}

export const supabaseService = new SupabaseService();
