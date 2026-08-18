/**
 * Item Model
 * Handles item/master data operations per customer
 */

import { db } from '../db/database.js';

export class Item {
  static TABLE = 'items';

  /**
   * Create a new item
   */
  static create(data) {
    const { customer_id, name, unit = 'pcs', rate = 0, gst_rate = 0, stock_quantity = 0, min_stock = 5, location = '' } = data;

    const result = db.run(
      `INSERT INTO ${this.TABLE} (customer_id, name, unit, rate, gst_rate, stock_quantity, min_stock, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, name, unit, rate, gst_rate, stock_quantity, min_stock, location]
    );

    return this.getById(result.lastInsertRowid);
  }

  /**
   * Get item by ID
   */
  static getById(id) {
    return db.get(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Get all items for a customer
   */
  static getByCustomer(customerId) {
    return db.all(
      `SELECT * FROM ${this.TABLE} WHERE customer_id = ? ORDER BY name ASC`,
      [customerId]
    );
  }

  /**
   * Get all items (across all customers)
   */
  static getAll() {
    return db.all(`SELECT i.*, c.name as customer_name FROM ${this.TABLE} i
                   JOIN customers c ON i.customer_id = c.id
                   ORDER BY c.name, i.name`);
  }

  /**
   * Update item
   */
  static update(id, data) {
    const { name, unit, rate, gst_rate, stock_quantity, min_stock, location } = data;

    db.run(
      `UPDATE ${this.TABLE}
       SET name = ?, unit = ?, rate = ?, gst_rate = ?, stock_quantity = ?, min_stock = ?, location = ?
       WHERE id = ?`,
      [name, unit, rate, gst_rate, stock_quantity ?? 0, min_stock ?? 5, location || '', id]
    );

    return this.getById(id);
  }

  /**
   * Adjust stock quantity
   */
  static adjustStock(id, delta) {
    const item = this.getById(id);
    if (!item) return null;
    const newQty = Math.max(0, (item.stock_quantity || 0) + delta);
    db.run(`UPDATE ${this.TABLE} SET stock_quantity = ? WHERE id = ?`, [newQty, id]);
    return this.getById(id);
  }

  /**
   * Delete item
   */
  static delete(id) {
    return db.run(`DELETE FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Search items by name for a customer
   */
  static search(customerId, query) {
    return db.all(
      `SELECT * FROM ${this.TABLE}
       WHERE customer_id = ? AND name LIKE ?
       ORDER BY name ASC`,
      [customerId, `%${query}%`]
    );
  }

  /**
   * Bulk create items
   */
  static bulkCreate(items) {
    return db.transaction((txn) => {
      return items.map(item => this.create(item));
    });
  }
}