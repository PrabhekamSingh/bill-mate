/**
 * Customer Detail View
 * Shows customer ledger with bills, payments, and items tabs
 */

import { Customer } from '../models/Customer.js';
import { Bill } from '../models/Bill.js';
import { Payment } from '../models/Payment.js';
import { Item } from '../models/Item.js';
import { db } from '../db/database.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';
import { formatDate, formatDateISO, todayISO } from '../utils/date.js';
import { validateForm, rules } from '../utils/validation.js';
import { exportCustomerLedgerCSV, exportCustomerBillsCSV } from '../utils/export.js';

export class CustomerDetailView {
  constructor(app, customerId) {
    this.app = app;
    this.customerId = parseInt(customerId);
    this.element = null;
    this.activeTab = 'bills';
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;

    const customer = Customer.getWithBalance(this.customerId);
    if (!customer) {
      this.element.innerHTML = `<div class="empty-state-container"><h3>Customer not found</h3></div>`;
      return;
    }

    const balance = customer.current_balance || 0;
    const balanceClass = balance > 0 ? 'text-negative' : (balance < 0 ? 'text-positive' : 'text-zero');

    this.element.innerHTML = `
      <div class="customer-detail-view">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a href="#" id="back-to-customers">Customers</a>
          <span class="sep">/</span>
          <span>${customer.name}</span>
        </div>

        <!-- Customer Info Card -->
        <div class="customer-info-card">
          <div class="customer-info-grid">
            <div>
              <h2 style="margin:0 0 8px">${customer.name}</h2>
              <div class="customer-meta">
                ${customer.phone ? `<span>📞 ${customer.phone}</span>` : ''}
                ${customer.email ? `<span>✉️ ${customer.email}</span>` : ''}
                ${customer.address ? `<span>📍 ${customer.address}</span>` : ''}
                ${customer.city ? `<span>🏙️ ${customer.city}</span>` : ''}
              </div>
            </div>
            <div style="text-align:right">
              <div class="text-xs text-muted" style="margin-bottom:4px">Current Balance</div>
              <div class="customer-balance-badge ${balanceClass}">${formatINR(balance)}</div>
              ${balance > 0 ? `<div class="text-xs text-negative" style="margin-top:4px">Amount Due</div>` : ''}
            </div>
          </div>
          <div class="header-actions" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--color-border)">
            <button class="btn btn-primary" id="btn-new-bill">+ New Bill</button>
            <button class="btn btn-secondary" id="btn-record-payment">Record Payment</button>
            <button class="btn btn-secondary" id="btn-edit-customer">Edit</button>
            <button class="btn btn-secondary" id="btn-export-bills">📥 Export Bills CSV</button>
            <button class="btn btn-secondary" id="btn-export-ledger">Export Ledger</button>
            <button class="btn btn-danger" id="btn-delete-customer">Delete</button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container">
          <nav class="customer-tabs" role="tablist">
            <button class="tab-btn ${this.activeTab === 'bills' ? 'active' : ''}" data-tab="bills" role="tab">
              Bills (${Bill.getByCustomer(this.customerId).length})
            </button>
            <button class="tab-btn ${this.activeTab === 'payments' ? 'active' : ''}" data-tab="payments" role="tab">
              Payments (${Payment.getByCustomer(this.customerId).length})
            </button>
            <button class="tab-btn ${this.activeTab === 'items' ? 'active' : ''}" data-tab="items" role="tab">
              Master Items (${Item.getByCustomer(this.customerId).length})
            </button>
          </nav>
          <div class="tab-content">
            ${this._renderTabContent()}
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderTabContent() {
    switch (this.activeTab) {
      case 'bills':    return this._renderBillsTab();
      case 'payments': return this._renderPaymentsTab();
      case 'items':    return this._renderItemsTab();
      default:         return this._renderBillsTab();
    }
  }

  _renderBillsTab() {
    const bills = Bill.getByCustomer(this.customerId);
    if (!bills.length) {
      return `
        <div class="empty-state-container">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <h3>No bills yet</h3>
          <p>Create the first bill for this customer</p>
          <button class="btn btn-primary" id="btn-new-bill-empty">+ New Bill</button>
        </div>
      `;
    }

    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Date</th>
              <th class="text-right">Subtotal</th>
              <th class="text-right">GST</th>
              <th class="text-right">Total</th>
              <th class="text-right">Carry Fwd</th>
              <th class="text-right">Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${bills.map(b => `
              <tr>
                <td><strong>${b.bill_number}</strong></td>
                <td>${formatDate(b.bill_date)}</td>
                <td class="text-right">${formatINR(b.subtotal)}</td>
                <td class="text-right">${formatINR(b.gst_total)}</td>
                <td class="text-right fw-600">${formatINR(b.total)}</td>
                <td class="text-right text-muted">${formatINR(b.carry_forward)}</td>
                <td class="text-right ${b.balance > 0 ? 'text-negative' : 'text-positive'}">${formatINR(b.balance)}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" data-action="edit-bill" data-id="${b.id}" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-bill" data-id="${b.id}" title="Delete">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderPaymentsTab() {
    const payments = Payment.getByCustomer(this.customerId);
    if (!payments.length) {
      return `
        <div class="empty-state-container">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <h3>No payments yet</h3>
          <p>Record a payment received from this customer</p>
          <button class="btn btn-primary" id="btn-payment-empty">Record Payment</button>
        </div>
      `;
    }

    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Amount</th>
              <th>Mode</th>
              <th>Reference</th>
              <th>Bill #</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${formatDate(p.payment_date)}</td>
                <td class="text-right text-positive fw-600">${formatINR(p.amount)}</td>
                <td><span class="badge badge-info">${p.mode || 'cash'}</span></td>
                <td class="text-muted">${p.reference || '—'}</td>
                <td class="text-muted">${p.bill_number || '—'}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" data-action="edit-payment" data-id="${p.id}" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-payment" data-id="${p.id}" title="Delete">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderItemsTab() {
    const items = Item.getByCustomer(this.customerId);
    if (!items.length) {
      return `
        <div class="empty-state-container">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <h3>No master items</h3>
          <p>Add items to quickly add them to bills</p>
          <button class="btn btn-primary" id="btn-items-manage">Manage Items</button>
        </div>
      `;
    }

    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary btn-sm" id="btn-items-manage">Manage Items</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Unit</th>
              <th class="text-right">Rate</th>
              <th class="text-right">GST %</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.unit}</td>
                <td class="text-right">${formatINR(item.rate)}</td>
                <td class="text-right">${item.gst_rate}%</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" data-action="edit-item" data-id="${item.id}" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-item" data-id="${item.id}" title="Delete">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindEvents() {
    if (!this.element) return;

    // Navigation
    this.element.querySelector('#back-to-customers')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.app.navigateTo('customers');
    });

    // Tab switching
    this.element.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this._render();
      });
    });

    // Header action buttons
    this.element.querySelector('#btn-new-bill')?.addEventListener('click', () => {
      this.app.navigateTo('bill-create', { customerId: this.customerId });
    });

    this.element.querySelector('#btn-new-bill-empty')?.addEventListener('click', () => {
      this.app.navigateTo('bill-create', { customerId: this.customerId });
    });

    this.element.querySelector('#btn-record-payment')?.addEventListener('click', () => {
      this._showPaymentModal();
    });

    this.element.querySelector('#btn-payment-empty')?.addEventListener('click', () => {
      this._showPaymentModal();
    });

    this.element.querySelector('#btn-edit-customer')?.addEventListener('click', () => {
      this._showEditCustomerModal();
    });

    this.element.querySelector('#btn-export-bills')?.addEventListener('click', () => {
      try {
        exportCustomerBillsCSV(this.customerId, true);
        Toast.success('Customer bills exported & saved to data/ directory');
      } catch (e) {
        Toast.error('Export failed: ' + e.message);
      }
    });

    this.element.querySelector('#btn-export-ledger')?.addEventListener('click', () => {
      try {
        exportCustomerLedgerCSV(this.customerId);
        Toast.success('Ledger exported');
      } catch (e) {
        Toast.error('Export failed: ' + e.message);
      }
    });

    this.element.querySelector('#btn-delete-customer')?.addEventListener('click', () => {
      this._confirmDeleteCustomer();
    });

    this.element.querySelector('#btn-items-manage')?.addEventListener('click', () => {
      this.app.navigateTo('items', { customerId: this.customerId });
    });

    // Bill actions
    this.element.querySelectorAll('[data-action="edit-bill"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const billId = parseInt(btn.dataset.id);
        this.app.navigateTo('bill-create', { customerId: this.customerId, billId });
      });
    });

    this.element.querySelectorAll('[data-action="delete-bill"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const billId = parseInt(btn.dataset.id);
        const confirmed = await Modal.confirm('Delete this bill? This cannot be undone.', 'Delete Bill');
        if (!confirmed) return;
          try {
              Bill.delete(billId);
              db.save();
              Toast.success('Bill deleted');
              this._render();
            } catch (err) {
          Toast.error('Delete failed: ' + err.message);
        }
      });
    });

    // Payment actions
    this.element.querySelectorAll('[data-action="edit-payment"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const paymentId = parseInt(btn.dataset.id);
        const payment = Payment.getById(paymentId);
        if (payment) this._showPaymentModal(payment);
      });
    });

    this.element.querySelectorAll('[data-action="delete-payment"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const paymentId = parseInt(btn.dataset.id);
        const confirmed = await Modal.confirm('Delete this payment record?', 'Delete Payment');
        if (!confirmed) return;
        try {
          Payment.delete(paymentId);
          Toast.success('Payment deleted');
          this._render();
        } catch (err) {
          Toast.error('Delete failed: ' + err.message);
        }
      });
    });

    // Item actions
    this.element.querySelectorAll('[data-action="edit-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = parseInt(btn.dataset.id);
        this._showItemModal(itemId);
      });
    });

    this.element.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = parseInt(btn.dataset.id);
        const confirmed = await Modal.confirm('Delete this master item?', 'Delete Item');
        if (!confirmed) return;
        try {
          Item.delete(itemId);
          Toast.success('Item deleted');
          this._render();
        } catch (err) {
          Toast.error('Delete failed: ' + err.message);
        }
      });
    });
  }

  // ============================================================
  // MODALS
  // ============================================================

  _showPaymentModal(existingPayment = null) {
    const isEdit = !!existingPayment;
    const customer = Customer.getById(this.customerId);
    const bills = Bill.getByCustomer(this.customerId);

    const modal = new Modal({
      title: isEdit ? 'Edit Payment' : 'Record Payment',
      size: 'md',
      confirmText: isEdit ? 'Update' : 'Record',
      cancelText: 'Cancel',
      content: `
        <form id="payment-form" class="form" novalidate>
          <div class="form-group">
            <label>Amount (₹) *</label>
            <input type="number" name="amount" min="0.01" step="0.01"
              value="${existingPayment?.amount || ''}" placeholder="0.00" required>
          </div>
          <div class="form-group">
            <label>Payment Date *</label>
            <input type="date" name="payment_date"
              value="${existingPayment ? formatDateISO(existingPayment.payment_date) : todayISO()}" required>
          </div>
          <div class="form-group">
            <label>Payment Mode</label>
            <div class="payment-mode-grid">
              ${['cash','upi','bank','cheque'].map(m => `
                <button type="button" class="payment-mode-btn ${(!existingPayment && m === 'cash') || existingPayment?.mode === m ? 'active' : ''}"
                  data-mode="${m}">${m.toUpperCase()}</button>
              `).join('')}
            </div>
            <input type="hidden" name="mode" value="${existingPayment?.mode || 'cash'}">
          </div>
          <div class="form-group">
            <label>Reference / Cheque No.</label>
            <input type="text" name="reference" value="${existingPayment?.reference || ''}" placeholder="Optional reference">
          </div>
          ${bills.length > 0 ? `
          <div class="form-group">
            <label>Link to Bill (optional)</label>
            <select name="bill_id">
              <option value="">— Not linked —</option>
              ${bills.map(b => `<option value="${b.id}" ${existingPayment?.bill_id === b.id ? 'selected' : ''}>${b.bill_number} (${formatINR(b.total)})</option>`).join('')}
            </select>
          </div>
          ` : ''}
          <div class="form-group">
            <label>Notes</label>
            <textarea name="notes" rows="2" placeholder="Optional notes">${existingPayment?.notes || ''}</textarea>
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#payment-form');
        const fd = new FormData(form);
        const data = {
          customer_id: this.customerId,
          amount: parseFloat(fd.get('amount')),
          payment_date: fd.get('payment_date'),
          mode: fd.get('mode') || 'cash',
          reference: fd.get('reference') || '',
          notes: fd.get('notes') || '',
          bill_id: fd.get('bill_id') ? parseInt(fd.get('bill_id')) : null
        };

        const v = validateForm(data, {
          amount:       [v => rules.paymentAmount[0](v), v => rules.paymentAmount[1](v)],
          payment_date: [v => rules.paymentDate[0](v)]
        });

        if (!v.isValid) {
          Object.entries(v.errors).forEach(([field, msg]) => {
            const el = form.querySelector(`[name="${field}"]`);
            if (el) this._showFieldError(el, msg);
          });
          return false;
        }

        try {
          if (isEdit) {
            Payment.update(existingPayment.id, data);
            Toast.success('Payment updated');
          } else {
            Payment.create(data);
            Toast.success('Payment recorded');
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

    // Bind payment mode buttons after modal shows
    setTimeout(() => {
      const modeInput = modal.element?.querySelector('[name="mode"]');
      modal.element?.querySelectorAll('.payment-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.element.querySelectorAll('.payment-mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (modeInput) modeInput.value = btn.dataset.mode;
        });
      });
      modal.element?.querySelector('input[name="amount"]')?.focus();
    }, 50);
  }

  _showEditCustomerModal() {
    const customer = Customer.getById(this.customerId);
    if (!customer) return;

    const modal = new Modal({
      title: 'Edit Customer',
      size: 'md',
      confirmText: 'Update',
      cancelText: 'Cancel',
      content: `
        <form id="customer-edit-form" class="form" novalidate>
          <div class="form-group">
            <label>Name *</label>
            <input type="text" name="name" value="${customer.name || ''}" required placeholder="Customer name">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" name="phone" value="${customer.phone || ''}" placeholder="Phone number">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" value="${customer.email || ''}" placeholder="email@example.com">
            </div>
          </div>
          <div class="form-group">
            <label>Address</label>
            <textarea name="address" rows="2" placeholder="Full address">${customer.address || ''}</textarea>
          </div>
          <div class="form-group">
            <label>City</label>
            <input type="text" name="city" value="${customer.city || ''}" placeholder="City">
          </div>
          <div class="form-group">
            <label>Opening Balance (₹)</label>
            <input type="number" name="opening_balance" step="0.01" value="${customer.opening_balance || 0}" placeholder="0.00">
            <small class="form-help">Positive = customer owes you; Negative = you owe customer</small>
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#customer-edit-form');
        const fd = new FormData(form);
        const data = {
          name: fd.get('name'),
          phone: fd.get('phone') || null,
          email: fd.get('email') || null,
          address: fd.get('address') || null,
          city: fd.get('city') || null,
          opening_balance: parseFloat(fd.get('opening_balance')) || 0
        };

        const v = validateForm(data, {
          name:  [v => rules.customerName[0](v), v => rules.customerName[1](v)],
          phone: [v => rules.customerPhone[0](v)],
          email: [v => rules.customerEmail[0](v)]
        });

        if (!v.isValid) {
          Object.entries(v.errors).forEach(([field, msg]) => {
            const el = form.querySelector(`[name="${field}"]`);
            if (el) this._showFieldError(el, msg);
          });
          return false;
        }

        try {
          Customer.update(this.customerId, data);
          Toast.success('Customer updated');
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

  _showItemModal(itemId = null) {
    const isEdit = !!itemId;
    const item = isEdit ? Item.getById(itemId) : {};

    const modal = new Modal({
      title: isEdit ? 'Edit Item' : 'Add Master Item',
      size: 'md',
      confirmText: isEdit ? 'Update' : 'Add',
      cancelText: 'Cancel',
      content: `
        <form id="item-form-detail" class="form" novalidate>
          <div class="form-group">
            <label>Item Name *</label>
            <input type="text" name="name" value="${item?.name || ''}" required placeholder="Item name">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Unit</label>
              <input type="text" name="unit" value="${item?.unit || 'pcs'}" placeholder="pcs">
            </div>
            <div class="form-group">
              <label>Default Rate (₹)</label>
              <input type="number" name="rate" step="0.01" min="0" value="${item?.rate || 0}" placeholder="0.00">
            </div>
          </div>
          <div class="form-group">
            <label>GST Rate %</label>
            <input type="number" name="gst_rate" step="0.1" min="0" max="28" value="${item?.gst_rate || 0}" placeholder="0">
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#item-form-detail');
        const fd = new FormData(form);
        const data = {
          customer_id: this.customerId,
          name: fd.get('name'),
          unit: fd.get('unit') || 'pcs',
          rate: parseFloat(fd.get('rate')) || 0,
          gst_rate: parseFloat(fd.get('gst_rate')) || 0
        };

        const v = validateForm(data, {
          name: [v => rules.itemName[0](v), v => rules.itemName[1](v)]
        });

        if (!v.isValid) {
          Object.entries(v.errors).forEach(([field, msg]) => {
            const el = form.querySelector(`[name="${field}"]`);
            if (el) this._showFieldError(el, msg);
          });
          return false;
        }

        try {
          if (isEdit) { Item.update(itemId, data); Toast.success('Item updated'); }
          else        { Item.create(data);          Toast.success('Item added');   }
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

  async _confirmDeleteCustomer() {
    const confirmed = await Modal.confirm(
      'Delete this customer and ALL associated bills, items, and payments? This cannot be undone.',
      'Delete Customer'
    );
    if (!confirmed) return;
    try {
      Customer.delete(this.customerId);
      Toast.success('Customer deleted');
      this.app.navigateTo('customers');
    } catch (err) {
      Toast.error('Delete failed: ' + err.message);
    }
  }

  _showFieldError(field, message) {
    field.classList.add('error');
    const existing = field.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    field.parentNode.appendChild(errorEl);
  }

  refresh() {
    this._render();
  }
}
