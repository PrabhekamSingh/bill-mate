/**
 * Modal Component
 * Reusable modal dialog component
 */

export class Modal {
  constructor(options = {}) {
    this.id = options.id || `modal-${Date.now()}`;
    this.title = options.title || '';
    this.content = options.content || '';
    this.size = options.size || 'md'; // sm, md, lg, xl
    this.closable = options.closable !== false;
    this.onClose = options.onClose || null;
    this.onConfirm = options.onConfirm || null;
    this.confirmText = options.confirmText || 'Confirm';
    this.cancelText = options.cancelText || 'Cancel';
    this.showFooter = options.showFooter !== false;
    this.element = null;
  }

  /**
   * Create modal HTML
   */
  render() {
    const sizeClasses = {
      sm: 'modal-sm',
      md: 'modal-md',
      lg: 'modal-lg',
      xl: 'modal-xl'
    };

    const html = `
      <div class="modal-overlay" id="${this.id}-overlay" tabindex="-1">
        <div class="modal ${sizeClasses[this.size] || 'modal-md'}" id="${this.id}" role="dialog" aria-labelledby="${this.id}-title" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title" id="${this.id}-title">${this.title}</h3>
            ${this.closable ? `
              <button type="button" class="modal-close" aria-label="Close modal" data-modal-close>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="modal-body" id="${this.id}-body">
            ${this.content}
          </div>
          ${this.showFooter ? `
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-modal-cancel>${this.cancelText}</button>
              <button type="button" class="btn btn-primary" data-modal-confirm>${this.confirmText}</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Show modal
   */
  show() {
    // Remove existing modal with same ID
    const existing = document.getElementById(`${this.id}-overlay`);
    if (existing) existing.remove();

    // Create and append
    const container = document.createElement('div');
    container.innerHTML = this.render();
    this.element = container.firstElementChild;
    document.body.appendChild(this.element);

    // Focus management
    const focusable = this.element.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();

    // Event listeners
    this.element.querySelector('[data-modal-close]')?.addEventListener('click', () => this.hide(false));
    this.element.querySelector('[data-modal-cancel]')?.addEventListener('click', () => this.hide(false));
    this.element.querySelector('[data-modal-confirm]')?.addEventListener('click', async () => {
      if (this.onConfirm) {
        const result = await this.onConfirm(this);
        if (result === false) return; // validation failed — keep modal open
      }
      this.hide(true);
    });

    // Close on overlay click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.hide(false);
    });

    // Keyboard handling
    this._handleKeydown = (e) => {
      if (e.key === 'Escape' && this.closable) this.hide(false);
      if (e.key === 'Tab') this._trapFocus(e);
    };
    document.addEventListener('keydown', this._handleKeydown);

    // Animation
    requestAnimationFrame(() => {
      this.element.classList.add('show');
    });

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  /**
   * Hide modal
   */
  hide(confirmed = false) {
    if (!this.element) return;

    this.element.classList.remove('show');

    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      this.element = null;
      document.removeEventListener('keydown', this._handleKeydown);

      if (this._resolve) {
        this._resolve(confirmed);
        this._resolve = null;
      }

      if (this.onClose) this.onClose(confirmed);
    }, 200);
  }

  /**
   * Trap focus within modal
   */
  _trapFocus(e) {
    const focusable = this.element.querySelectorAll(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * Update modal content
   */
  setContent(content) {
    this.content = content;
    const body = this.element?.querySelector('.modal-body');
    if (body) body.innerHTML = content;
  }

  /**
   * Update modal title
   */
  setTitle(title) {
    this.title = title;
    const titleEl = this.element?.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = title;
  }

  /**
   * Static confirm dialog
   */
  static confirm(message, title = 'Confirm') {
    return new Modal({
      title,
      content: `<p>${message}</p>`,
      size: 'sm',
      confirmText: 'Yes',
      cancelText: 'No'
    }).show();
  }

  /**
   * Static alert dialog
   */
  static alert(message, title = 'Alert') {
    return new Modal({
      title,
      content: `<p>${message}</p>`,
      size: 'sm',
      showFooter: true,
      confirmText: 'OK',
      cancelText: ''
    }).show();
  }
}

/**
 * Toast/Notification Component
 */
export class Toast {
  static container = null;

  static init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(this.container);
  }

  static show(message, type = 'info', duration = 3000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" aria-label="Dismiss">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => this.dismiss(toast));

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }

    return toast;
  }

  static dismiss(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }

  static success(message, duration) { return this.show(message, 'success', duration); }
  static error(message, duration) { return this.show(message, 'error', duration); }
  static warning(message, duration) { return this.show(message, 'warning', duration); }
  static info(message, duration) { return this.show(message, 'info', duration); }
}