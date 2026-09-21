/**
 * Bill Create / Edit View
 * Create or edit bills with line items and carry-forward balance
 */

import { Bill } from '../models/Bill.js';
import { Customer } from '../models/Customer.js';
import { Item } from '../models/Item.js';
import { CatalogItem } from '../models/CatalogItem.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';
import { formatDate, formatDateISO, todayISO } from '../utils/date.js';
import { validateForm, rules } from '../utils/validation.js';
import { db } from '../db/database.js';
import { exportSingleBillCSV, exportCustomerBillsCSV } from '../utils/export.js';

export class BillCreateView {
  constructor(app, customerId, billId = null) {
    this.app = app;
    this.customerId = parseInt(customerId);
    this.billId = billId ? parseInt(billId) : null;
    this.isEdit = !!billId;
    this.element = null;

    // State
    this.lineItems = [];
    this.billNumber = '';
    this.billDate = todayISO();
    this.billNotes = '';
    this.carryForward = 0;

    this._initState();
  }

  _initState() {
    if (this.isEdit && this.billId) {
      const bill = Bill.getById(this.billId);
      if (bill) {
        this.billNumber = bill.bill_number;
        this.billDate   = formatDateISO(bill.bill_date) || todayISO();
        this.billNotes  = bill.notes || '';
        this.carryForward = bill.carry_forward || 0;
        this.lineItems = (bill.items || []).map(item => ({
          item_id:     item.item_id || null,
          description: item.description || '',
          quantity:    parseFloat(item.quantity) || 1,
          unit:        item.item_unit || 'pcs',
          rate:        parseFloat(item.rate) || 0,
          gst_rate:    parseFloat(item.gst_rate) || 0
        }));
      }
    } else {
      this.billNumber = Bill.generateBillNumber(this.customerId);
      this.carryForward = Bill.getCarryForward(this.customerId);
      // Start with one blank row
      this.lineItems = [{ item_id: null, description: '', quantity: 1, unit: 'pcs', rate: 0, gst_rate: 0 }];
    }
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;
    const customer = Customer.getById(this.customerId);
    if (!customer) {
      this.element.innerHTML = `<div class="empty-state-container"><h3>Customer not found</h3></div>`;
      return;
    }

    const totals = this._calcTotals();

    this.element.innerHTML = `
      <div class="bill-create-view">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a href="#" id="bc-customers">Customers</a>
          <span class="sep">/</span>
          <a href="#" id="bc-customer">${customer.name}</a>
          <span class="sep">/</span>
          <span>${this.isEdit ? 'Edit Bill' : 'New Bill'}</span>
        </div>

        <h2 style="margin:0 0 16px">${this.isEdit ? 'Edit Bill' : 'New Bill'} — ${customer.name}</h2>

        <!-- Carry Forward Banner -->
        ${this.carryForward !== 0 ? `
        <div class="carry-forward-banner">
          <span class="carry-forward-label">⚡ Carry Forward from previous balance</span>
          <span class="carry-forward-value ${this.carryForward > 0 ? 'text-negative' : 'text-positive'}">${formatINR(this.carryForward)}</span>
        </div>
        ` : ''}

        <!-- Bill Details Form -->
        <div class="bill-form-card">
          <form id="bill-meta-form" class="form">
            <div class="form-row">
              <div class="form-group" style="margin:0">
                <label>Bill Number *</label>
                <input type="text" id="inp-bill-number" name="bill_number" value="${this.billNumber}" required>
              </div>
              <div class="form-group" style="margin:0">
                <label>Bill Date *</label>
                <input type="date" id="inp-bill-date" name="bill_date" value="${this.billDate}" required>
              </div>
            </div>
            <div class="form-group" style="margin-top:12px;margin-bottom:0">
              <label>Notes</label>
              <textarea id="inp-notes" name="notes" rows="2" placeholder="Optional notes">${this.billNotes}</textarea>
            </div>
          </form>
        </div>

        <!-- Line Items -->
        <div class="line-items-section">
          <div class="line-items-header">
            <h3>Line Items</h3>
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary btn-sm" id="btn-add-from-master" type="button">📦 Add from Items</button>
              <button class="btn btn-primary btn-sm" id="btn-add-row" type="button">+ Add Row</button>
            </div>
          </div>
          <div class="table-responsive">
            <table class="line-items-table">
              <thead>
                <tr>
                  <th style="width:32px">#</th>
                  <th>Description</th>
                  <th style="width:80px">Qty</th>
                  <th style="width:70px">Unit</th>
                  <th style="width:110px">Rate (₹)</th>
                  <th style="width:80px">GST %</th>
                  <th style="width:110px;text-align:right">Amount</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody id="line-items-tbody">
                ${this.lineItems.map((item, i) => this._renderRow(item, i)).join('')}
              </tbody>
            </table>
          </div>
          ${this.lineItems.length === 0 ? `
          <div class="empty-state-container" style="padding:16px">
            <p class="text-muted text-sm">No items added yet</p>
          </div>
          ` : ''}
        </div>

        <!-- Totals -->
        <div class="bill-totals-card">
          <div class="totals-grid">
            <div class="total-row">
              <span>Subtotal</span>
              <span class="total-value" id="tot-subtotal">${formatINR(totals.subtotal)}</span>
            </div>
            <div class="total-row">
              <span>GST Total</span>
              <span class="total-value" id="tot-gst">${formatINR(totals.gstTotal)}</span>
            </div>
            <div class="total-row grand-total">
              <span>Bill Total</span>
              <span id="tot-total">${formatINR(totals.total)}</span>
            </div>
            ${this.carryForward !== 0 ? `
            <div class="total-row" style="color:var(--color-info)">
              <span>+ Carry Forward</span>
              <span id="tot-carry">${formatINR(this.carryForward)}</span>
            </div>
            ` : ''}
            <div class="total-row outstanding">
              <span>Total Outstanding</span>
              <span id="tot-outstanding">${formatINR(totals.outstanding)}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button class="btn btn-secondary" id="btn-cancel" type="button">Cancel</button>
          <button class="btn btn-primary" id="btn-save" type="button">
            ${this.isEdit ? '💾 Update Bill' : '✅ Create Bill'}
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderRow(item, index) {
    const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
    const gstAmt = amount * ((parseFloat(item.gst_rate) || 0) / 100);
    const lineTotal = amount + gstAmt;

    return `
      <tr data-index="${index}" class="line-item-row">
        <td class="text-muted text-sm">${index + 1}</td>
        <td><input type="text" class="li-desc" data-field="description" value="${this._esc(item.description)}" placeholder="Item description" style="min-width:160px"></td>
        <td><input type="number" class="li-qty" data-field="quantity" value="${item.quantity || 1}" min="0.001" step="0.001" style="width:72px"></td>
        <td><input type="text" class="li-unit" data-field="unit" value="${this._esc(item.unit || 'pcs')}" style="width:60px"></td>
        <td><input type="number" class="li-rate" data-field="rate" value="${item.rate || 0}" min="0" step="0.01" style="width:100px"></td>
        <td><input type="number" class="li-gst" data-field="gst_rate" value="${item.gst_rate || 0}" min="0" max="28" step="0.1" style="width:70px"></td>
        <td class="text-right">
          <span class="line-item-amount" id="li-amount-${index}">${formatINR(lineTotal)}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-danger btn-icon" data-remove="${index}" type="button" title="Remove row">×</button>
        </td>
      </tr>
    `;
  }

  _esc(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _bindEvents() {
    if (!this.element) return;

    // Breadcrumbs
    this.element.querySelector('#bc-customers')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.app.navigateTo('customers');
    });
    this.element.querySelector('#bc-customer')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.app.navigateTo('customer-detail', { customerId: this.customerId });
    });

    // Cancel
    this.element.querySelector('#btn-cancel')?.addEventListener('click', () => {
      this.app.navigateTo('customer-detail', { customerId: this.customerId });
    });

    // Save
    this.element.querySelector('#btn-save')?.addEventListener('click', () => {
      this._handleSave();
    });

    // Add blank row
    this.element.querySelector('#btn-add-row')?.addEventListener('click', () => {
      this._syncLineItemsFromDOM();
      this.lineItems.push({ item_id: null, description: '', quantity: 1, unit: 'pcs', rate: 0, gst_rate: 0 });
      this._renderTbody();
    });

    // Add from master items
    this.element.querySelector('#btn-add-from-master')?.addEventListener('click', () => {
      this._showItemPickerModal();
    });

    // Line item input events (delegated)
    this._bindLineItemEvents();
  }

  _bindLineItemEvents() {
    const tbody = this.element?.querySelector('#line-items-tbody');
    if (!tbody) return;

    tbody.addEventListener('input', (e) => {
      const row = e.target.closest('tr[data-index]');
      if (!row) return;
      this._syncRowFromDOM(row);
      this._updateRowAmount(row);
      this._updateTotalsDisplay();
      if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = setTimeout(() => this._autoSaveBill(true), 800);
    });

    tbody.addEventListener('change', (e) => {
      const row = e.target.closest('tr[data-index]');
      if (!row) return;
      this._syncRowFromDOM(row);
      this._autoSaveBill(true);
    });

    tbody.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove]');
      if (!removeBtn) return;
      e.preventDefault();
      const index = parseInt(removeBtn.dataset.remove);
      this._syncLineItemsFromDOM();
      this.lineItems.splice(index, 1);
      if (this.lineItems.length === 0) {
        this.lineItems.push({ item_id: null, description: '', quantity: 1, unit: 'pcs', rate: 0, gst_rate: 0 });
      }
      this._renderTbody();
      this._autoSaveBill(true);
    });
  }

  _syncLineItemsFromDOM() {
    const tbody = this.element?.querySelector('#line-items-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-index]').forEach((row) => {
      this._syncRowFromDOM(row);
    });
  }

  _syncRowFromDOM(row) {
    const index = parseInt(row.dataset.index);
    if (!this.lineItems[index]) return;
    const desc = row.querySelector('[data-field="description"]');
    const qty  = row.querySelector('[data-field="quantity"]');
    const unit = row.querySelector('[data-field="unit"]');
    const rate = row.querySelector('[data-field="rate"]');
    const gst  = row.querySelector('[data-field="gst_rate"]');
    if (desc) this.lineItems[index].description = desc.value;
    if (qty)  this.lineItems[index].quantity    = parseFloat(qty.value)  || 0;
    if (unit) this.lineItems[index].unit        = unit.value;
    if (rate) this.lineItems[index].rate        = parseFloat(rate.value) || 0;
    if (gst)  this.lineItems[index].gst_rate    = parseFloat(gst.value)  || 0;
  }

  _updateRowAmount(row) {
    const index = parseInt(row.dataset.index);
    const item = this.lineItems[index];
    if (!item) return;
    const amount  = (item.quantity || 0) * (item.rate || 0);
    const gstAmt  = amount * ((item.gst_rate || 0) / 100);
    const total   = amount + gstAmt;
    const amountEl = row.querySelector('.line-item-amount');
    if (amountEl) amountEl.textContent = formatINR(total);
  }

  _calcTotals() {
    let subtotal = 0, gstTotal = 0;
    for (const item of this.lineItems) {
      const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
      const gst    = amount * ((parseFloat(item.gst_rate) || 0) / 100);
      subtotal  += amount;
      gstTotal  += gst;
    }
    const total       = subtotal + gstTotal;
    const outstanding = this.carryForward + total;
    return { subtotal, gstTotal, total, outstanding };
  }

  _updateTotalsDisplay() {
    const totals = this._calcTotals();
    const setEl = (id, val) => {
      const el = this.element?.querySelector(`#${id}`);
      if (el) el.textContent = formatINR(val);
    };
    setEl('tot-subtotal',    totals.subtotal);
    setEl('tot-gst',         totals.gstTotal);
    setEl('tot-total',       totals.total);
    setEl('tot-outstanding', totals.outstanding);
  }

  _renderTbody() {
    const tbody = this.element?.querySelector('#line-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = this.lineItems.map((item, i) => this._renderRow(item, i)).join('');
    this._bindLineItemEvents();
    this._updateTotalsDisplay();
  }

  _showItemPickerModal() {
    const customerItems = Item.getByCustomer(this.customerId);
    const catalogItems  = CatalogItem.getAll();

    if (!customerItems.length && !catalogItems.length) {
      Toast.warning('No items found in catalog or customer master data.');
      return;
    }

    const modal = new Modal({
      title: '📦 Select Item / Spare Part',
      size: 'lg',
      showFooter: false,
      content: `
        <div style="margin-bottom:12px;display:flex;gap:8px">
          <input type="search" id="item-search" placeholder="Search car spare parts or customer items by name, category, HSN…" style="flex:1;padding:8px 12px;border:1.5px solid var(--color-border);border-radius:8px;font-size:14px">
        </div>
        <div class="picker-tabs" style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-sm btn-primary" id="tab-catalog">🔧 Parts Catalog (${catalogItems.length})</button>
          <button class="btn btn-sm btn-secondary" id="tab-customer">👤 Customer Items (${customerItems.length})</button>
        </div>
        <div style="max-height:380px;overflow-y:auto;border:1px solid var(--color-border);border-radius:8px">
          <table class="data-table items-picker-table">
            <thead>
              <tr>
                <th>Item / Spare Part</th>
                <th>Category</th>
                <th>HSN</th>
                <th>Unit</th>
                <th class="text-right">Rate (₹)</th>
                <th class="text-right">GST %</th>
              </tr>
            </thead>
            <tbody id="items-picker-tbody">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      `
    });

    modal.show();

    setTimeout(() => {
      let activeTab = 'catalog'; // 'catalog' or 'customer'
      const searchInput = modal.element?.querySelector('#item-search');
      const tbody = modal.element?.querySelector('#items-picker-tbody');
      const tabCatalog = modal.element?.querySelector('#tab-catalog');
      const tabCustomer = modal.element?.querySelector('#tab-customer');

      const renderRows = () => {
        const q = (searchInput?.value || '').toLowerCase();
        const list = activeTab === 'catalog' ? catalogItems : customerItems;
        const filtered = list.filter(item => {
          const nameMatch = (item.name || '').toLowerCase().includes(q);
          const catMatch  = (item.category || '').toLowerCase().includes(q);
          const hsnMatch  = (item.hsn_code || '').toLowerCase().includes(q);
          return nameMatch || catMatch || hsnMatch;
        });

        if (!filtered.length) {
          tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No items found matching search</td></tr>`;
          return;
        }

        tbody.innerHTML = filtered.map(item => `
          <tr class="clickable-row" data-item='${JSON.stringify({
            item_id: activeTab === 'customer' ? item.id : null,
            catalog_item_id: activeTab === 'catalog' ? item.id : null,
            description: item.name + (item.hsn_code ? ` (HSN: ${item.hsn_code})` : ''),
            quantity: 1,
            unit: item.unit || 'pcs',
            rate: item.rate || 0,
            gst_rate: item.gst_rate || 0
          }).replace(/'/g, '&#39;')}'>
            <td><strong>${item.name}</strong>${item.description ? `<br><small class="text-muted">${item.description}</small>` : ''}</td>
            <td><span class="badge badge-info">${item.category || (activeTab === 'customer' ? 'Customer Item' : 'General')}</span></td>
            <td class="text-muted">${item.hsn_code || '—'}</td>
            <td>${item.unit || 'pcs'}</td>
            <td class="text-right fw-600">${formatINR(item.rate || 0)}</td>
            <td class="text-right">${item.gst_rate || 0}%</td>
          </tr>
        `).join('');

        // Bind click selection
        tbody.querySelectorAll('tr[data-item]').forEach(row => {
          row.addEventListener('click', () => {
            try {
              const itemData = JSON.parse(row.dataset.item);
              this._syncLineItemsFromDOM();

              const lastItem = this.lineItems[this.lineItems.length - 1];
              if (lastItem && !lastItem.description && !lastItem.rate) {
                this.lineItems[this.lineItems.length - 1] = itemData;
              } else {
                this.lineItems.push(itemData);
              }

              modal.hide(true);
              this._renderTbody();
              this._autoSaveBill(false);
            } catch (e) {
              console.error('Item parse error', e);
            }
          });
        });
      };

      tabCatalog?.addEventListener('click', () => {
        activeTab = 'catalog';
        tabCatalog.className = 'btn btn-sm btn-primary';
        tabCustomer.className = 'btn btn-sm btn-secondary';
        renderRows();
      });

      tabCustomer?.addEventListener('click', () => {
        activeTab = 'customer';
        tabCustomer.className = 'btn btn-sm btn-primary';
        tabCatalog.className = 'btn btn-sm btn-secondary';
        renderRows();
      });

      searchInput?.addEventListener('input', renderRows);

      renderRows();
    }, 50);
  }

  _getBillMeta() {
    let billNumber = this.element?.querySelector('#inp-bill-number')?.value?.trim();
    let billDate   = this.element?.querySelector('#inp-bill-date')?.value;
    const notes    = this.element?.querySelector('#inp-notes')?.value || '';
    return { billNumber, billDate, notes };
  }

  /**
   * Auto-save bill into SQLite DB & CSV file in data/ directory
   */
  _autoSaveBill(silent = true) {
    this._syncLineItemsFromDOM();
    let { billNumber, billDate, notes } = this._getBillMeta();

    if (!billNumber) {
      billNumber = Bill.generateBillNumber(this.customerId);
      this.billNumber = billNumber;
      const inpNum = this.element?.querySelector('#inp-bill-number');
      if (inpNum) inpNum.value = billNumber;
    }

    if (!billDate) {
      billDate = todayISO();
      this.billDate = billDate;
      const inpDate = this.element?.querySelector('#inp-bill-date');
      if (inpDate) inpDate.value = billDate;
    }

    const validItems = this.lineItems.filter(item => item.description && (item.rate > 0 || item.quantity > 0));
    if (validItems.length === 0) return;

    const billData = {
      customer_id:   this.customerId,
      bill_number:   billNumber,
      bill_date:     billDate,
      notes:         notes,
      carry_forward: this.isEdit ? this.carryForward : undefined
    };

    try {
      if (this.isEdit && this.billId) {
        Bill.update(this.billId, { ...billData, carry_forward: this.carryForward, paid: 0 }, validItems);
        db.save();
        exportSingleBillCSV(this.billId);
        exportCustomerBillsCSV(this.customerId);
        if (!silent) Toast.success('Bill auto-saved as item added');
      } else {
        const created = Bill.create(billData, validItems);
        db.save();
        if (created && created.id) {
          this.billId = created.id;
          this.isEdit = true;
          exportSingleBillCSV(this.billId);
          exportCustomerBillsCSV(this.customerId);
          if (!silent) Toast.success('Bill created & auto-saved');
        }
      }
    } catch (err) {
      console.warn('[Auto-Save] Error saving bill:', err);
    }
  }

  _handleSave() {
    // Sync state from DOM before saving
    this._syncLineItemsFromDOM();

    const { billNumber, billDate, notes } = this._getBillMeta();

    // Validate
    const errors = [];
    if (!billNumber) errors.push('Bill Number is required');
    if (!billDate)   errors.push('Bill Date is required');

    const validItems = this.lineItems.filter(item => item.description && item.rate > 0);
    if (validItems.length === 0) errors.push('At least one line item with description and rate is required');

    if (errors.length > 0) {
      Toast.error(errors[0]);
      return;
    }

    const billData = {
      customer_id:  this.customerId,
      bill_number:  billNumber,
      bill_date:    billDate,
      notes:        notes,
      carry_forward: this.isEdit ? this.carryForward : undefined
    };

    try {
      let currentBillId = this.billId;
      if (this.isEdit && this.billId) {
        Bill.update(this.billId, { ...billData, carry_forward: this.carryForward, paid: 0 }, validItems);
        db.save();
      } else {
        const created = Bill.create(billData, validItems);
        db.save();
        currentBillId = created.id;
      }

      if (currentBillId) {
        exportSingleBillCSV(currentBillId);
        exportCustomerBillsCSV(this.customerId);
      }

      Toast.success(this.isEdit ? 'Bill updated successfully' : 'Bill created successfully');
      this.app.navigateTo('customer-detail', { customerId: this.customerId });
    } catch (err) {
      console.error('Save bill error:', err);
      Toast.error('Failed to save bill: ' + err.message);
    }
  }

  refresh() {
    this._initState();
    this._render();
  }
}