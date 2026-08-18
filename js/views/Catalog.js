/**
 * Inventory & Parts Catalog View
 * Inventory tracking with Stock Status (In Stock, Low Stock, Out of Stock),
 * Storage Location ("Location of the Place"), and 2 Tabs (Customer vs All)
 */

import { CatalogItem } from '../models/CatalogItem.js';
import { Item } from '../models/Item.js';
import { Customer } from '../models/Customer.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';

const ALL_CATEGORIES = [
  'Engine & Lubrication',
  'Filters',
  'Brakes',
  'Clutch & Gearbox',
  'Ignition',
  'Electrical',
  'Belts & Hoses',
  'Cooling',
  'Suspension',
  'Steering',
  'Wheels & Tyres',
  'AC System',
  'Exhaust',
  'Sensors',
  'Body & Accessories',
  'Labour',
  'General'
];

const GST_SLABS = [0, 5, 12, 18, 28];

export class CatalogView {
  constructor(app) {
    this.app = app;
    this.element = null;
    this.activeTab = 'all'; // 'customer' or 'all'
    this.stockFilter = 'all'; // 'all', 'instock', 'lowstock', 'outofstock'
    this.filterCategory = '';
    this.searchQuery = '';
    this.selectedCustomerId = null;
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;

    const allCatalogItems = CatalogItem.getAll(true);
    const customers = Customer.getAll();

    if (!this.selectedCustomerId && customers.length > 0) {
      this.selectedCustomerId = customers[0].id;
    }

    // Calculate overall stats across all catalog inventory
    const totalCount = allCatalogItems.length;
    const inStockCount = allCatalogItems.filter(i => (i.stock_quantity || 0) > (i.min_stock || 5)).length;
    const lowStockCount = allCatalogItems.filter(i => (i.stock_quantity || 0) > 0 && (i.stock_quantity || 0) <= (i.min_stock || 5)).length;
    const outOfStockCount = allCatalogItems.filter(i => (i.stock_quantity || 0) <= 0).length;

    this.element.innerHTML = `
      <div class="inventory-catalog-view">
        <!-- Header -->
        <div class="view-header">
          <div>
            <h2 style="margin:0 0 4px">📦 Inventory & Parts Management</h2>
            <p style="margin:0;color:var(--color-text-secondary);font-size:var(--font-size-sm)">
              Track stock levels, storage locations, and master parts catalog
            </p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="btn-export-csv">📤 Export CSV</button>
            <button class="btn btn-primary" id="btn-add-item">+ Add Item</button>
          </div>
        </div>

        <!-- Inventory Stock Stats Strip -->
        <div class="inventory-stats" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:16px">
          <div class="card quick-stat">
            <span class="quick-stat-label">Total Catalog Items</span>
            <span class="quick-stat-value">${totalCount}</span>
            <span class="text-xs text-muted">All registered parts</span>
          </div>
          <div class="card quick-stat" style="border-left:4px solid #10b981">
            <span class="quick-stat-label">🟢 In Stock</span>
            <span class="quick-stat-value text-positive">${inStockCount}</span>
            <span class="text-xs text-muted">Healthy stock level</span>
          </div>
          <div class="card quick-stat" style="border-left:4px solid #f59e0b">
            <span class="quick-stat-label">🟡 Low Stock</span>
            <span class="quick-stat-value" style="color:#d97706">${lowStockCount}</span>
            <span class="text-xs text-muted">Below min threshold</span>
          </div>
          <div class="card quick-stat" style="border-left:4px solid #ef4444">
            <span class="quick-stat-label">🔴 Out of Stock</span>
            <span class="quick-stat-value text-negative">${outOfStockCount}</span>
            <span class="text-xs text-muted">Zero inventory available</span>
          </div>
        </div>

        <!-- 2 Main Tabs: Customer vs All -->
        <div class="card" style="padding:0;overflow:hidden">
          <div class="view-tabs-header" style="display:flex;border-bottom:1px solid var(--color-border);background:var(--color-surface);padding:8px 16px 0;gap:8px">
            <button class="tab-btn ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all" style="padding:10px 20px;font-weight:600;display:flex;align-items:center;gap:8px">
              🌐 All Inventory / Parts (${totalCount})
            </button>
            <button class="tab-btn ${this.activeTab === 'customer' ? 'active' : ''}" data-tab="customer" style="padding:10px 20px;font-weight:600;display:flex;align-items:center;gap:8px">
              👤 Customer Master Items
            </button>
          </div>

          <div class="view-tab-content" style="padding:20px">
            ${this.activeTab === 'all' ? this._renderAllTab(allCatalogItems) : this._renderCustomerTab(customers)}
          </div>
        </div>
      </div>
    `;

    this._injectStyles();
    this._bindEvents();
  }

