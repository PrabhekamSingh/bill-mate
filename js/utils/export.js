/**
 * Export/Import Utilities
 * CSV and JSON export/import functionality
 */

import { db } from '../db/database.js';
import { formatDate, formatDateISO } from './date.js';
import { formatINR } from './currency.js';

/**
 * Export all data as JSON
 */
export function exportToJson() {
  return db.exportToJson();
}

/**
 * Import data from JSON
 */
export function importFromJson(jsonData) {
  return db.importFromJson(jsonData);
}

/**
 * Download file helper
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export to JSON file
 */
export function exportJsonFile() {
  const data = exportToJson();
  const filename = `billing_backup_${formatDateISO(new Date()).replace(/-/g, '')}.json`;
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  return filename;
}

/**
 * Import from JSON file
 */
export function importJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        importFromJson(jsonData);
        resolve({ success: true, message: 'Data imported successfully' });
      } catch (err) {
        reject({ success: false, message: 'Invalid JSON file: ' + err.message });
      }
    };
    reader.onerror = () => reject({ success: false, message: 'Failed to read file' });
    reader.readAsText(file);
  });
}

/**
 * Convert array of objects to CSV
 */
function toCSV(data, columns) {
  if (!data || data.length === 0) return '';

  // Header
  const headers = columns.map(c => c.header).join(',');

  // Rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value = row[col.key];
      if (value === null || value === undefined) value = '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');

  return headers + '\n' + rows;
}

/**
 * Export customers to CSV
 */
export function exportCustomersCSV(customers) {
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'address', header: 'Address' },
    { key: 'city', header: 'City' },
    { key: 'opening_balance', header: 'Opening Balance' },
    { key: 'created_at', header: 'Created At' }
  ];
  return toCSV(customers, columns);
}

/**
 * Export items to CSV
 */
export function exportItemsCSV(items) {
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'customer_id', header: 'Customer ID' },
    { key: 'name', header: 'Item Name' },
    { key: 'unit', header: 'Unit' },
    { key: 'rate', header: 'Rate' },
    { key: 'gst_rate', header: 'GST %' },
    { key: 'created_at', header: 'Created At' }
  ];
  return toCSV(items, columns);
}

/**
 * Export bills to CSV
 */
export function exportBillsCSV(bills) {
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'customer_id', header: 'Customer ID' },
    { key: 'bill_number', header: 'Bill Number' },
    { key: 'bill_date', header: 'Bill Date' },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'gst_total', header: 'GST Total' },
    { key: 'total', header: 'Total' },
    { key: 'carry_forward', header: 'Carry Forward' },
    { key: 'paid', header: 'Paid' },
    { key: 'balance', header: 'Balance' },
    { key: 'notes', header: 'Notes' },
    { key: 'created_at', header: 'Created At' }
  ];
  return toCSV(bills, columns);
}

/**
 * Export payments to CSV
 */
export function exportPaymentsCSV(payments) {
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'customer_id', header: 'Customer ID' },
    { key: 'bill_id', header: 'Bill ID' },
    { key: 'amount', header: 'Amount' },
    { key: 'payment_date', header: 'Payment Date' },
    { key: 'mode', header: 'Mode' },
    { key: 'reference', header: 'Reference' },
    { key: 'notes', header: 'Notes' },
    { key: 'created_at', header: 'Created At' }
  ];
  return toCSV(payments, columns);
}

/**
 * Export all data to separate CSV files (zipped would be better but keeping simple)
 */
