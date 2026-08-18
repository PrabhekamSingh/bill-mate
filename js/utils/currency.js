/**
 * Currency Utilities
 * Indian Rupee formatting and parsing
 */

/**
 * Format number as Indian Rupees (₹1,23,456.78)
 */
export function formatINR(amount, options = {}) {
  const {
    showSymbol = true,
    decimals = 2,
    showZero = true
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return showZero ? (showSymbol ? '₹0.00' : '0.00') : '';
  }

  const num = Number(amount);
  const absNum = Math.abs(num);

  // Format with Indian numbering system (lakhs, crores)
  const formatted = absNum.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  const sign = num < 0 ? '-' : '';
  const symbol = showSymbol ? '₹' : '';

  return `${sign}${symbol}${formatted}`;
}

/**
 * Format compact (₹1.23L, ₹4.56Cr)
 */
export function formatINRCompact(amount, options = {}) {
  const { showSymbol = true } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '₹0' : '0';
  }

  const num = Number(amount);
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const symbol = showSymbol ? '₹' : '';

  if (absNum >= 10000000) { // 1 Crore
    return `${sign}${symbol}${(absNum / 10000000).toFixed(2)}Cr`;
  } else if (absNum >= 100000) { // 1 Lakh
    return `${sign}${symbol}${(absNum / 100000).toFixed(2)}L`;
  } else if (absNum >= 1000) {
    return `${sign}${symbol}${(absNum / 1000).toFixed(1)}K`;
  }

  return formatINR(amount, { showSymbol, decimals: 0 });
}

/**
 * Parse INR string to number
 */
export function parseINR(str) {
  if (!str) return 0;
  // Remove ₹, commas, spaces
  const cleaned = String(str).replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Calculate GST amount
 */
export function calculateGST(amount, gstRate) {
  const amt = parseINR(amount);
  const rate = parseFloat(gstRate) || 0;
  return amt * (rate / 100);
}

/**
 * Calculate total with GST
 */
export function calculateTotal(amount, gstRate) {
  const amt = parseINR(amount);
  const gst = calculateGST(amount, gstRate);
  return amt + gst;
}

/**
 * Split total into base + GST
 */
export function splitGST(total, gstRate) {
  const rate = parseFloat(gstRate) || 0;
  const base = total / (1 + rate / 100);
  const gst = total - base;
  return { base, gst };
}

/**
 * Round to 2 decimal places (for currency)
 */
export function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

/**
 * Format for display in tables (right-aligned)
 */
export function formatForTable(amount) {
  return formatINR(amount, { showSymbol: true, decimals: 2 });
}

/**
 * Get color class for positive/negative amounts
 */
export function getAmountColorClass(amount) {
  const num = parseINR(amount);
  if (num > 0) return 'text-positive';
  if (num < 0) return 'text-negative';
  return 'text-zero';
}