/**
 * Payments View
 * Manages customer payments with Customer and All views
 */

import { Payment } from '../models/Payment.js';
import { Customer } from '../models/Customer.js';
import { Bill } from '../models/Bill.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';
import { formatDate, formatDateISO, todayISO } from '../utils/date.js';
import { validateForm, rules } from '../utils/validation.js';

export class PaymentsView {
  constructor(app) {
    this.app = app;
    this.element = null;
    this.activeTab = 'customer'; // 'customer' or 'all'
    this.selectedCustomerId = null;
    this.searchQuery = '';
    this.modeFilter = '';
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;

    const customers = Customer.getAll();
    if (!this.selectedCustomerId && customers.length > 0) {
      this.selectedCustomerId = customers[0].id;
    }

    const allPayments = Payment.getAllWithCustomer();
    const totalCollected = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const cashCollected = allPayments.filter(p => p.mode === 'cash').reduce((sum, p) => sum + (p.amount || 0), 0);
    const digitalCollected = totalCollected - cashCollected;

    this.element.innerHTML = `
      <div class="payments-view">
        <!-- Header -->
        <div class="view-header">
          <div>
            <h2 style="margin:0 0 4px">💳 Payments Management</h2>
            <p style="margin:0;color:var(--color-text-secondary);font-size:var(--font-size-sm)">
              Record and track payments received against customers
            </p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" id="btn-record-payment-main">+ Record Payment</button>
          </div>
        </div>

        <!-- Quick Summary Stats -->
        <div class="payments-stats" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:20px">
          <div class="card quick-stat">
            <span class="quick-stat-label">Total Payments Received</span>
            <span class="quick-stat-value text-positive">${formatINR(totalCollected)}</span>
            <span class="text-xs text-muted">${allPayments.length} transactions recorded</span>
          </div>
          <div class="card quick-stat">
            <span class="quick-stat-label">Cash Received</span>
            <span class="quick-stat-value">${formatINR(cashCollected)}</span>
            <span class="text-xs text-muted">Physical cash</span>
          </div>
          <div class="card quick-stat">
            <span class="quick-stat-label">Digital (UPI/Bank/Cheque)</span>
            <span class="quick-stat-value text-info">${formatINR(digitalCollected)}</span>
            <span class="text-xs text-muted">Online & cheques</span>
          </div>
        </div>

        <!-- 2 Main Tabs: Customer vs All -->
        <div class="card" style="padding:0;overflow:hidden">
          <div class="view-tabs-header" style="display:flex;border-bottom:1px solid var(--color-border);background:var(--color-surface);padding:8px 16px 0;gap:8px">
            <button class="tab-btn ${this.activeTab === 'customer' ? 'active' : ''}" data-tab="customer" style="padding:10px 20px;font-weight:600;display:flex;align-items:center;gap:8px">
              👤 Customer Payments
            </button>
            <button class="tab-btn ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all" style="padding:10px 20px;font-weight:600;display:flex;align-items:center;gap:8px">
              🌐 All Payments (${allPayments.length})
            </button>
          </div>

          <div class="view-tab-content" style="padding:20px">
            ${this.activeTab === 'customer' ? this._renderCustomerTab(customers) : this._renderAllTab(allPayments)}
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderCustomerTab(customers) {
    if (!customers.length) {
      return `
        <div class="empty-state-container">
          <h3>No customers found</h3>
          <p>Add customers to record payments against them</p>
          <button class="btn btn-primary" id="btn-goto-add-customer">+ Add Customer</button>
        </div>
      `;
    }

    const currentCustomer = Customer.getWithBalance(this.selectedCustomerId) || customers[0];
    const customerPayments = currentCustomer ? Payment.getByCustomer(currentCustomer.id) : [];

    return `
      <div class="customer-payments-panel">
        <!-- Customer selector & header -->
        <div class="customer-select-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;background:#f8fafc;padding:16px;border-radius:10px;border:1px solid var(--color-border);margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:280px">
            <label style="font-weight:600;white-space:nowrap">Select Customer:</label>
            <select id="pay-customer-select" class="form-control" style="max-width:320px;padding:8px 12px;border:1.5px solid var(--color-border);border-radius:8px">
              ${customers.map(c => `<option value="${c.id}" ${c.id === currentCustomer?.id ? 'selected' : ''}>${c.name} ${c.city ? `(${c.city})` : ''}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:16px">
            <div>
              <span class="text-xs text-muted" style="display:block">Current Balance</span>
              <strong class="${(currentCustomer?.current_balance || 0) > 0 ? 'text-negative' : 'text-positive'}" style="font-size:18px">
                ${formatINR(currentCustomer?.current_balance || 0)}
              </strong>
            </div>
            <button class="btn btn-primary" id="btn-record-for-customer" data-customer-id="${currentCustomer?.id}">
              + Record Payment for ${currentCustomer?.name}
            </button>
          </div>
        </div>

        <!-- Payments Table for Customer -->
        ${customerPayments.length === 0 ? `
          <div class="empty-state-container">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <h3>No payments recorded for ${currentCustomer?.name}</h3>
            <p>Record a payment received from this customer</p>
            <button class="btn btn-primary" id="btn-record-empty" data-customer-id="${currentCustomer?.id}">+ Record Payment</button>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-right">Amount (₹)</th>
                  <th>Payment Mode</th>
                  <th>Reference / Cheque</th>
                  <th>Linked Bill #</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${customerPayments.map(p => `
                  <tr>
                    <td><strong>${formatDate(p.payment_date)}</strong></td>
                    <td class="text-right text-positive fw-600">${formatINR(p.amount)}</td>
                    <td><span class="badge badge-info" style="text-transform:uppercase">${p.mode || 'cash'}</span></td>
                    <td class="text-muted">${p.reference || '—'}</td>
                    <td>${p.bill_number ? `<span class="badge badge-secondary">${p.bill_number}</span>` : '—'}</td>
                    <td class="text-muted">${p.notes || '—'}</td>
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
        `}
      </div>
    `;
  }

  _renderAllTab(allPayments) {
    const filtered = allPayments.filter(p => {
      const matchesSearch = !this.searchQuery ||
        (p.customer_name || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (p.reference || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (p.bill_number || '').toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesMode = !this.modeFilter || p.mode === this.modeFilter;
      return matchesSearch && matchesMode;
    });

    return `
      <div class="all-payments-panel">
        <!-- Search & Filter Controls -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
          <div class="search-input-wrapper" style="max-width:360px">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="search" class="search-input" id="payment-search" placeholder="Search customer, ref, bill #..." value="${this._esc(this.searchQuery)}">
          </div>

          <div class="mode-chips" style="display:flex;gap:6px">
            ${['', 'cash', 'upi', 'bank', 'cheque'].map(m => `
              <button class="btn btn-sm ${this.modeFilter === m ? 'btn-primary' : 'btn-secondary'}" data-mode-filter="${m}">
                ${m === '' ? 'All Modes' : m.toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Table -->
        ${filtered.length === 0 ? `
          <div class="empty-state-container">
            <p>No payments found matching criteria</p>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th class="text-right">Amount (₹)</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Bill #</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(p => `
                  <tr>
                    <td><strong>${formatDate(p.payment_date)}</strong></td>
                    <td>
                      <a href="#" class="customer-link" data-customer-id="${p.customer_id}" style="font-weight:600;color:var(--color-primary)">
                        👤 ${this._esc(p.customer_name)}
                      </a>
                    </td>
                    <td class="text-right text-positive fw-600">${formatINR(p.amount)}</td>
                    <td><span class="badge badge-info" style="text-transform:uppercase">${p.mode || 'cash'}</span></td>
                    <td class="text-muted">${p.reference || '—'}</td>
                    <td>${p.bill_number ? `<span class="badge badge-secondary">${p.bill_number}</span>` : '—'}</td>
                    <td class="text-muted">${p.notes || '—'}</td>
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
        `}
      </div>
    `;
  }

  _bindEvents() {
    if (!this.element) return;

    // Record Payment main button
    this.element.querySelector('#btn-record-payment-main')?.addEventListener('click', () => {
      this._showPaymentModal();
    });

    // Navigation Tab switching
    this.element.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this._render();
      });
    });

    // Customer Select dropdown in Customer Tab
    const custSelect = this.element.querySelector('#pay-customer-select');
    if (custSelect) {
      custSelect.addEventListener('change', (e) => {
        this.selectedCustomerId = parseInt(e.target.value);
        this._render();
      });
    }

    // Record payment for specific customer buttons
    this.element.querySelector('#btn-record-for-customer')?.addEventListener('click', (e) => {
      const cid = parseInt(e.currentTarget.dataset.customerId);
      this._showPaymentModal(cid);
    });

    this.element.querySelector('#btn-record-empty')?.addEventListener('click', (e) => {
      const cid = parseInt(e.currentTarget.dataset.customerId);
      this._showPaymentModal(cid);
    });

    this.element.querySelector('#btn-goto-add-customer')?.addEventListener('click', () => {
      this.app.navigateTo('customers');
    });

    // Customer link click
    this.element.querySelectorAll('.customer-link[data-customer-id]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const cid = parseInt(link.dataset.customerId);
        this.app.navigateTo('customer-detail', { customerId: cid });
      });
    });