export function exportAllCSV() {
  const customers = db.all('SELECT * FROM customers ORDER BY name');
  const items = db.all('SELECT * FROM items ORDER BY customer_id, name');
  const catalogItems = db.all('SELECT * FROM catalog_items ORDER BY category, name');
  const bills = db.all('SELECT * FROM bills ORDER BY bill_date DESC');
  const payments = db.all('SELECT * FROM payments ORDER BY payment_date DESC');

  const dateStr = formatDateISO(new Date()).replace(/-/g, '');

  downloadFile(exportCustomersCSV(customers), `customers_${dateStr}.csv`, 'text/csv');
  downloadFile(exportItemsCSV(items), `items_${dateStr}.csv`, 'text/csv');
  downloadFile(exportCatalogItemsCSV(catalogItems), `catalog_items_${dateStr}.csv`, 'text/csv');
  downloadFile(exportBillsCSV(bills), `bills_${dateStr}.csv`, 'text/csv');
  downloadFile(exportPaymentsCSV(payments), `payments_${dateStr}.csv`, 'text/csv');

  saveCSVToDataDir('data/catalog_items.csv', exportCatalogItemsCSV(catalogItems));

  return { customers: customers.length, items: items.length, catalogItems: catalogItems.length, bills: bills.length, payments: payments.length };
}

/**
 * Generate customer ledger report (CSV)
 */
export function exportCustomerLedgerCSV(customerId) {
  const customer = db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!customer) throw new Error('Customer not found');

  const bills = db.all(
    `SELECT * FROM bills WHERE customer_id = ? ORDER BY bill_date, id`,
    [customerId]
  );

  const payments = db.all(
    `SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date, id`,
    [customerId]
  );

  // Build ledger entries
  const entries = [];

  // Opening balance
  if (customer.opening_balance !== 0) {
    entries.push({
      date: 'Opening',
      type: 'Opening Balance',
      ref: '',
      debit: customer.opening_balance > 0 ? customer.opening_balance : '',
      credit: customer.opening_balance < 0 ? Math.abs(customer.opening_balance) : '',
      balance: customer.opening_balance
    });
  }

  let runningBalance = customer.opening_balance;

  // Merge bills and payments by date
  const allTransactions = [
    ...bills.map(b => ({ ...b, type: 'Bill', date: b.bill_date })),
    ...payments.map(p => ({ ...p, type: 'Payment', date: p.payment_date }))
  ].sort((a, b) => {
    const dateA = a.date || '9999-12-31';
    const dateB = b.date || '9999-12-31';
    return dateA.localeCompare(dateB);
  });

  for (const txn of allTransactions) {
    if (txn.type === 'Bill') {
      runningBalance += txn.total;
      entries.push({
        date: formatDate(txn.bill_date),
        type: 'Bill',
        ref: txn.bill_number,
        debit: txn.total,
        credit: '',
        balance: runningBalance
      });
    } else {
      runningBalance -= txn.amount;
      entries.push({
        date: formatDate(txn.payment_date),
        type: 'Payment',
        ref: txn.mode + (txn.reference ? ' - ' + txn.reference : ''),
        debit: '',
        credit: txn.amount,
        balance: runningBalance
      });
    }
  }

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'type', header: 'Type' },
    { key: 'ref', header: 'Reference' },
    { key: 'debit', header: 'Debit' },
    { key: 'credit', header: 'Credit' },
    { key: 'balance', header: 'Balance' }
  ];

  const csv = toCSV(entries, columns);
  const filename = `ledger_${customer.name.replace(/\s+/g, '_')}_${formatDateISO(new Date()).replace(/-/g, '')}.csv`;
  downloadFile(csv, filename, 'text/csv');

  return filename;
}

/**
 * Save CSV file to data/ directory on backend server
 */
export async function saveCSVToDataDir(filepath, csvContent) {
  try {
    const res = await fetch('/api/save-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath, content: csvContent })
    });
    if (res.ok) {
      console.log(`[CSV] Saved to ${filepath}`);
      return true;
    }
  } catch (e) {
    console.warn(`[CSV] Could not save to data directory: ${e.message}`);
  }
  return false;
}

/**
 * Export Catalog Items to CSV string
 */
