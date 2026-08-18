/**
 * CatalogItem Model
 * Global parts catalog — car spare parts available to all customers
 */

import { db } from '../db/database.js';

export class CatalogItem {
  static TABLE = 'catalog_items';

  static create(data) {
    const {
      name,
      category = 'General',
      unit = 'pcs',
      rate = 0,
      gst_rate = 18,
      hsn_code = '',
      description = '',
      stock_quantity = 10,
      min_stock = 5,
      location = ''
    } = data;
    const result = db.run(
      `INSERT INTO ${this.TABLE} (name, category, unit, rate, gst_rate, hsn_code, description, stock_quantity, min_stock, location, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, category, unit, rate, gst_rate, hsn_code, description, stock_quantity, min_stock, location]
    );
    db.save();
    return this.getById(result.lastInsertRowid);
  }

  static getById(id) {
    return db.get(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
  }

  static getAll(includeInactive = false) {
    const where = includeInactive ? '' : 'WHERE active = 1';
    return db.all(`SELECT * FROM ${this.TABLE} ${where} ORDER BY category ASC, name ASC`);
  }

  static getCategories() {
    return db.all(`SELECT DISTINCT category FROM ${this.TABLE} WHERE active = 1 ORDER BY category ASC`);
  }

  static getByCategory(category) {
    return db.all(
      `SELECT * FROM ${this.TABLE} WHERE category = ? AND active = 1 ORDER BY name ASC`,
      [category]
    );
  }

  static search(query) {
    const q = `%${query}%`;
    return db.all(
      `SELECT * FROM ${this.TABLE} WHERE active = 1 AND (name LIKE ? OR category LIKE ? OR description LIKE ? OR hsn_code LIKE ? OR location LIKE ?)
       ORDER BY category, name`,
      [q, q, q, q, q]
    );
  }

  static update(id, data) {
    const { name, category, unit, rate, gst_rate, hsn_code, description, stock_quantity, min_stock, location } = data;
    db.run(
      `UPDATE ${this.TABLE} SET name=?, category=?, unit=?, rate=?, gst_rate=?, hsn_code=?, description=?, stock_quantity=?, min_stock=?, location=? WHERE id=?`,
      [name, category, unit, rate, gst_rate, hsn_code || '', description || '', stock_quantity ?? 10, min_stock ?? 5, location || '', id]
    );
    db.save();
    return this.getById(id);
  }

  static adjustStock(id, delta) {
    const item = this.getById(id);
    if (!item) return null;
    const newQty = Math.max(0, (item.stock_quantity || 0) + delta);
    db.run(`UPDATE ${this.TABLE} SET stock_quantity = ? WHERE id = ?`, [newQty, id]);
    db.save();
    return this.getById(id);
  }

  static delete(id) {
    const result = db.run(`DELETE FROM ${this.TABLE} WHERE id = ?`, [id]);
    db.save();
    return result.changes > 0;
  }

  static toggleActive(id) {
    db.run(`UPDATE ${this.TABLE} SET active = 1 - active WHERE id = ?`, [id]);
    db.save();
    return this.getById(id);
  }

  static getCount() {
    return db.get(`SELECT COUNT(*) as c FROM ${this.TABLE} WHERE active = 1`)?.c || 0;
  }

  static bulkImport(rows) {
    return db.transaction((dbInst) => {
      const created = [];
      for (const row of rows) {
        const result = dbInst.run(
          `INSERT INTO ${this.TABLE} (name, category, unit, rate, gst_rate, hsn_code, description, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [row.name, row.category || 'General', row.unit || 'pcs',
           parseFloat(row.rate) || 0, parseFloat(row.gst_rate) || 18,
           row.hsn_code || '', row.description || '']
        );
        created.push(result.lastInsertRowid);
      }
      return created;
    });
  }
}
