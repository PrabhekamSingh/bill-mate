/**
 * Dashboard View
 * Main overview with stats, quick actions, and recent activity
 */

import { Customer } from '../models/Customer.js';
import { Bill } from '../models/Bill.js';
import { Payment } from '../models/Payment.js';
import { formatINR, formatINRCompact } from '../utils/currency.js';
import { formatDate, firstDayOfMonth, lastDayOfMonth } from '../utils/date.js';
import { Toast } from '../components/Modal.js';

export class Dashboard {
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

    // Gather data synchronously (sql.js is sync)
    const stats = this._getStats();
    const recentBills = Bill.getAllWithCustomer().slice(0, 6);

    this.element.innerHTML = `
      <div class="dashboard-view">
        <!-- Stats -->
        <section class="stats-grid" aria-label="Key statistics">
          <article class="stat-card stat-primary">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value">${stats.totalCustomers}</span>
              <span class="stat-label">Total Customers</span>
            </div>
          </article>

          <article class="stat-card stat-warning">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value">${formatINRCompact(stats.totalOutstanding)}</span>
              <span class="stat-label">Total Outstanding</span>
            </div>
          </article>

          <article class="stat-card stat-success">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value">${formatINRCompact(stats.monthlySales)}</span>
              <span class="stat-label">This Month's Sales</span>
            </div>
          </article>

          <article class="stat-card stat-info">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div class="stat-content">
              <span class="stat-value">${stats.totalBillsThisMonth}</span>
              <span class="stat-label">Bills This Month</span>
            </div>
          </article>
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions" aria-label="Quick actions">
          <h2>Quick Actions</h2>
          <div class="action-grid">
            <button class="action-card" id="btn-add-customer" type="button">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="19" y1="8" x2="19" y2="14"></line>
                  <line x1="22" y1="11" x2="16" y2="11"></line>
                </svg>
              </div>
              <span>Add Customer</span>
            </button>
            <button class="action-card" id="btn-new-bill" type="button">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <span>Create Bill</span>
            </button>
            <button class="action-card" id="btn-view-customers" type="button">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <span>Customers</span>
            </button>
            <button class="action-card" id="btn-view-reports" type="button">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <span>View Reports</span>
            </button>
          </div>
        </section>

        <!-- Recent Bills -->
        <section class="recent-activity" aria-label="Recent bills">
          <div class="section-header">
            <h2>Recent Bills</h2>
            <a href="#customers" class="view-all">View Customers →</a>
          </div>
          <div class="dashboard-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th class="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentBills.length > 0 ? recentBills.map(bill => `
                  <tr class="clickable-row" data-customer-id="${bill.customer_id}">
                    <td>${bill.bill_number}</td>
                    <td>${bill.customer_name}</td>
                    <td>${formatDate(bill.bill_date)}</td>
                    <td class="text-right">${formatINR(bill.total)}</td>
                    <td>
                      <span class="badge ${bill.balance > 0 ? 'badge-warning' : 'badge-success'}">
                        ${bill.balance > 0 ? 'Due: ' + formatINR(bill.balance) : 'Paid'}
                      </span>
                    </td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="5" class="empty-state">No bills yet — create your first bill!</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Outstanding Customers -->
        ${stats.topOutstanding.length > 0 ? `
        <section class="outstanding-customers" aria-label="Outstanding balances">
          <div class="section-header">
            <h2>Outstanding Balances</h2>
            <a href="#customers" class="view-all">View All →</a>
          </div>
          <div class="dashboard-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th class="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${stats.topOutstanding.map(c => `
                  <tr class="clickable-row" data-customer-id="${c.id}">
                    <td><strong>${c.name}</strong></td>
                    <td class="text-muted">${c.phone || '—'}</td>
                    <td class="text-right text-negative">${formatINR(c.current_balance)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
        ` : ''}
      </div>
    `;

    this._bindEvents();
  }

  _getStats() {
    const customers = Customer.getAll();
    const totalCustomers = customers.length;

    let totalOutstanding = 0;
    const customerBalances = [];

    for (const c of customers) {
      const withBalance = Customer.getWithBalance(c.id);
      if (withBalance && withBalance.current_balance > 0) {
        totalOutstanding += withBalance.current_balance;
        customerBalances.push(withBalance);
      }
    }

    const startOfMonth = firstDayOfMonth();
    const endOfMonth   = lastDayOfMonth();
    const monthlySummary = Bill.getSummary(startOfMonth, endOfMonth);
    const monthlySales = monthlySummary?.total_amount || 0;
    const totalBillsThisMonth = monthlySummary?.bill_count || 0;

    const topOutstanding = customerBalances
      .sort((a, b) => b.current_balance - a.current_balance)
      .slice(0, 5);

    return { totalCustomers, totalOutstanding, monthlySales, totalBillsThisMonth, topOutstanding };
  }

  _bindEvents() {
    if (!this.element) return;

    this.element.querySelector('#btn-add-customer')?.addEventListener('click', () => {
      this.app.navigateTo('customers');
      // Give the customers view time to mount, then trigger new customer modal
      setTimeout(() => {
        if (this.app.currentView && this.app.currentView._showCustomerModal) {
          this.app.currentView._showCustomerModal();
        }
      }, 100);
    });

    this.element.querySelector('#btn-new-bill')?.addEventListener('click', () => {
      this.app.navigateTo('customers');
    });

    this.element.querySelector('#btn-view-customers')?.addEventListener('click', () => {
      this.app.navigateTo('customers');
    });

    this.element.querySelector('#btn-view-reports')?.addEventListener('click', () => {
      this.app.navigateTo('reports');
    });

    // Clickable table rows → customer detail
    this.element.querySelectorAll('.clickable-row[data-customer-id]').forEach(row => {
      row.addEventListener('click', () => {
        const customerId = parseInt(row.dataset.customerId);
        if (customerId) this.app.navigateTo('customer-detail', { customerId });
      });
    });

    // View all links
    this.element.querySelectorAll('.view-all[href="#customers"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.app.navigateTo('customers');
      });
    });
  }

  refresh() {
    this._render();
  }
}