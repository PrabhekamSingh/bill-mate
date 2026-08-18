/**
 * Form Component
 * Form handling utilities with validation
 */

import { validateForm, rules } from '../utils/validation.js';

export class Form {
  constructor(formElement, options = {}) {
    this.form = typeof formElement === 'string' ? document.querySelector(formElement) : formElement;
    if (!this.form) throw new Error('Form element not found');

    this.rules = options.rules || {};
    this.onSubmit = options.onSubmit || null;
    this.onError = options.onError || null;
    this.submitButton = this.form.querySelector('[type="submit"]') || this.form.querySelector('.btn-primary');

    this._bindEvents();
  }

  /**
   * Bind form events
   */
  _bindEvents() {
    this.form.addEventListener('submit', (e) => this._handleSubmit(e));

    // Real-time validation on blur
    this.form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('blur', () => this._validateField(field));
      field.addEventListener('input', () => this._clearError(field));
    });
  }

  /**
   * Handle form submission
   */
  async _handleSubmit(e) {
    e.preventDefault();

    const formData = this.getData();
    const validation = validateForm(formData, this.rules);

    if (!validation.isValid) {
      this._showErrors(validation.errors);
      if (this.onError) this.onError(validation.errors);
      return;
    }

    // Disable submit button
    if (this.submitButton) {
      this.submitButton.disabled = true;
      this.submitButton.dataset.originalText = this.submitButton.textContent;
      this.submitButton.textContent = 'Saving...';
    }

    try {
      if (this.onSubmit) {
        await this.onSubmit(formData, this);
      }
    } catch (error) {
      console.error('Form submit error:', error);
      this._showError('form', error.message || 'An error occurred');
    } finally {
      if (this.submitButton) {
        this.submitButton.disabled = false;
        this.submitButton.textContent = this.submitButton.dataset.originalText || 'Save';
      }
    }
  }

  /**
   * Validate a single field
   */
  _validateField(field) {
    const name = field.name;
    if (!this.rules[name]) return true;

    const value = field.value;
    const error = validate(value, this.rules[name]);

    if (error) {
      this._showFieldError(field, error);
      return false;
    } else {
      this._clearError(field);
      return true;
    }
  }

  /**
   * Show field error
   */
  _showFieldError(field, message) {
    this._clearError(field);
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');

    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    errorEl.setAttribute('role', 'alert');
    field.parentNode.appendChild(errorEl);
  }

  /**
   * Clear field error
   */
  _clearError(field) {
    field.classList.remove('error');
    field.removeAttribute('aria-invalid');
    const errorEl = field.parentNode.querySelector('.field-error');
    if (errorEl) errorEl.remove();
  }

  /**
   * Show multiple errors
   */
  _showErrors(errors) {
    Object.entries(errors).forEach(([field, message]) => {
      const input = this.form.querySelector(`[name="${field}"]`);
      if (input) this._showFieldError(input, message);
    });

    // Focus first error
    const firstError = this.form.querySelector('.error');
    if (firstError) firstError.focus();
  }

  /**
   * Show form-level error
   */
  _showError(field, message) {
    const input = this.form.querySelector(`[name="${field}"]`);
    if (input) {
      this._showFieldError(input, message);
    } else {
      // Show as toast or alert
      const errorDiv = document.createElement('div');
      errorDiv.className = 'form-error';
      errorDiv.textContent = message;
      errorDiv.setAttribute('role', 'alert');
      this.form.prepend(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }

  /**
   * Get form data as object
   */
  getData() {
    const formData = new FormData(this.form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      // Handle checkboxes
      if (value === 'on') {
        data[key] = true;
      } else if (data[key] !== undefined) {
        // Multiple values (checkbox group)
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Set form data
   */
  setData(data) {
    Object.entries(data).forEach(([key, value]) => {
      const field = this.form.querySelector(`[name="${key}"]`);
      if (!field) return;

      if (field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else if (field.type === 'radio') {
        const radio = this.form.querySelector(`[name="${key}"][value="${value}"]`);
        if (radio) radio.checked = true;
      } else if (field.multiple && Array.isArray(value)) {
        Array.from(field.options).forEach(opt => opt.selected = value.includes(opt.value));
      } else {
        field.value = value ?? '';
      }
    });
  }

  /**
   * Reset form
   */
  reset() {
    this.form.reset();
    this.form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    this.form.querySelectorAll('.field-error').forEach(el => el.remove());
    this.form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  }

  /**
   * Enable/disable form
   */
  setDisabled(disabled) {
    this.form.querySelectorAll('input, select, textarea, button').forEach(el => {
      el.disabled = disabled;
    });
  }

  /**
   * Static factory method
   */
  static create(formElement, options) {
    return new Form(formElement, options);
  }
}

/**
 * Dynamic Form Builder
 * Build forms programmatically
 */
export class FormBuilder {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.fields = options.fields || [];
    this.form = null;
  }

  /**
   * Build and render form
   */
  build() {
    this.form = document.createElement('form');
    this.form.className = 'dynamic-form';
    this.form.noValidate = true;

    this.fields.forEach(field => {
      this.form.appendChild(this._createField(field));
    });

    this.container.innerHTML = '';
    this.container.appendChild(this.form);

    return this.form;
  }

  /**
   * Create field element
   */
  _createField(field) {
    const wrapper = document.createElement('div');
    wrapper.className = `form-group ${field.class || ''}`;

    const label = document.createElement('label');
    label.htmlFor = field.name;
    label.textContent = field.label + (field.required ? ' *' : '');
    wrapper.appendChild(label);

    let input;

    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.rows = field.rows || 3;
        break;
      case 'select':
        input = document.createElement('select');
        if (field.options) {
          field.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            input.appendChild(option);
          });
        }
        break;
      case 'checkbox':
        wrapper.classList.add('checkbox-group');
        input = document.createElement('input');
        input.type = 'checkbox';
        wrapper.insertBefore(input, label);
        break;
      case 'radio':
        wrapper.classList.add('radio-group');
        input = document.createElement('div');
        input.className = 'radio-options';
        field.options.forEach(opt => {
          const radioWrapper = document.createElement('label');
          radioWrapper.className = 'radio-option';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = field.name;
          radio.value = opt.value;
          radio.id = `${field.name}-${opt.value}`;
          radioWrapper.appendChild(radio);
          radioWrapper.appendChild(document.createTextNode(' ' + opt.label));
          input.appendChild(radioWrapper);
        });
        wrapper.appendChild(input);
        return wrapper;
      default:
        input = document.createElement('input');
        input.type = field.type || 'text';
    }

    if (input.tagName !== 'DIV') {
      input.id = field.name;
      input.name = field.name;
      input.placeholder = field.placeholder || '';
      input.required = field.required || false;
      input.disabled = field.disabled || false;
      if (field.value !== undefined) input.value = field.value;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;
      wrapper.appendChild(input);
    }

    if (field.help) {
      const help = document.createElement('small');
      help.className = 'form-help';
      help.textContent = field.help;
      wrapper.appendChild(help);
    }

    return wrapper;
  }

  /**
   * Get form instance
   */
  getForm(options = {}) {
    if (!this.form) this.build();
    return new Form(this.form, options);
  }
}