    // Search input in All Tab
    const searchInput = this.element.querySelector('#payment-search');
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

    // Mode filter buttons
    this.element.querySelectorAll('[data-mode-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.modeFilter = btn.dataset.modeFilter;
        this._render();
      });
    });

    // Action buttons (edit / delete payment)
    this.element.querySelectorAll('[data-action="edit-payment"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = parseInt(btn.dataset.id);
        const payment = Payment.getById(pid);
        if (payment) this._showPaymentModal(payment.customer_id, payment);
      });
    });

    this.element.querySelectorAll('[data-action="delete-payment"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pid = parseInt(btn.dataset.id);
        const confirmed = await Modal.confirm('Delete this payment record?', 'Confirm Delete');
        if (!confirmed) return;
        try {
          Payment.delete(pid);
          Toast.success('Payment deleted');
          this._render();
        } catch (err) {
          Toast.error('Delete failed: ' + err.message);
        }
      });
    });
  }

  _showPaymentModal(defaultCustomerId = null, existingPayment = null) {
    const isEdit = !!existingPayment;
    const customers = Customer.getAll();
    if (!customers.length) {
      Toast.warning('Please add a customer first');
      this.app.navigateTo('customers');
      return;
    }

    const selectedCid = existingPayment ? existingPayment.customer_id : (defaultCustomerId || this.selectedCustomerId || customers[0].id);
    const bills = Bill.getByCustomer(selectedCid);

    const modal = new Modal({
      title: isEdit ? 'Edit Payment' : 'Record Payment',
      size: 'md',
      confirmText: isEdit ? 'Update Payment' : 'Record Payment',
      cancelText: 'Cancel',
      content: `
        <form id="payment-modal-form" class="form" novalidate>
          <div class="form-group">
            <label>Customer *</label>
            <select name="customer_id" id="modal-cust-select" required ${isEdit ? 'disabled' : ''}>
              ${customers.map(c => `<option value="${c.id}" ${c.id === selectedCid ? 'selected' : ''}>${c.name} ${c.city ? `(${c.city})` : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Amount (₹) *</label>
              <input type="number" name="amount" min="0.01" step="0.01" value="${existingPayment?.amount || ''}" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label>Payment Date *</label>
              <input type="date" name="payment_date" value="${existingPayment ? formatDateISO(existingPayment.payment_date) : todayISO()}" required>
            </div>
          </div>
          <div class="form-group">
            <label>Payment Mode</label>
            <div class="payment-mode-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px">
              ${['cash','upi','bank','cheque'].map(m => `
                <button type="button" class="payment-mode-btn ${(!existingPayment && m === 'cash') || existingPayment?.mode === m ? 'active' : ''}"
                  data-mode="${m}" style="padding:8px;border:1px solid var(--color-border);border-radius:6px;font-weight:600">${m.toUpperCase()}</button>
              `).join('')}
            </div>
            <input type="hidden" name="mode" value="${existingPayment?.mode || 'cash'}">
          </div>
          <div class="form-group">
            <label>Reference / Cheque No.</label>
            <input type="text" name="reference" value="${existingPayment?.reference || ''}" placeholder="Transaction ref or cheque #">
          </div>
          <div class="form-group" id="modal-bill-group">
            <label>Link to Bill (optional)</label>
            <select name="bill_id">
              <option value="">— Not linked —</option>
              ${bills.map(b => `<option value="${b.id}" ${existingPayment?.bill_id === b.id ? 'selected' : ''}>${b.bill_number} (${formatINR(b.total)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea name="notes" rows="2" placeholder="Optional notes">${existingPayment?.notes || ''}</textarea>
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#payment-modal-form');
        const fd = new FormData(form);
        const cid = parseInt(fd.get('customer_id')) || selectedCid;
        const data = {
          customer_id: cid,
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
            if (el) {
              el.classList.add('error');
              const err = document.createElement('span');
              err.className = 'field-error';
              err.textContent = msg;
              el.parentNode.appendChild(err);
            }
          });
          return false;
        }

        try {
          if (isEdit) {
            Payment.update(existingPayment.id, data);
            Toast.success('Payment updated');
          } else {
            Payment.create(data);
            Toast.success('Payment recorded successfully');
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

    // Bind mode selector buttons
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

  _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  refresh() {
    this._render();
  }
}
