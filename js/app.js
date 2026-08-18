/**
 * Main Application Entry Point
 * Initializes database, sets up routing and views
 */

import { db } from './db/database.js';
import { Dashboard } from './views/Dashboard.js';
import { CustomersView } from './views/Customers.js';
import { CustomerDetailView } from './views/CustomerDetail.js';
import { BillCreateView } from './views/BillCreate.js';
import { ItemsView } from './views/Items.js';
import { ReportsView } from './views/Reports.js';
import { SettingsView } from './views/Settings.js';
import { CatalogView } from './views/Catalog.js';
import { PaymentsView } from './views/Payments.js';
import { Toast } from './components/Modal.js';

class BillingApp {
  constructor() {
    this.currentView = null;
    this.currentCustomerId = null;
  }

  async init() {
    const overlay = document.getElementById('loading-overlay');
    try {
      await db.init();

      // Instantiate stable views (no params needed at construction)
      this._views = {
        dashboard: new Dashboard(this),
        customers: new CustomersView(this),
        catalog:   new CatalogView(this),
        payments:  new PaymentsView(this),
        reports:   new ReportsView(this),
        settings:  new SettingsView(this),
      };

      // Setup nav link clicks
      this._setupNav();

      // Setup hash-based routing
      window.addEventListener('hashchange', () => this._handleRoute());

      // Initial route
      this._handleRoute();

      // Hide loading overlay
      if (overlay) overlay.style.display = 'none';

      window.billingApp = this; // for debugging
    } catch (error) {
      console.error('App init failed:', error);
      if (overlay) {
        overlay.innerHTML = `
          <div style="text-align:center;color:#dc2626;padding:2rem;">
            <strong>Failed to initialize database</strong><br>
            <small>${error.message}</small><br><br>
            <small>Make sure you're serving this app via an HTTP server (not file://)</small>
          </div>
        `;
      }
    }
  }

  _setupNav() {
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        window.location.hash = view;
      });
    });
  }

  _handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    const view = parts[0];

    // Parse query-string-style params: view/key=val/key2=val2
    const params = {};
    for (let i = 1; i < parts.length; i++) {
      const [k, v] = parts[i].split('=');
      if (k) params[k] = v;
    }

    switch (view) {
      case 'dashboard':
        this.navigateTo('dashboard');
        break;
      case 'customers':
        this.navigateTo('customers');
        break;
      case 'catalog':
        this.navigateTo('catalog');
        break;
      case 'payments':
        this.navigateTo('payments');
        break;
      case 'customer-detail': {
        const customerId = parseInt(params.customerId);
        if (customerId) this.navigateTo('customer-detail', { customerId });
        else this.navigateTo('customers');
        break;
      }
      case 'bill-create': {
        const customerId = parseInt(params.customerId);
        const billId = params.billId ? parseInt(params.billId) : null;
        if (customerId) this.navigateTo('bill-create', { customerId, billId });
        else this.navigateTo('customers');
        break;
      }
      case 'items': {
        const customerId = parseInt(params.customerId);
        if (customerId) this.navigateTo('items', { customerId });
        else this.navigateTo('customers');
        break;
      }
      case 'reports':
        this.navigateTo('reports');
        break;
      case 'settings':
        this.navigateTo('settings');
        break;
      default:
        this.navigateTo('dashboard');
    }
  }

  navigateTo(viewName, params = {}) {
    // Cleanup current view
    if (this.currentView && typeof this.currentView.cleanup === 'function') {
      this.currentView.cleanup();
    }

    let view;

    // Views that need params are instantiated fresh each time
    switch (viewName) {
      case 'customer-detail': {
        const cid = params.customerId || this.currentCustomerId;
        if (!cid) { this.navigateTo('customers'); return; }
        this.currentCustomerId = cid;
        view = new CustomerDetailView(this, cid);
        break;
      }
      case 'bill-create': {
        const cid = params.customerId || this.currentCustomerId;
        if (!cid) { this.navigateTo('customers'); return; }
        this.currentCustomerId = cid;
        view = new BillCreateView(this, cid, params.billId || null);
        break;
      }
      case 'items': {
        const cid = params.customerId || this.currentCustomerId;
        if (!cid) { this.navigateTo('customers'); return; }
        this.currentCustomerId = cid;
        view = new ItemsView(this, cid);
        break;
      }
      default:
        view = this._views[viewName];
    }

    if (!view) {
      console.warn(`Unknown view: ${viewName}`);
      view = this._views['dashboard'];
    }

    this.currentView = view;

    const container = document.getElementById('view-container');
    if (container) {
      container.innerHTML = '';
      view.mount(container);
    }

    this._updateNav(viewName);
  }

  _updateNav(activeView) {
    // Map child views back to their parent nav item
    const navMap = {
      'customer-detail': 'customers',
      'bill-create':     'customers',
      'items':           'customers',
    };
    const navView = navMap[activeView] || activeView;

    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      link.classList.toggle('active', link.dataset.view === navView);
    });
  }

  async refreshCurrentView() {
    if (this.currentView && typeof this.currentView.refresh === 'function') {
      await this.currentView.refresh();
    }
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const app = new BillingApp();
  app.init();
});