/**
 * Settings View
 * Data export, import, backup, and clear data
 */

import { db } from '../db/database.js';
import { Modal, Toast } from '../components/Modal.js';
import { exportJsonFile, importJsonFile, exportAllCSV } from '../utils/export.js';

export class SettingsView {
  constructor(app) {
    this.app = app;
    this.element = null;
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;
    this.element.innerHTML = `
      <div class="settings-view">
        <div class="view-header">
          <h2>Settings</h2>
        </div>

        <!-- Data Management -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h3>Data Management</h3>
          </div>
          <div class="settings-grid">
            <div class="setting-card">
              <h4>📤 Export All Data (JSON)</h4>
              <p>Complete backup of all customers, items, bills, and payments as a JSON file.</p>
              <button class="btn btn-secondary" id="btn-export-json">Export JSON Backup</button>
            </div>
            <div class="setting-card">
              <h4>📊 Export All Data (CSV)</h4>
              <p>Download separate CSV files for customers, items, bills, and payments.</p>
              <button class="btn btn-secondary" id="btn-export-csv">Export CSV Files</button>
            </div>
            <div class="setting-card">
              <h4>📥 Import Data (JSON)</h4>
              <p>Restore from a previously exported JSON backup file. <strong>This will overwrite all existing data.</strong></p>
              <input type="file" id="import-file" accept=".json" style="display:none">
              <button class="btn btn-secondary" id="btn-import-json">Choose JSON File…</button>
            </div>
            <div class="setting-card danger">
              <h4>⚠️ Danger Zone</h4>
              <p>Permanently delete ALL customers, bills, items, and payments. This <strong>cannot be undone</strong>.</p>
              <button class="btn btn-danger" id="btn-clear-all">Clear All Data</button>
            </div>
          </div>
        </div>

        <!-- About -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h3>About</h3>
          </div>
          <div style="padding:24px">
            <h4 style="margin:0 0 8px">BillMate v1.0.0</h4>
            <p style="margin:0 0 12px;color:var(--color-text-secondary)">
              A local-first billing application that runs entirely in your browser.
              All data is stored in SQLite (via sql.js WASM) and persisted to IndexedDB.
              No internet connection required after first load.
            </p>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <span class="badge badge-primary">SQLite (sql.js WASM)</span>
              <span class="badge badge-info">IndexedDB persistence</span>
              <span class="badge badge-success">100% Offline</span>
              <span class="badge badge-warning">Indian Rupee (INR)</span>
            </div>
          </div>
        </div>

        <!-- DB Stats -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h3>Database Statistics</h3>
          </div>
          <div style="padding:24px">
            ${this._renderStats()}
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderStats() {
    try {
      const customers = db.get('SELECT COUNT(*) as c FROM customers')?.c || 0;
      const items     = db.get('SELECT COUNT(*) as c FROM items')?.c || 0;
      const bills     = db.get('SELECT COUNT(*) as c FROM bills')?.c || 0;
      const payments  = db.get('SELECT COUNT(*) as c FROM payments')?.c || 0;

      return `
        <div class="stats-grid" style="gap:12px">
          <div class="stat-card stat-primary" style="padding:12px">
            <div class="stat-content">
              <span class="stat-value">${customers}</span>
              <span class="stat-label">Customers</span>
            </div>
          </div>
          <div class="stat-card stat-info" style="padding:12px">
            <div class="stat-content">
              <span class="stat-value">${items}</span>
              <span class="stat-label">Master Items</span>
            </div>
          </div>
          <div class="stat-card stat-warning" style="padding:12px">
            <div class="stat-content">
              <span class="stat-value">${bills}</span>
              <span class="stat-label">Bills</span>
            </div>
          </div>
          <div class="stat-card stat-success" style="padding:12px">
            <div class="stat-content">
              <span class="stat-value">${payments}</span>
              <span class="stat-label">Payments</span>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      return '<p class="text-muted">Statistics unavailable</p>';
    }
  }

  _bindEvents() {
    if (!this.element) return;

    this.element.querySelector('#btn-export-json')?.addEventListener('click', () => {
      try {
        exportJsonFile();
        Toast.success('JSON backup exported successfully');
      } catch (e) {
        Toast.error('Export failed: ' + e.message);
      }
    });

    this.element.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      try {
        const counts = exportAllCSV();
        Toast.success(`Exported: ${counts.customers} customers, ${counts.items} items, ${counts.bills} bills, ${counts.payments} payments`);
      } catch (e) {
        Toast.error('Export failed: ' + e.message);
      }
    });

    this.element.querySelector('#btn-import-json')?.addEventListener('click', () => {
      this.element.querySelector('#import-file')?.click();
    });

    this.element.querySelector('#import-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const confirmed = await Modal.confirm(
        'Importing will REPLACE all existing data. Are you sure you want to continue?',
        'Confirm Import'
      );
      if (!confirmed) { e.target.value = ''; return; }

      try {
        const result = await importJsonFile(file);
        Toast[result.success ? 'success' : 'error'](result.message);
        if (result.success) {
          setTimeout(() => this.app.navigateTo('dashboard'), 500);
        }
      } catch (err) {
        Toast.error(err.message || 'Import failed');
      }
      e.target.value = '';
    });

    this.element.querySelector('#btn-clear-all')?.addEventListener('click', async () => {
      const confirmed = await Modal.confirm(
        'This will permanently delete ALL data — customers, items, bills, and payments. Are you absolutely sure?',
        'Clear All Data'
      );
      if (!confirmed) return;

      // Double confirm
      const confirmed2 = await Modal.confirm(
        'Last warning: ALL DATA will be lost. Type OK to confirm.',
        'Final Confirmation'
      );
      if (!confirmed2) return;

      try {
        db.clearAll();
        Toast.success('All data cleared');
        setTimeout(() => this.app.navigateTo('dashboard'), 500);
      } catch (err) {
        Toast.error('Failed to clear data: ' + err.message);
      }
    });
  }

  refresh() {
    this._render();
  }
}