  _renderAllTab(allItems) {
    // Filter items by search, category, and stock filter
    const categories = [...new Set(allItems.map(i => i.category))].sort();

    const filtered = allItems.filter(item => {
      const matchesSearch = !this.searchQuery ||
        item.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (item.location || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (item.hsn_code || '').includes(this.searchQuery);

      const matchesCat = !this.filterCategory || item.category === this.filterCategory;

      const qty = item.stock_quantity || 0;
      const minStock = item.min_stock || 5;

      let matchesStock = true;
      if (this.stockFilter === 'instock') matchesStock = qty > minStock;
      else if (this.stockFilter === 'lowstock') matchesStock = qty > 0 && qty <= minStock;
      else if (this.stockFilter === 'outofstock') matchesStock = qty <= 0;

      return matchesSearch && matchesCat && matchesStock;
    });

    return `
      <div class="all-inventory-panel">
        <!-- Stock Filter Buttons & Search -->
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <!-- Stock Status Filter Pills -->
            <div class="stock-pills" style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-sm ${this.stockFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-stock-filter="all">All Items</button>
              <button class="btn btn-sm ${this.stockFilter === 'instock' ? 'btn-primary' : 'btn-secondary'}" data-stock-filter="instock">🟢 In Stock</button>
              <button class="btn btn-sm ${this.stockFilter === 'lowstock' ? 'btn-primary' : 'btn-secondary'}" data-stock-filter="lowstock">🟡 Low Stock</button>
              <button class="btn btn-sm ${this.stockFilter === 'outofstock' ? 'btn-primary' : 'btn-secondary'}" data-stock-filter="outofstock">🔴 Out of Stock</button>
            </div>

            <!-- Search input & Category dropdown -->
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;justify-content:flex-end">
              <div class="search-input-wrapper" style="max-width:300px;flex:1">
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="search" class="search-input" id="inv-search" placeholder="Search name, HSN, location..." value="${this._esc(this.searchQuery)}">
              </div>

              <select id="inv-cat-filter" style="padding:8px 12px;border:1.5px solid var(--color-border);border-radius:8px;font-size:14px">
                <option value="">All Categories</option>
                ${categories.map(c => `<option value="${this._esc(c)}" ${this.filterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Inventory Table -->
        ${filtered.length === 0 ? `
          <div class="empty-state-container">
            <h3>No inventory items found</h3>
            <p>Try adjusting your search or filters</p>
            <button class="btn btn-primary" id="btn-add-item-empty">+ Add Item</button>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Part / Item Name</th>
                  <th>Category</th>
                  <th>Stock Status</th>
                  <th>Stock Quantity</th>
                  <th>Location (Place)</th>
                  <th class="text-right">Rate (₹)</th>
                  <th class="text-right">GST %</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(item => {
                  const qty = item.stock_quantity || 0;
                  const min = item.min_stock || 5;
                  let badgeHtml = '';
                  if (qty <= 0) badgeHtml = `<span class="stock-badge badge-danger">🔴 Out of Stock</span>`;
                  else if (qty <= min) badgeHtml = `<span class="stock-badge badge-warning">🟡 Low Stock (${qty})</span>`;
                  else badgeHtml = `<span class="stock-badge badge-success">🟢 In Stock (${qty})</span>`;

                  return `
                    <tr data-item-id="${item.id}" class="${qty <= 0 ? 'out-of-stock-row' : ''}">
                      <td>
                        <strong>${this._esc(item.name)}</strong>
                        ${item.hsn_code ? `<br><small class="text-muted">HSN: ${this._esc(item.hsn_code)}</small>` : ''}
                      </td>
                      <td><span class="badge badge-secondary">${this._esc(item.category || 'General')}</span></td>
                      <td>${badgeHtml}</td>
                      <td>
                        <div class="stock-stepper" style="display:flex;align-items:center;gap:6px">
                          <button class="btn-stock-adj" data-action="stock-dec" data-id="${item.id}" title="Decrease Stock">-</button>
                          <span style="font-weight:700;min-width:32px;text-align:center">${qty}</span>
                          <button class="btn-stock-adj" data-action="stock-inc" data-id="${item.id}" title="Increase Stock">+</button>
                          <span class="text-muted text-xs">${item.unit || 'pcs'}</span>
                        </div>
                      </td>
                      <td>
                        <span class="location-tag">
                          📍 ${this._esc(item.location || 'Main Store / Unassigned')}
                        </span>
                      </td>
                      <td class="text-right fw-600">${formatINR(item.rate)}</td>
                      <td class="text-right">${item.gst_rate}%</td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${item.id}" title="Edit Item">✏️</button>
                          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}" title="Delete Item">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  _renderCustomerTab(customers) {
    if (!customers.length) {
      return `
        <div class="empty-state-container">
          <h3>No customers found</h3>
          <p>Add customers to view or assign customer-specific inventory items</p>
          <button class="btn btn-primary" id="btn-goto-cust">+ Add Customer</button>
        </div>
      `;
    }

    const currentCust = Customer.getById(this.selectedCustomerId) || customers[0];
    const customerItems = currentCust ? Item.getByCustomer(currentCust.id) : [];

    return `
      <div class="customer-inventory-panel">
        <!-- Customer Select Header -->
        <div class="customer-select-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;background:#f8fafc;padding:16px;border-radius:10px;border:1px solid var(--color-border);margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:280px">
            <label style="font-weight:600;white-space:nowrap">Select Customer:</label>
            <select id="inv-customer-select" class="form-control" style="max-width:320px;padding:8px 12px;border:1.5px solid var(--color-border);border-radius:8px">
              ${customers.map(c => `<option value="${c.id}" ${c.id === currentCust?.id ? 'selected' : ''}>${c.name} ${c.city ? `(${c.city})` : ''}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="btn-add-cust-item" data-customer-id="${currentCust?.id}">
            + Add Item for ${currentCust?.name}
          </button>
        </div>

        <!-- Customer Items Table -->
        ${customerItems.length === 0 ? `
          <div class="empty-state-container">
            <h3>No master items for ${currentCust?.name}</h3>
            <p>Create master items specific to this customer with stock and location tracking</p>
            <button class="btn btn-primary" id="btn-add-cust-item-empty" data-customer-id="${currentCust?.id}">+ Add Item</button>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Stock Status</th>
                  <th>Stock Quantity</th>
                  <th>Location (Place)</th>
                  <th class="text-right">Rate (₹)</th>
                  <th class="text-right">GST %</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${customerItems.map(item => {
                  const qty = item.stock_quantity || 0;
                  const min = item.min_stock || 5;
                  let badgeHtml = '';
                  if (qty <= 0) badgeHtml = `<span class="stock-badge badge-danger">🔴 Out of Stock</span>`;
                  else if (qty <= min) badgeHtml = `<span class="stock-badge badge-warning">🟡 Low Stock (${qty})</span>`;
                  else badgeHtml = `<span class="stock-badge badge-success">🟢 In Stock (${qty})</span>`;

                  return `
                    <tr data-cust-item-id="${item.id}">
                      <td><strong>${this._esc(item.name)}</strong></td>
                      <td>${badgeHtml}</td>
                      <td>
                        <div class="stock-stepper" style="display:flex;align-items:center;gap:6px">
                          <button class="btn-stock-adj" data-action="cust-stock-dec" data-id="${item.id}">-</button>
                          <span style="font-weight:700;min-width:32px;text-align:center">${qty}</span>
                          <button class="btn-stock-adj" data-action="cust-stock-inc" data-id="${item.id}">+</button>
                          <span class="text-muted text-xs">${item.unit || 'pcs'}</span>
                        </div>
                      </td>
                      <td>
                        <span class="location-tag">
                          📍 ${this._esc(item.location || 'Store Bin / Unassigned')}
                        </span>
                      </td>
                      <td class="text-right fw-600">${formatINR(item.rate)}</td>
                      <td class="text-right">${item.gst_rate}%</td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-sm btn-secondary" data-action="edit-cust-item" data-id="${item.id}">✏️</button>
                          <button class="btn btn-sm btn-danger" data-action="delete-cust-item" data-id="${item.id}">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  _bindEvents() {
    if (!this.element) return;

    // Main Tab Switching
    this.element.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this._render();
      });
    });

    // Stock Filter Pills
    this.element.querySelectorAll('[data-stock-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.stockFilter = btn.dataset.stockFilter;
        this._render();
      });
    });

    // Search Input
    const searchInput = this.element.querySelector('#inv-search');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.searchQuery = searchInput.value;
          this._render();
        }, 200);
      });
    }

    // Category Filter Dropdown
    this.element.querySelector('#inv-cat-filter')?.addEventListener('change', (e) => {
      this.filterCategory = e.target.value;
      this._render();
    });

    // Customer Select Dropdown in Customer Tab
    const custSelect = this.element.querySelector('#inv-customer-select');
    if (custSelect) {
      custSelect.addEventListener('change', (e) => {
        this.selectedCustomerId = parseInt(e.target.value);
        this._render();
      });
    }

    // Add buttons
    this.element.querySelector('#btn-add-item')?.addEventListener('click', () => this._showCatalogModal());
    this.element.querySelector('#btn-add-item-empty')?.addEventListener('click', () => this._showCatalogModal());

    this.element.querySelector('#btn-add-cust-item')?.addEventListener('click', (e) => {
      const cid = parseInt(e.currentTarget.dataset.customerId);
      this._showCustomerItemModal(cid);
    });

    this.element.querySelector('#btn-add-cust-item-empty')?.addEventListener('click', (e) => {
      const cid = parseInt(e.currentTarget.dataset.customerId);
      this._showCustomerItemModal(cid);
    });

    this.element.querySelector('#btn-goto-cust')?.addEventListener('click', () => {
      this.app.navigateTo('customers');
    });

    // Stock Adjust buttons for Catalog Items
    this.element.querySelectorAll('[data-action="stock-inc"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        CatalogItem.adjustStock(id, 1);
        this._render();
      });
    });

    this.element.querySelectorAll('[data-action="stock-dec"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        CatalogItem.adjustStock(id, -1);
        this._render();
      });
    });

    // Actions for Catalog Items
    this.element.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        this._showCatalogModal(id);
      });
    });

    this.element.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const confirmed = await Modal.confirm('Delete this inventory item?', 'Confirm Delete');
        if (!confirmed) return;
        CatalogItem.delete(id);
        Toast.success('Item deleted');
        this._render();
      });
    });

    // Stock Adjust buttons for Customer Items
    this.element.querySelectorAll('[data-action="cust-stock-inc"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        Item.adjustStock(id, 1);
        this._render();
      });
    });

    this.element.querySelectorAll('[data-action="cust-stock-dec"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        Item.adjustStock(id, -1);
        this._render();
      });
    });

    // Actions for Customer Items
    this.element.querySelectorAll('[data-action="edit-cust-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const item = Item.getById(id);
        if (item) this._showCustomerItemModal(item.customer_id, item);
      });
    });

    this.element.querySelectorAll('[data-action="delete-cust-item"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const confirmed = await Modal.confirm('Delete this customer item?', 'Confirm Delete');
        if (!confirmed) return;
        Item.delete(id);
        Toast.success('Customer item deleted');
        this._render();
      });
    });

    // Export CSV
    this.element.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      const items = CatalogItem.getAll(true);
      let csv = 'ID,Name,Category,Unit,Rate,GST_%,Stock_Quantity,Min_Stock,Location,HSN_Code\n';
      items.forEach(i => {
        csv += `"${i.id}","${i.name}","${i.category || ''}","${i.unit || ''}","${i.rate || 0}","${i.gst_rate || 0}","${i.stock_quantity || 0}","${i.min_stock || 5}","${i.location || ''}","${i.hsn_code || ''}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_catalog_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  _showCatalogModal(itemId = null) {
    const isEdit = !!itemId;
    const item = isEdit ? CatalogItem.getById(itemId) : null;

    const modal = new Modal({
      title: isEdit ? '✏️ Edit Inventory Item' : '+ Add Inventory Item',
      size: 'md',
      confirmText: isEdit ? 'Update Item' : 'Add Item',
      cancelText: 'Cancel',
      content: `
        <form id="catalog-item-form" class="form" novalidate>
          <div class="form-group">
            <label>Item / Part Name *</label>
            <input type="text" name="name" value="${this._esc(item?.name || '')}" required placeholder="e.g. Engine Oil (5L)">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select name="category">
                ${ALL_CATEGORIES.map(c => `<option value="${c}" ${(item?.category || 'General') === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Unit</label>
              <input type="text" name="unit" value="${this._esc(item?.unit || 'pcs')}" placeholder="pcs / ltr / set">
            </div>
          </div>

          <!-- Stock & Location of the place -->
          <div class="form-row" style="background:#f1f5f9;padding:12px;border-radius:8px;margin-bottom:16px">
            <div class="form-group" style="margin:0">
              <label>Stock Quantity *</label>
              <input type="number" name="stock_quantity" step="1" min="0" value="${item?.stock_quantity ?? 10}" placeholder="0">
            </div>
            <div class="form-group" style="margin:0">
              <label>Min Stock Threshold</label>
              <input type="number" name="min_stock" step="1" min="0" value="${item?.min_stock ?? 5}" placeholder="5">
            </div>
          </div>

          <div class="form-group">
            <label>Location of the Place (Storage Bin / Rack) *</label>
            <input type="text" name="location" value="${this._esc(item?.location || '')}" placeholder="e.g. Rack A-3, Shelf 2, Warehouse 1">
            <small class="form-help">Physical location where this item is stored</small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Rate (₹) *</label>
              <input type="number" name="rate" step="0.01" min="0" value="${item?.rate ?? 0}" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label>GST Rate %</label>
              <select name="gst_rate">
                ${GST_SLABS.map(g => `<option value="${g}" ${(item?.gst_rate ?? 18) === g ? 'selected' : ''}>${g}%</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>HSN Code</label>
            <input type="text" name="hsn_code" value="${this._esc(item?.hsn_code || '')}" placeholder="e.g. 27101990">
          </div>
          <div class="form-group">
            <label>Description / Notes</label>
            <textarea name="description" rows="2" placeholder="Optional details">${this._esc(item?.description || '')}</textarea>
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#catalog-item-form');
        const fd = new FormData(form);
        const data = {
          name:           fd.get('name')?.trim(),
          category:       fd.get('category') || 'General',
          unit:           fd.get('unit')?.trim() || 'pcs',
          stock_quantity: parseFloat(fd.get('stock_quantity')) || 0,
          min_stock:      parseFloat(fd.get('min_stock')) || 5,
          location:       fd.get('location')?.trim() || '',
          rate:           parseFloat(fd.get('rate')) || 0,
          gst_rate:       parseFloat(fd.get('gst_rate')) || 0,
          hsn_code:       fd.get('hsn_code')?.trim() || '',
          description:    fd.get('description')?.trim() || ''
        };

        if (!data.name) {
          Toast.error('Please enter item name');
          return false;
        }

        try {
          if (isEdit) {
            CatalogItem.update(itemId, data);
            Toast.success('Item updated');
          } else {
            CatalogItem.create(data);
            Toast.success('Item added to inventory');
          }
          m.hide(true);
          this._render();
        } catch (err) {
          Toast.error('Error: ' + err.message);
          return false;
        }
      }
    });

    modal.show();
    setTimeout(() => modal.element?.querySelector('input[name="name"]')?.focus(), 50);
  }

  _showCustomerItemModal(customerId, existingItem = null) {
    const isEdit = !!existingItem;
    const customer = Customer.getById(customerId);

    const modal = new Modal({
      title: isEdit ? '✏️ Edit Customer Item' : `+ Add Item for ${customer?.name || 'Customer'}`,
      size: 'md',
      confirmText: isEdit ? 'Update Item' : 'Add Item',
      cancelText: 'Cancel',
      content: `
        <form id="cust-item-form" class="form" novalidate>
          <div class="form-group">
            <label>Item Name *</label>
            <input type="text" name="name" value="${this._esc(existingItem?.name || '')}" required placeholder="Item name">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Unit</label>
              <input type="text" name="unit" value="${this._esc(existingItem?.unit || 'pcs')}" placeholder="pcs">
            </div>
            <div class="form-group">
              <label>Rate (₹) *</label>
              <input type="number" name="rate" step="0.01" min="0" value="${existingItem?.rate ?? 0}" required placeholder="0.00">
            </div>
          </div>

          <!-- Stock & Location -->
          <div class="form-row" style="background:#f1f5f9;padding:12px;border-radius:8px;margin-bottom:16px">
            <div class="form-group" style="margin:0">
              <label>Stock Quantity</label>
              <input type="number" name="stock_quantity" step="1" min="0" value="${existingItem?.stock_quantity ?? 0}" placeholder="0">
            </div>
            <div class="form-group" style="margin:0">
              <label>Min Stock Threshold</label>
              <input type="number" name="min_stock" step="1" min="0" value="${existingItem?.min_stock ?? 5}" placeholder="5">
            </div>
          </div>

          <div class="form-group">
            <label>Location of the Place (Storage Bin / Rack)</label>
            <input type="text" name="location" value="${this._esc(existingItem?.location || '')}" placeholder="e.g. Shelf 4, Bin B">
          </div>

          <div class="form-group">
            <label>GST Rate %</label>
            <input type="number" name="gst_rate" step="0.1" min="0" max="28" value="${existingItem?.gst_rate ?? 0}" placeholder="0">
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#cust-item-form');
        const fd = new FormData(form);
        const data = {
          customer_id:    customerId,
          name:           fd.get('name')?.trim(),
          unit:           fd.get('unit')?.trim() || 'pcs',
          rate:           parseFloat(fd.get('rate')) || 0,
          gst_rate:       parseFloat(fd.get('gst_rate')) || 0,
          stock_quantity: parseFloat(fd.get('stock_quantity')) || 0,
          min_stock:      parseFloat(fd.get('min_stock')) || 5,
          location:       fd.get('location')?.trim() || ''
        };

        if (!data.name) {
          Toast.error('Please enter item name');
          return false;
        }

        try {
          if (isEdit) {
            Item.update(existingItem.id, data);
            Toast.success('Item updated');
          } else {
            Item.create(data);
            Toast.success('Item added');
          }
          m.hide(true);
          this._render();
        } catch (err) {
          Toast.error('Error: ' + err.message);
          return false;
        }
      }
    });

    modal.show();
    setTimeout(() => modal.element?.querySelector('input[name="name"]')?.focus(), 50);
  }

  _injectStyles() {
    if (document.getElementById('inventory-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'inventory-custom-styles';
    style.textContent = `
      .stock-badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600;
      }
      .stock-badge.badge-success { background: #d1fae5; color: #065f46; }
      .stock-badge.badge-warning { background: #fef3c7; color: #92400e; }
      .stock-badge.badge-danger  { background: #fee2e2; color: #991b1b; }

      .location-tag {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px; border-radius: 6px; background: #f1f5f9;
        color: #475569; font-size: 12px; font-weight: 500; border: 1px solid #e2e8f0;
      }

      .btn-stock-adj {
        width: 24px; height: 24px; border-radius: 6px;
        border: 1px solid var(--color-border); background: var(--color-surface);
        font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 120ms ease;
      }
      .btn-stock-adj:hover { background: var(--color-primary-light); border-color: var(--color-primary); color: var(--color-primary); }

      .out-of-stock-row { background: #fff5f5; }
    `;
    document.head.appendChild(style);
  }

  _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  refresh() {
    this._render();
  }
}
