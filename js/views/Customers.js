/**
 * Customers View
 * Customer list with search and management
 */

import { Customer } from '../models/Customer.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';
import { validateForm, rules } from '../utils/validation.js';

export class CustomersView {
  constructor(app) {
    this.app = app;
    this.element = null;
    this.searchQuery = '';
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;
    const customers = Customer.getAllWithBalances();
    const filtered = this.searchQuery
      ? customers.filter(c =>
          c.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          (c.phone || '').includes(this.searchQuery) ||
          (c.email || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          (c.city || '').toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      : customers;

    this.element.innerHTML = `
      <div class="customers-view">
        <div class="view-header">
          <h2>Customers <span class="badge badge-primary" style="font-size:14px;font-weight:700">${customers.length}</span></h2>
          <div class="header-actions">
            <button class="btn btn-primary" id="btn-add-customer" type="button">+ Add Customer</button>
          </div>
        </div>

        <div class="customers-table-card">
          <!-- Search bar -->
          <div class="search-bar">
            <div class="search-input-wrapper">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="search" class="search-input" id="customer-search"
                placeholder="Search by name, phone, email or city…"
                value="${this._esc(this.searchQuery)}">
            </div>
          </div>

          <!-- Table / Empty state -->
          ${filtered.length === 0 ? this._renderEmpty(customers.length === 0) : this._renderTable(filtered)}
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderEmpty(noCustomers) {
    if (noCustomers) {
      return `
        <div class="empty-state-container">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h3>No customers yet</h3>
          <p>Add your first customer to get started</p>
          <button class="btn btn-primary" id="btn-add-customer-empty">+ Add Customer</button>
        </div>
      `;
    }
    return `<div class="empty-state-container"><p>No customers match your search</p></div>`;
  }

  _renderTable(customers) {
    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th class="text-right">Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map(c => `
              <tr class="clickable-row" data-customer-id="${c.id}">
                <td><strong>${this._esc(c.name)}</strong></td>
                <td class="text-muted">${c.phone || '—'}</td>
                <td class="text-muted">${c.email || '—'}</td>
                <td class="text-muted">${c.city || '—'}</td>
                <td class="text-right ${c.current_balance > 0 ? 'text-negative' : (c.current_balance < 0 ? 'text-positive' : 'text-zero')} fw-600">
                  ${formatINR(c.current_balance)}
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${c.id}" title="Edit Customer">✏️</button>
                    <button class="btn btn-sm btn-secondary" data-action="new-bill" data-id="${c.id}" title="New Bill">📄</button>
                    <button class="btn btn-sm btn-secondary" data-action="items" data-id="${c.id}" title="Manage Items">📦</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${c.id}" title="Delete Customer">🗑️</button>
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

    // Add customer buttons
    this.element.querySelector('#btn-add-customer')?.addEventListener('click', () => this._showCustomerModal());
    this.element.querySelector('#btn-add-customer-empty')?.addEventListener('click', () => this._showCustomerModal());

    // Search input
    const searchInput = this.element.querySelector('#customer-search');
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

    // Row click → customer detail
    this.element.querySelectorAll('.clickable-row[data-customer-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const cid = parseInt(row.dataset.customerId);
        this.app.navigateTo('customer-detail', { customerId: cid });
      });
    });

    // Action buttons
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const cid = parseInt(btn.dataset.id);
        this._handleAction(action, cid);
      });
    });
  }

  _handleAction(action, customerId) {
    switch (action) {
      case 'edit':
        this._showCustomerModal(customerId);
        break;
      case 'new-bill':
        this.app.navigateTo('bill-create', { customerId });
        break;
      case 'items':
        this.app.navigateTo('items', { customerId });
        break;
      case 'delete':
        this._confirmDelete(customerId);
        break;
    }
  }

  async _confirmDelete(customerId) {
    const customer = Customer.getById(customerId);
    const confirmed = await Modal.confirm(
      `Delete "${customer?.name || 'this customer'}" and all associated data (bills, items, payments)?`,
      'Confirm Delete'
    );
    if (!confirmed) return;
    try {
      Customer.delete(customerId);
      Toast.success('Customer deleted');
      this._render();
    } catch (err) {
      Toast.error('Delete failed: ' + err.message);
    }
  }

  _showCustomerModal(customerId = null) {
    const isEdit = !!customerId;
    const customer = isEdit ? Customer.getById(customerId) : {};

    const modal = new Modal({
      title: isEdit ? 'Edit Customer' : 'Add Customer',
      size: 'md',
      confirmText: isEdit ? 'Update' : 'Add Customer',
      cancelText: 'Cancel',
      content: `
        <form id="customer-form" class="form" novalidate>
          <div class="form-group">
            <label>Name *</label>
            <input type="text" name="name" value="${this._esc(customer?.name || '')}" required placeholder="Customer full name">
          </div>
          <div class="form-row">
            <div class="form-group" style="margin:0">
              <label>Phone</label>
              <input type="tel" name="phone" value="${this._esc(customer?.phone || '')}" placeholder="Phone number">
            </div>
            <div class="form-group" style="margin:0">
              <label>Email</label>
              <input type="email" name="email" value="${this._esc(customer?.email || '')}" placeholder="email@example.com">
            </div>
          </div>
          <div class="form-group">
            <label>Address</label>
            <textarea name="address" rows="2" placeholder="Full address">${this._esc(customer?.address || '')}</textarea>
          </div>
          <div class="form-group">
            <label>City</label>
            <input type="text" name="city" value="${this._esc(customer?.city || '')}" placeholder="City">
          </div>
          <div class="form-group">
            <label>Opening Balance (₹)</label>
            <input type="number" name="opening_balance" step="0.01" value="${customer?.opening_balance ?? 0}" placeholder="0.00">
            <small class="form-help">Positive = customer owes you; Negative = you owe customer</small>
          </div>
        </form>
      `,
      onConfirm: async (m) => {
        const form = m.element.querySelector('#customer-form');
        const fd = new FormData(form);
        const data = {
          name:            fd.get('name'),
          phone:           fd.get('phone') || null,
          email:           fd.get('email') || null,
          address:         fd.get('address') || null,
          city:            fd.get('city') || null,
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
            if (el) {
              el.classList.add('error');
              const existing = el.parentNode.querySelector('.field-error');
              if (existing) existing.remove();
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
            Customer.update(customerId, data);
            Toast.success('Customer updated');
          } else {
            const created = Customer.create(data);
            Toast.success('Customer added');
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

  _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  refresh() {
    this._render();
  }
}