/**
 * Payment Model
 * Handles payment operations
 */

import { db } from '../db/database.js';
import { Bill } from './Bill.js';

export class Payment {
  static TABLE = 'payments';

  /**
   * Create a new payment
   */
  static create(data) {
    const {
      customer_id,
      bill_id = null,
      amount,
      payment_date,
      mode = 'cash',
      reference = '',
      notes = ''
    } = data;

    const result = db.run(
      `INSERT INTO ${this.TABLE} (customer_id, bill_id, amount, payment_date, mode, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, bill_id, amount, payment_date, mode, reference, notes]
    );

    // After creating payment, recalculate customer balances
    Bill.recalculateCustomerBalances(customer_id);

    return this.getById(result.lastInsertRowid);
  }

  /**
   * Get payment by ID
   */
  static getById(id) {
    return db.get(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Get all payments for a customer
   */
  static getByCustomer(customerId) {
    return db.all(
      `SELECT p.*, b.bill_number
       FROM ${this.TABLE} p
       LEFT JOIN bills b ON p.bill_id = b.id
       WHERE p.customer_id = ?
       ORDER BY p.payment_date DESC, p.id DESC`,
      [customerId]
    );
  }

  /**
   * Get all payments with customer info
   */
  static getAllWithCustomer() {
    return db.all(
      `SELECT p.*, c.name as customer_name, b.bill_number
       FROM ${this.TABLE} p
       JOIN customers c ON p.customer_id = c.id
       LEFT JOIN bills b ON p.bill_id = b.id
       ORDER BY p.payment_date DESC, p.id DESC`
    );
  }

  /**
   * Update payment
   */
  static update(id, data) {
    const { customer_id, bill_id, amount, payment_date, mode, reference, notes } = data;

    db.run(
      `UPDATE ${this.TABLE}
       SET customer_id = ?, bill_id = ?, amount = ?, payment_date = ?, mode = ?, reference = ?, notes = ?
       WHERE id = ?`,
      [customer_id, bill_id, amount, payment_date, mode, reference, notes, id]
    );

    // Recalculate balances for the customer
    Bill.recalculateCustomerBalances(customer_id);

    return this.getById(id);
  }

  /**
   * Delete payment
   */
  static delete(id) {
    const payment = this.getById(id);
    if (!payment) return false;

    const result = db.run(`DELETE FROM ${this.TABLE} WHERE id = ?`, [id]);

    // Recalculate balances for the customer
    Bill.recalculateCustomerBalances(payment.customer_id);

    return result.changes > 0;
  }

  /**
   * Get total payments for a customer
   */
  static getTotalForCustomer(customerId) {
    const result = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM ${this.TABLE} WHERE customer_id = ?`,
      [customerId]
    );
    return result?.total || 0;
  }

  /**
   * Get payments for a date range
   */
  static getByDateRange(startDate, endDate, customerId = null) {
    let sql = `SELECT p.*, c.name as customer_name
               FROM ${this.TABLE} p
               JOIN customers c ON p.customer_id = c.id
               WHERE p.payment_date BETWEEN ? AND ?`;
    const params = [startDate, endDate];

    if (customerId) {
      sql += ` AND p.customer_id = ?`;
      params.push(customerId);
    }

    sql += ` ORDER BY p.payment_date DESC`;
    return db.all(sql, params);
  }

  /**
   * Get payment mode summary
   */
  static getModeSummary(startDate, endDate) {
    return db.all(
      `SELECT mode, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM ${this.TABLE}
       WHERE payment_date BETWEEN ? AND ?
       GROUP BY mode
       ORDER BY total DESC`,
      [startDate, endDate]
    );
  }
}