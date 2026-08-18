/**
 * Items View
 * Manage master items per customer
 */

import { Item } from '../models/Item.js';
import { Customer } from '../models/Customer.js';
import { Table } from '../components/Table.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';
import { rules, validateForm } from '../utils/validation.js';

export class ItemsView {
  constructor(app, customerId) {
    this.app = app;
    this.customerId = customerId;
    this.element = null;
  }

  render() {
    const customer = Customer.getById(this.customerId);
    if (!customer) throw new Error('Customer not found');

    const items = Item.getByCustomer(this.customerId);

    return `
      <div class="view items-view" data-customer-id="${this.customerId}">
        <header class="view-header">
          <div class="breadcrumb">
            <a href="#" data-action="back">Customers</a> / ${customer.name} / Items
          </div>
          <h2>Items for ${customer.name}</h2>
          <div class="header-actions">
            <button class="btn btn-primary" data-action="new">Add Item</button>
          </div>
        </header>
        <section class="items-table">
          ${this._renderTable(items)}
        </section>
      </div>
    `;
  }

  _renderTable(items) {
    if (!items || items.length === 0) {
      return `
        <div class="empty-state-container">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <h3>No items yet</h3>
          <p>Add master items for quick bill creation</p>
          <button class="btn btn-primary" data-action="new">Add Item</button>
        </div>
      `;
    }

    const rows = items.map(item => `
      <tr data-id="${item.id}">
        <td>${item.id}</td>
        <td>${item.name}</td>
        <td>${item.unit}</td>
        <td class="text-right">${formatINR(item.rate)}</td>
        <td class="text-right">${item.gst_rate}%</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${item.id}">✏️</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="table-container">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>GST %</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  mount(container) {
    if (typeof container === 'string') container = document.querySelector(container);
    container.innerHTML = this.render();
    this.element = container.querySelector('.items-view');
    this._bindEvents();
  }

  _bindEvents() {
    if (!this.element) return;

    // Header actions
    this.element.querySelector('[data-action="back"]').addEventListener('click', (e) => {
      e.preventDefault();
      this.app.navigateTo('customer-detail', { customerId: this.customerId });
    });

    this.element.querySelectorAll('[data-action="new"]').forEach(btn => {
      btn.addEventListener('click', () => this._showItemModal());
    });

    // Action buttons
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const itemId = parseInt(btn.dataset.id);
        this._handleAction(action, itemId);
      });
    });
  }

  _handleAction(action, itemId) {
    switch (action) {
      case 'edit':
        this._showItemModal(itemId);
        break;
      case 'delete':
        this._confirmDelete(itemId);
        break;
    }
  }

  async _confirmDelete(itemId) {
    const confirmed = await Modal.confirm(
      'Delete this item? It will no longer be available for new bills.',
      'Confirm Delete'
    );
    if (!confirmed) return;

    try {
      Item.delete(itemId);
      Toast.success('Item deleted');
      this.refresh();
    } catch (error) {
      Toast.error('Failed to delete: ' + error.message);
    }
  }

  _showItemModal(itemId = null) {
    const isEdit = !!itemId;
    const item = isEdit ? Item.getById(itemId) : {};

    const modal = new Modal({
      title: isEdit ? 'Edit Item' : 'Add Item',
      size: 'md',
      confirmText: isEdit ? 'Update' : 'Add',
      cancelText: 'Cancel',
      content: `
        <form id="item-form" class="form" novalidate>
          <input type="hidden" name="id" value="${item.id || ''}">
          <input type="hidden" name="customer_id" value="${this.customerId}">
          <div class="form-group">
            <label for="name">Item Name *</label>
            <input type="text" id="name" name="name" value="${item.name || ''}" required placeholder="Item name">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="unit">Unit</label>
              <input type="text" id="unit" name="unit" value="${item.unit || 'pcs'}" placeholder="pcs">
            </div>
            <div class="form-group">
              <label for="rate">Rate *</label>
              <input type="number" id="rate" name="rate" step="0.01" min="0" value="${item.rate || 0}" required placeholder="0.00">
            </div>
          </div>
          <div class="form-group">
            <label for="gst_rate">GST Rate %</label>
            <input type="number" id="gst_rate" name="gst_rate" step="0.1" min="0" max="28" value="${item.gst_rate || 0}" placeholder="0">
          </div>
        </form>
      `,
      onConfirm: async (modal) => {
        const form = modal.element.querySelector('#item-form');
        const formData = new FormData(form);
        const data = {
          customer_id: this.customerId,
          name: formData.get('name'),
          unit: formData.get('unit') || 'pcs',
          rate: parseFloat(formData.get('rate')) || 0,
          gst_rate: parseFloat(formData.get('gst_rate')) || 0
        };

        const validation = validateForm(data, {
          name: [v => rules.itemName[0](v), v => rules.itemName[1](v)],
          rate: [v => rules.itemRate[0](v), v => rules.itemRate[1](v)],
          gst_rate: [v => rules.itemGstRate[0](v)]
        });

        if (!validation.isValid) {
          Object.entries(validation.errors).forEach(([field, message]) => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) this._showFieldError(input, message);
          });
          return false;
        }

        try {
          if (isEdit) {
            Item.update(itemId, data);
            Toast.success('Item updated');
          } else {
            Item.create(data);
            Toast.success('Item added');
          }
          modal.hide(true);
          this.refresh();
        } catch (error) {
          Toast.error('Error: ' + error.message);
          return false;
        }
      }
    });

    modal.show();

    setTimeout(() => {
      modal.element.querySelector('input[name="name"]')?.focus();
    }, 100);
  }

  _showFieldError(field, message) {
    this._clearError(field);
    field.classList.add('error');
    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    field.parentNode.appendChild(errorEl);
  }

  _clearError(field) {
    field.classList.remove('error');
    const errorEl = field.parentNode.querySelector('.field-error');
    if (errorEl) errorEl.remove();
  }

  async refresh() {
    if (!this.element) return;
    const container = this.element.parentNode;
    container.innerHTML = '';
    this.mount(container);
  }
}