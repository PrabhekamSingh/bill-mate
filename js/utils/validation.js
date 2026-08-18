/**
 * Validation Utilities
 * Form validation helpers
 */

/**
 * Validate required field
 */
export function required(value, fieldName = 'Field') {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${fieldName} is required`;
  }
  return null;
}

/**
 * Validate string length
 */
export function minLength(value, min, fieldName = 'Field') {
  if (value && String(value).trim().length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  return null;
}

export function maxLength(value, max, fieldName = 'Field') {
  if (value && String(value).trim().length > max) {
    return `${fieldName} must not exceed ${max} characters`;
  }
  return null;
}

/**
 * Validate email format
 */
export function email(value, fieldName = 'Email') {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `${fieldName} must be a valid email address`;
  }
  return null;
}

/**
 * Validate phone number (Indian format)
 */
export function phone(value, fieldName = 'Phone') {
  if (value && !/^[\d\s\-\+\(\)]{10,15}$/.test(value)) {
    return `${fieldName} must be a valid phone number`;
  }
  return null;
}

/**
 * Validate positive number
 */
export function positiveNumber(value, fieldName = 'Amount') {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    return `${fieldName} must be a positive number`;
  }
  return null;
}

/**
 * Validate number range
 */
export function numberRange(value, min, max, fieldName = 'Value') {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} must be a number`;
  }
  if (num < min || num > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

/**
 * Validate GST rate (0-28%)
 */
export function gstRate(value, fieldName = 'GST Rate') {
  return numberRange(value, 0, 28, fieldName);
}

/**
 * Validate date (YYYY-MM-DD or DD/MM/YYYY)
 */
export function date(value, fieldName = 'Date') {
  if (!value) return null;

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      return `${fieldName} must be a valid date`;
    }
    return null;
  }

  // Try DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const parts = value.split('/');
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    if (isNaN(d.getTime())) {
      return `${fieldName} must be a valid date`;
    }
    return null;
  }

  return `${fieldName} must be in YYYY-MM-DD or DD/MM/YYYY format`;
}

/**
 * Validate date not in future
 */
export function dateNotFuture(value, fieldName = 'Date') {
  const err = date(value, fieldName);
  if (err) return err;

  const inputDate = new Date(value.replace(/\//g, '-'));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate > today) {
    return `${fieldName} cannot be in the future`;
  }
  return null;
}

/**
 * Run multiple validators and return first error
 */
export function validate(value, validators) {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
}

/**
 * Validate entire form
 */
export function validateForm(formData, rules) {
  const errors = {};

  for (const [field, validators] of Object.entries(rules)) {
    const value = formData[field];
    const error = validate(value, validators);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Common validation rules
 */
export const rules = {
  customerName: [v => required(v, 'Customer Name'), v => minLength(v, 2, 'Customer Name'), v => maxLength(v, 100, 'Customer Name')],
  customerPhone: [v => phone(v, 'Phone')],
  customerEmail: [v => email(v, 'Email')],
  itemName: [v => required(v, 'Item Name'), v => minLength(v, 1, 'Item Name'), v => maxLength(v, 100, 'Item Name')],
  itemRate: [v => required(v, 'Rate'), v => positiveNumber(v, 'Rate')],
  itemGstRate: [v => gstRate(v, 'GST Rate')],
  billDate: [v => required(v, 'Bill Date'), v => dateNotFuture(v, 'Bill Date')],
  billNumber: [v => required(v, 'Bill Number'), v => minLength(v, 1, 'Bill Number')],
  quantity: [v => required(v, 'Quantity'), v => positiveNumber(v, 'Quantity')],
  rate: [v => required(v, 'Rate'), v => positiveNumber(v, 'Rate')],
  gstRate: [v => gstRate(v, 'GST Rate')],
  paymentAmount: [v => required(v, 'Amount'), v => positiveNumber(v, 'Amount')],
  paymentDate: [v => required(v, 'Payment Date'), v => dateNotFuture(v, 'Payment Date')],
  paymentMode: [v => required(v, 'Payment Mode')]
};