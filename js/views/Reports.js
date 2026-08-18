/**
 * Reports View
 * Outstanding balances, sales summary, GST report, customer ledger
 */

import { Bill } from '../models/Bill.js';
import { Payment } from '../models/Payment.js';
import { Customer } from '../models/Customer.js';
import { Modal, Toast } from '../components/Modal.js';
import { formatINR } from '../utils/currency.js';
import { formatDate, formatDateISO, firstDayOfMonth, lastDayOfMonth } from '../utils/date.js';
import { exportJsonFile, exportAllCSV, exportCustomerLedgerCSV } from '../utils/export.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export class ReportsView {
  constructor(app) {
    this.app = app;
    this.element = null;
    this.startDate = firstDayOfMonth();
    this.endDate   = lastDayOfMonth();
    this.activeReport = 'outstanding';
  }

  mount(container) {
    this.element = container;
    this._render();
  }

  _render() {
    if (!this.element) return;

    this.element.innerHTML = `
      <div class="reports-view">
        <div class="view-header">
          <h2>Reports</h2>
        </div>

        <!-- Controls -->
        <div class="reports-controls">
          <div class="date-range">
            <label>From</label>
            <input type="date" id="rpt-start" value="${this.startDate}">
            <label>To</label>
            <input type="date" id="rpt-end" value="${this.endDate}">
          </div>
          <div class="report-buttons">
            <button class="btn btn-primary" id="btn-generate">Generate</button>
            <button class="btn btn-secondary" id="btn-export-csv">Export CSV</button>
            <button class="btn btn-secondary" id="btn-export-json">Export JSON</button>
          </div>
        </div>

        <!-- Report Tabs -->
        <div class="report-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:0">
          ${[
            { id: 'outstanding', label: '💳 Outstanding' },
            { id: 'sales',       label: '📈 Sales Summary' },
            { id: 'gst',         label: '🧾 GST Breakdown' },
            { id: 'ledger',      label: '📒 Customer Ledger' }
          ].map(t => `
            <button class="btn ${this.activeReport === t.id ? 'btn-primary' : 'btn-secondary'}"
              data-report="${t.id}">${t.label}</button>
          `).join('')}
        </div>

        <!-- Report Content -->
        <div id="report-content" class="report-panel">
          ${this._renderActiveReport()}
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderActiveReport() {
    switch (this.activeReport) {
      case 'outstanding': return this._renderOutstanding();
      case 'sales':       return this._renderSalesSummary();
      case 'gst':         return this._renderGstBreakdown();
      case 'ledger':      return this._renderLedger();
      default:            return this._renderOutstanding();
    }
  }

  _renderOutstanding() {
    const customers = Customer.getAllWithBalances();
    const withBalance = customers.filter(c => c.current_balance > 0);

    if (!withBalance.length) {
      return `<div class="empty-state-container"><h3>🎉 All customers are paid up!</h3></div>`;
    }

    const totalOutstanding = withBalance.reduce((s, c) => s + c.current_balance, 0);

    return `
      <div class="report-panel-header">
        <h3>Outstanding Balances</h3>
        <span class="text-negative fw-600">Total: ${formatINR(totalOutstanding)}</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Email</th>
              <th class="text-right">Opening Balance</th>
              <th class="text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${withBalance.sort((a, b) => b.current_balance - a.current_balance).map(c => `
              <tr class="clickable-row" data-customer-id="${c.id}">
                <td><strong>${c.name}</strong></td>
                <td class="text-muted">${c.phone || '—'}</td>
                <td class="text-muted">${c.email || '—'}</td>
                <td class="text-right text-muted">${formatINR(c.opening_balance)}</td>
                <td class="text-right text-negative fw-600">${formatINR(c.current_balance)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid var(--color-border)">
              <td colspan="4">Total Outstanding</td>
              <td class="text-right text-negative">${formatINR(totalOutstanding)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  _renderSalesSummary() {
    const summary = Bill.getSummary(this.startDate, this.endDate);
    const monthlySales = Bill.getMonthlySales(new Date(this.startDate).getFullYear());

    return `
      <div class="report-panel-header">
        <h3>Sales Summary</h3>
        <span class="text-muted text-sm">${formatDate(this.startDate)} — ${formatDate(this.endDate)}</span>
      </div>

      <!-- Period Summary -->
      <div class="stats-grid" style="padding:16px;gap:12px">
        <div class="stat-card stat-primary" style="padding:12px">
          <div class="stat-content">
            <span class="stat-value">${summary?.bill_count || 0}</span>
            <span class="stat-label">Bills</span>
          </div>
        </div>
        <div class="stat-card stat-success" style="padding:12px">
          <div class="stat-content">
            <span class="stat-value">${formatINR(summary?.total_amount || 0)}</span>
            <span class="stat-label">Total Sales</span>
          </div>
        </div>
        <div class="stat-card stat-info" style="padding:12px">
          <div class="stat-content">
            <span class="stat-value">${formatINR(summary?.total_gst || 0)}</span>
            <span class="stat-label">GST Collected</span>
          </div>
        </div>
        <div class="stat-card stat-warning" style="padding:12px">
          <div class="stat-content">
            <span class="stat-value">${formatINR(summary?.total_outstanding || 0)}</span>
            <span class="stat-label">Outstanding</span>
          </div>
        </div>
      </div>

      <!-- Monthly breakdown -->
      ${monthlySales.length > 0 ? `
      <div class="report-panel-header" style="border-top:1px solid var(--color-border)">
        <h3>Monthly Breakdown (${new Date(this.startDate).getFullYear()})</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th class="text-right">Bills</th>
              <th class="text-right">Subtotal</th>
              <th class="text-right">GST</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${monthlySales.map(row => `
              <tr>
                <td>${MONTHS[parseInt(row.month) - 1]}</td>
                <td class="text-right">${row.bill_count}</td>
                <td class="text-right">${formatINR(row.subtotal)}</td>
                <td class="text-right">${formatINR(row.gst_total)}</td>
                <td class="text-right fw-600">${formatINR(row.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    `;
  }

  _renderGstBreakdown() {
    const gstData = Bill.getGstBreakdown(this.startDate, this.endDate);

    if (!gstData.length) {
      return `
        <div class="report-panel-header"><h3>GST Breakdown</h3></div>
        <div class="empty-state-container"><p>No bills in selected date range</p></div>
      `;
    }

    const totalGst = gstData.reduce((s, r) => s + r.gst_amount, 0);
    const totalTaxable = gstData.reduce((s, r) => s + r.taxable_amount, 0);

    return `
      <div class="report-panel-header">
        <h3>GST Breakdown</h3>
        <span class="text-muted text-sm">${formatDate(this.startDate)} — ${formatDate(this.endDate)}</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>GST Rate</th>
              <th class="text-right">Items Sold</th>
              <th class="text-right">Taxable Amount</th>
              <th class="text-right">GST Amount</th>
            </tr>
          </thead>
          <tbody>
            ${gstData.map(row => `
              <tr>
                <td><span class="badge badge-info">${row.gst_rate}%</span></td>
                <td class="text-right">${row.item_count}</td>
                <td class="text-right">${formatINR(row.taxable_amount)}</td>
                <td class="text-right fw-600">${formatINR(row.gst_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid var(--color-border)">
              <td colspan="2">Total</td>
              <td class="text-right">${formatINR(totalTaxable)}</td>
              <td class="text-right">${formatINR(totalGst)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  _renderLedger() {
    const customers = Customer.getAll();

    return `
      <div class="report-panel-header">
        <h3>Customer Ledger</h3>
      </div>
      <div style="padding:16px">
        <div class="form-group">
          <label>Select Customer</label>
          <select id="ledger-customer-select">
            <option value="">— Choose a customer —</option>
            ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div id="ledger-table-container" style="margin-top:16px"></div>
      </div>
    `;
  }

  _renderLedgerForCustomer(customerId) {
    const customer = Customer.getById(customerId);
    if (!customer) return '<p>Customer not found</p>';

    const bills = Bill.getByCustomer(customerId);
    const payments = Payment.getByCustomer(customerId);

    // Merge and sort by date
    const entries = [];
    let runningBalance = customer.opening_balance || 0;

    if (customer.opening_balance) {
      entries.push({
        date: '—',
        type: 'Opening Balance',
        ref: '',
        debit: 0,
        credit: 0,
        balance: customer.opening_balance,
        isOpening: true
      });
    }

    const allTxns = [
      ...bills.map(b => ({ ...b, type: 'Bill', sortDate: b.bill_date })),
      ...payments.map(p => ({ ...p, type: 'Payment', sortDate: p.payment_date }))
    ].sort((a, b) => (a.sortDate || '9999').localeCompare(b.sortDate || '9999'));

    for (const txn of allTxns) {
      if (txn.type === 'Bill') {
        runningBalance += txn.total;
        entries.push({
          date: formatDate(txn.bill_date),
          type: 'Bill',
          ref: txn.bill_number,
          debit: txn.total,
          credit: 0,
          balance: runningBalance
        });
      } else {
        runningBalance -= txn.amount;
        entries.push({
          date: formatDate(txn.payment_date),
          type: 'Payment',
          ref: txn.mode + (txn.reference ? ' – ' + txn.reference : ''),
          debit: 0,
          credit: txn.amount,
          balance: runningBalance
        });
      }
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong>${customer.name}</strong>
        <button class="btn btn-sm btn-secondary" id="btn-export-ledger-csv">Export Ledger CSV</button>
      </div>
      <div class="table-responsive">
        <table class="data-table ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th class="text-right">Debit (Dr)</th>
              <th class="text-right">Credit (Cr)</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr class="${e.isOpening ? 'ledger-opening' : (e.type === 'Bill' ? 'ledger-bill' : 'ledger-payment')}">
                <td>${e.date}</td>
                <td><span class="badge ${e.type === 'Bill' ? 'badge-warning' : (e.isOpening ? 'badge-primary' : 'badge-success')}">${e.type}</span></td>
                <td class="text-muted">${e.ref}</td>
                <td class="text-right ${e.debit ? 'text-negative' : 'text-muted'}">${e.debit ? formatINR(e.debit) : '—'}</td>
                <td class="text-right ${e.credit ? 'text-positive' : 'text-muted'}">${e.credit ? formatINR(e.credit) : '—'}</td>
                <td class="text-right fw-600 ${e.balance > 0 ? 'text-negative' : (e.balance < 0 ? 'text-positive' : 'text-zero')}">${formatINR(e.balance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindEvents() {
    if (!this.element) return;

    // Date inputs
    this.element.querySelector('#rpt-start')?.addEventListener('change', (e) => {
      this.startDate = e.target.value;
    });
    this.element.querySelector('#rpt-end')?.addEventListener('change', (e) => {
      this.endDate = e.target.value;
    });

    // Generate button
    this.element.querySelector('#btn-generate')?.addEventListener('click', () => {
      const content = this.element.querySelector('#report-content');
      if (content) content.innerHTML = this._renderActiveReport();
      this._bindReportContentEvents();
      Toast.success('Report generated');
    });

    // Export buttons
    this.element.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      try {
        const counts = exportAllCSV();
        Toast.success(`Exported ${counts.customers} customers, ${counts.bills} bills, ${counts.payments} payments`);
      } catch (e) { Toast.error('Export failed: ' + e.message); }
    });

    this.element.querySelector('#btn-export-json')?.addEventListener('click', () => {
      try {
        exportJsonFile();
        Toast.success('JSON backup exported');
      } catch (e) { Toast.error('Export failed: ' + e.message); }
    });

    // Report tab switching
    this.element.querySelectorAll('[data-report]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeReport = btn.dataset.report;
        this._render();
      });
    });

    this._bindReportContentEvents();
  }

  _bindReportContentEvents() {
    // Outstanding table — click to go to customer
    this.element.querySelectorAll('.clickable-row[data-customer-id]').forEach(row => {
      row.addEventListener('click', () => {
        const cid = parseInt(row.dataset.customerId);
        if (cid) this.app.navigateTo('customer-detail', { customerId: cid });
      });
    });

    // Ledger customer selector
    const ledgerSelect = this.element.querySelector('#ledger-customer-select');
    if (ledgerSelect) {
      ledgerSelect.addEventListener('change', () => {
        const cid = parseInt(ledgerSelect.value);
        const container = this.element.querySelector('#ledger-table-container');
        if (!container) return;
        if (cid) {
          container.innerHTML = this._renderLedgerForCustomer(cid);
          // Bind export button
          container.querySelector('#btn-export-ledger-csv')?.addEventListener('click', () => {
            try {
              exportCustomerLedgerCSV(cid);
              Toast.success('Ledger exported');
            } catch (e) { Toast.error('Export failed: ' + e.message); }
          });
        } else {
          container.innerHTML = '';
        }
      });
    }
  }

  refresh() {
    this._render();
  }
}