/**
 * Customer Model
 * Handles all customer-related database operations
 */

import { db } from '../db/database.js';

export class Customer {
  static TABLE = 'customers';

  /**
   * Create a new customer
   */
  static async create(data) {
    const { name, phone, email, address, city, opening_balance = 0 } = data;

    const result = db.run(
      `INSERT INTO ${this.TABLE} (name, phone, email, address, city, opening_balance)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, phone || null, email || null, address || null, city || null, opening_balance]
    );

    return this.getById(result.lastInsertRowid);
  }

  /**
   * Get customer by ID
   */
  static getById(id) {
    return db.get(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Get all customers with optional search
   */
  static getAll(search = '') {
    let sql = `SELECT * FROM ${this.TABLE}`;
    const params = [];

    if (search) {
      sql += ` WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY name ASC`;
    return db.all(sql, params);
  }

  /**
   * Update customer
   */
  static async update(id, data) {
    const { name, phone, email, address, city, opening_balance } = data;

    db.run(
      `UPDATE ${this.TABLE}
       SET name = ?, phone = ?, email = ?, address = ?, city = ?, opening_balance = ?
       WHERE id = ?`,
      [name, phone || null, email || null, address || null, city || null, opening_balance, id]
    );

    return this.getById(id);
  }

  /**
   * Delete customer (cascades to items, bills, payments)
   */
  static delete(id) {
    return db.run(`DELETE FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Get customer with current balance (opening + bills - payments)
   */
  static getWithBalance(id) {
    const customer = this.getById(id);
    if (!customer) return null;

    // Calculate current balance from bills and payments
    const billsResult = db.get(
      `SELECT COALESCE(SUM(balance), 0) as total_balance
       FROM bills WHERE customer_id = ?`,
      [id]
    );

    const paymentsResult = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total_paid
       FROM payments WHERE customer_id = ?`,
      [id]
    );

    // Balance = opening_balance + sum of bill balances - payments
    // Actually, bills.balance already includes carry_forward, so we need the latest bill's balance
    const latestBill = db.get(
      `SELECT balance FROM bills WHERE customer_id = ? ORDER BY bill_date DESC, id DESC LIMIT 1`,
      [id]
    );

    const currentBalance = latestBill ? latestBill.balance : customer.opening_balance;

    return {
      ...customer,
      current_balance: currentBalance,
      total_bills: db.get(`SELECT COUNT(*) as count FROM bills WHERE customer_id = ?`, [id])?.count || 0
    };
  }

  /**
   * Get all customers with their current balances
   */
  static getAllWithBalances() {
    const customers = this.getAll();
    return customers.map(c => this.getWithBalance(c.id));
  }

  /**
   * Get customer's opening balance
   */
  static getOpeningBalance(id) {
    const customer = this.getById(id);
    return customer ? customer.opening_balance : 0;
  }

  /**
   * Search customers by name/phone
   */
  static search(query) {
    return this.getAll(query);
  }
}