export function exportCatalogItemsCSV(catalogItems) {
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Item Name' },
    { key: 'category', header: 'Category' },
    { key: 'hsn_code', header: 'HSN Code' },
    { key: 'unit', header: 'Unit' },
    { key: 'rate', header: 'Rate' },
    { key: 'gst_rate', header: 'GST %' },
    { key: 'stock_quantity', header: 'Stock Quantity' },
    { key: 'min_stock', header: 'Min Stock' },
    { key: 'location', header: 'Location' },
    { key: 'description', header: 'Description' },
    { key: 'active', header: 'Active' },
    { key: 'created_at', header: 'Created At' }
  ];
  return toCSV(catalogItems, columns);
}

/**
 * Download Catalog CSV and save to data/catalog_items.csv
 */
export function exportCatalogCSV() {
  const catalogItems = db.all('SELECT * FROM catalog_items ORDER BY category, name');
  const csv = exportCatalogItemsCSV(catalogItems);
  const dateStr = formatDateISO(new Date()).replace(/-/g, '');
  const filename = `catalog_items_${dateStr}.csv`;

  downloadFile(csv, filename, 'text/csv');
  saveCSVToDataDir('data/catalog_items.csv', csv);

  return filename;
}

/**
 * Export a single bill to CSV and save to data/customer/{bill_id}_{date}_bill.csv
 */
export function exportSingleBillCSV(billId) {
  const bill = db.get('SELECT b.*, c.name as customer_name FROM bills b JOIN customers c ON b.customer_id = c.id WHERE b.id = ?', [billId]);
  if (!bill) return null;

  const items = db.all('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id', [billId]);

  const billColumns = [
    { key: 'id', header: 'Bill ID' },
    { key: 'bill_number', header: 'Bill Number' },
    { key: 'customer_name', header: 'Customer Name' },
    { key: 'customer_id', header: 'Customer ID' },
    { key: 'bill_date', header: 'Bill Date' },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'gst_total', header: 'GST Total' },
    { key: 'total', header: 'Total Amount' },
    { key: 'carry_forward', header: 'Carry Forward' },
    { key: 'balance', header: 'Outstanding Balance' },
    { key: 'notes', header: 'Notes' }
  ];

  const itemColumns = [
    { key: 'id', header: 'Line Item ID' },
    { key: 'description', header: 'Description' },
    { key: 'quantity', header: 'Quantity' },
    { key: 'rate', header: 'Rate' },
    { key: 'gst_rate', header: 'GST %' },
    { key: 'amount', header: 'Subtotal Amount' },
    { key: 'gst_amount', header: 'GST Amount' }
  ];

  const billCSV = toCSV([bill], billColumns);
  const itemsCSV = toCSV(items, itemColumns);
  const fullCSV = `--- BILL SUMMARY ---\n${billCSV}\n\n--- LINE ITEMS ---\n${itemsCSV}`;

  const dateStr = (bill.bill_date || formatDateISO(new Date())).replace(/-/g, '');
  const relativePath = `data/customer/${bill.id}_${dateStr}_bill.csv`;

  saveCSVToDataDir(relativePath, fullCSV);

  return { filename: relativePath, content: fullCSV };
}

/**
 * Export all bills for a specific customer to CSV and save in data directory
 */
export function exportCustomerBillsCSV(customerId, triggerDownload = false) {
  const customer = db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!customer) return null;

  const bills = db.all('SELECT * FROM bills WHERE customer_id = ? ORDER BY bill_date DESC', [customerId]);
  const csv = exportBillsCSV(bills);

  // Save each individual bill CSV
  for (const bill of bills) {
    exportSingleBillCSV(bill.id);
  }

  // Save summary CSV for customer
  const summaryPath = `data/customer/customer_${customerId}_all_bills.csv`;
  saveCSVToDataDir(summaryPath, csv);

  if (triggerDownload) {
    const filename = `bills_${customer.name.replace(/\s+/g, '_')}_${formatDateISO(new Date()).replace(/-/g, '')}.csv`;
    downloadFile(csv, filename, 'text/csv');
  }

  return csv;
}