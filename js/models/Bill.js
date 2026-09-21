/**
 * Bill Model
 * Handles bill operations with carry-forward logic
 */

import { db } from '../db/database.js';
import { Customer } from './Customer.js';
import { Payment } from './Payment.js';

export class Bill {
  static TABLE = 'bills';
  static ITEMS_TABLE = 'bill_items';

  /**
   * Generate next bill number for a customer
   */
  static generateBillNumber(customerId) {
    const lastBill = db.get(
      `SELECT bill_number FROM ${this.TABLE}
       WHERE customer_id = ?
       ORDER BY id DESC LIMIT 1`,
      [customerId]
    );

    if (lastBill && lastBill.bill_number) {
      // Try to extract number and increment
      const match = lastBill.bill_number.match(/(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return lastBill.bill_number.replace(/\d+$/, nextNum.toString().padStart(match[1].length, '0'));
      }
    }

    // Default format: CUST-{customerId}-{sequence}
    const count = db.get(`SELECT COUNT(*) as c FROM ${this.TABLE} WHERE customer_id = ?`, [customerId])?.c || 0;
    return `CUST-${customerId}-${(count + 1).toString().padStart(4, '0')}`;
  }

  /**
   * Calculate carry-forward balance for a customer
   * This is the key logic: get the latest bill's balance, or opening balance if no bills
   */
  static getCarryForward(customerId) {
    const latestBill = db.get(
      `SELECT balance FROM ${this.TABLE}
       WHERE customer_id = ?
       ORDER BY bill_date DESC, id DESC LIMIT 1`,
      [customerId]
    );

    if (latestBill) {
      return latestBill.balance;
    }

    // No previous bills, return opening balance
    return Customer.getOpeningBalance(customerId);
  }

  /**
   * Get payments made since last bill (for accurate carry-forward)
   */
  static getPaymentsSinceLastBill(customerId, lastBillDate) {
    let sql = `SELECT COALESCE(SUM(amount), 0) as total FROM payments
               WHERE customer_id = ?`;
    const params = [customerId];

    if (lastBillDate) {
      sql += ` AND payment_date > ?`;
      params.push(lastBillDate);
    }

    const result = db.get(sql, params);
    return result?.total || 0;
  }

  /**
   * Create a new bill with line items
   */
  static create(billData, lineItems) {
    const {
      customer_id,
      bill_number,
      bill_date,
      notes = ''
    } = billData;

    // Calculate carry-forward
    const carryForward = this.getCarryForward(customer_id);

    // Calculate totals from line items
    let subtotal = 0;
    let gstTotal = 0;

    const processedItems = lineItems.map(item => {
      const quantity = parseFloat(item.quantity) || 1;
      const rate = parseFloat(item.rate) || 0;
      const gstRate = parseFloat(item.gst_rate) || 0;

      const amount = quantity * rate;
      const gstAmount = amount * (gstRate / 100);

      subtotal += amount;
      gstTotal += gstAmount;

      return {
        ...item,
        quantity,
        rate,
        gst_rate: gstRate,
        amount,
        gst_amount: gstAmount
      };
    });

    const total = subtotal + gstTotal;

    // Get payments since last bill to adjust balance
    const lastBill = db.get(
      `SELECT bill_date FROM ${this.TABLE}
       WHERE customer_id = ?
       ORDER BY bill_date DESC, id DESC LIMIT 1`,
      [customer_id]
    );

    const paymentsSinceLastBill = this.getPaymentsSinceLastBill(
      customer_id,
      lastBill?.bill_date
    );

    // New balance = carryForward + newBillTotal - paymentsSinceLastBill
    const balance = carryForward + total - paymentsSinceLastBill;

    // Insert bill
    const result = db.run(
      `INSERT INTO ${this.TABLE}
       (customer_id, bill_number, bill_date, subtotal, gst_total, total, carry_forward, paid, balance, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [customer_id, bill_number, bill_date, subtotal, gstTotal, total, carryForward, balance, notes]
    );

    const billId = result.lastInsertRowid;

    // Insert line items
    for (const item of processedItems) {
      db.run(
        `INSERT INTO ${this.ITEMS_TABLE}
         (bill_id, item_id, description, quantity, rate, gst_rate, amount, gst_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [billId, item.item_id || null, item.description, item.quantity, item.rate, item.gst_rate, item.amount, item.gst_amount]
      );
    }

    console.log(`%c🧾 [BILL CREATED] Bill ID #${billId} (${bill_number}) | Customer ID: ${customer_id} | Total: ₹${total.toFixed(2)}`, 'color:#16a34a;font-weight:bold;');
    return this.getById(billId);
  }

  /**
   * Get bill by ID with line items
   */
  static getById(id) {
    const bill = db.get(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
    if (!bill) return null;

    const items = db.all(
      `SELECT bi.*, i.name as item_name, i.unit as item_unit
       FROM ${this.ITEMS_TABLE} bi
       LEFT JOIN items i ON bi.item_id = i.id
       WHERE bi.bill_id = ?
       ORDER BY bi.id`,
      [id]
    );

    return { ...bill, items };
  }

  /**
   * Get all bills for a customer
   */
  static getByCustomer(customerId) {
    return db.all(
      `SELECT * FROM ${this.TABLE}
       WHERE customer_id = ?
       ORDER BY bill_date DESC, id DESC`,
      [customerId]
    );
  }

  /**
   * Get all bills with customer info
   */
  static getAllWithCustomer() {
    return db.all(
      `SELECT b.*, c.name as customer_name
       FROM ${this.TABLE} b
       JOIN customers c ON b.customer_id = c.id
       ORDER BY b.bill_date DESC, b.id DESC`
    );
  }

  /**
   * Update bill (recalculate totals)
   */
  static update(id, billData, lineItems) {
    // Delete existing line items
    db.run(`DELETE FROM ${this.ITEMS_TABLE} WHERE bill_id = ?`, [id]);

    // Recalculate
    let subtotal = 0;
    let gstTotal = 0;

    const processedItems = lineItems.map(item => {
      const quantity = parseFloat(item.quantity) || 1;
      const rate = parseFloat(item.rate) || 0;
      const gstRate = parseFloat(item.gst_rate) || 0;

      const amount = quantity * rate;
      const gstAmount = amount * (gstRate / 100);

      subtotal += amount;
      gstTotal += gstAmount;

      return {
        ...item,
        quantity,
        rate,
        gst_rate: gstRate,
        amount,
        gst_amount: gstAmount
      };
    });

    const total = subtotal + gstTotal;
    const carryForward = billData.carry_forward || 0;
    const balance = carryForward + total - (billData.paid || 0);

    // Update bill
    db.run(
      `UPDATE ${this.TABLE}
       SET bill_number = ?, bill_date = ?, subtotal = ?, gst_total = ?, total = ?,
           carry_forward = ?, paid = ?, balance = ?, notes = ?
       WHERE id = ?`,
      [billData.bill_number, billData.bill_date, subtotal, gstTotal, total,
       carryForward, billData.paid || 0, balance, billData.notes || '', id]
    );

    // Insert new line items
    for (const item of processedItems) {
      db.run(
        `INSERT INTO ${this.ITEMS_TABLE}
         (bill_id, item_id, description, quantity, rate, gst_rate, amount, gst_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, item.item_id || null, item.description, item.quantity, item.rate, item.gst_rate, item.amount, item.gst_amount]
      );
    }

    console.log(`%c📝 [BILL UPDATED] Bill ID #${id} (${billData.bill_number}) | Total: ₹${total.toFixed(2)}`, 'color:#2563eb;font-weight:bold;');
    return this.getById(id);
  }

  /**
   * Delete bill
   */
  static delete(id) {
    return db.run(`DELETE FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Update bill payment and recalculate balance
   */
  static updatePayment(billId, paidAmount) {
    const bill = this.getById(billId);
    if (!bill) return null;

    const newPaid = parseFloat(paidAmount) || 0;
    const newBalance = bill.carry_forward + bill.total - newPaid;

    db.run(
      `UPDATE ${this.TABLE} SET paid = ?, balance = ? WHERE id = ?`,
      [newPaid, newBalance, billId]
    );

    // Note: We don't auto-update subsequent bills here.
    // In a real scenario, you'd want to recalculate all subsequent bills.
    // For simplicity, we'll add a method to recalculate all balances for a customer.

    return this.getById(billId);
  }

  /**
   * Recalculate all balances for a customer (after payment or bill changes)
   * This ensures carry-forward chain stays correct
   */
  static recalculateCustomerBalances(customerId) {
    const bills = this.getByCustomer(customerId).reverse(); // Oldest first

    let runningBalance = Customer.getOpeningBalance(customerId);
    let lastBillDate = null;

    for (const bill of bills) {
      // Get payments since last bill
      const paymentsSince = this.getPaymentsSinceLastBill(customerId, lastBillDate);

      runningBalance = runningBalance + bill.total - paymentsSince;

      db.run(
        `UPDATE ${this.TABLE} SET carry_forward = ?, balance = ? WHERE id = ?`,
        [runningBalance - bill.total + paymentsSince, runningBalance, bill.id]
      );

      lastBillDate = bill.bill_date;
    }
  }

  /**
   * Get bill summary for a date range
   */
  static getSummary(startDate, endDate, customerId = null) {
    let sql = `
      SELECT
        COUNT(*) as bill_count,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(gst_total), 0) as total_gst,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(paid), 0) as total_paid,
        COALESCE(SUM(balance), 0) as total_outstanding
      FROM ${this.TABLE}
      WHERE bill_date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (customerId) {
      sql += ` AND customer_id = ?`;
      params.push(customerId);
    }

    return db.get(sql, params);
  }

  /**
   * Get monthly sales data for reports
   */
  static getMonthlySales(year) {
    return db.all(
      `SELECT
         strftime('%m', bill_date) as month,
         COUNT(*) as bill_count,
         COALESCE(SUM(subtotal), 0) as subtotal,
         COALESCE(SUM(gst_total), 0) as gst_total,
         COALESCE(SUM(total), 0) as total,
         COALESCE(SUM(paid), 0) as paid
       FROM ${this.TABLE}
       WHERE strftime('%Y', bill_date) = ?
       GROUP BY strftime('%m', bill_date)
       ORDER BY month`,
      [year.toString()]
    );
  }

  /**
   * Get GST breakdown for reports
   */
  static getGstBreakdown(startDate, endDate) {
    return db.all(
      `SELECT
         bi.gst_rate,
         COUNT(*) as item_count,
         COALESCE(SUM(bi.amount), 0) as taxable_amount,
         COALESCE(SUM(bi.gst_amount), 0) as gst_amount
       FROM ${this.ITEMS_TABLE} bi
       JOIN ${this.TABLE} b ON bi.bill_id = b.id
       WHERE b.bill_date BETWEEN ? AND ?
       GROUP BY bi.gst_rate
       ORDER BY bi.gst_rate`,
      [startDate, endDate]
    );
  }
}