/**
 * Table Component
 * Sortable, filterable, paginated table
 */

export class Table {
  constructor(options = {}) {
    this.columns = options.columns || [];
    this.data = options.data || [];
    this.keyField = options.keyField || 'id';
    this.sortable = options.sortable !== false;
    this.filterable = options.filterable !== false;
    this.paginated = options.paginated !== false;
    this.pageSize = options.pageSize || 10;
    this.rowClick = options.rowClick || null;
    this.actions = options.actions || [];
    this.emptyMessage = options.emptyMessage || 'No data available';
    this.sortColumn = options.sortColumn || null;
    this.sortDirection = options.sortDirection || 'asc';
    this.filters = options.filters || {};

    this.currentPage = 1;
    this.filteredData = [...this.data];
    this.element = null;
  }

  /**
   * Render table
   */
  render() {
    this._applyFilters();
    this._applySort();

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageData = this.paginated ? this.filteredData.slice(start, end) : this.filteredData;
    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);

    let html = `
      <div class="table-container">
        ${this.filterable ? this._renderFilters() : ''}
        <div class="table-wrapper">
          <table class="data-table" role="grid">
            <thead>
              <tr>
                ${this.columns.map(col => `
                  <th scope="col" class="${col.class || ''}" ${col.width ? `style="width: ${col.width}"` : ''}>
                    ${this.sortable && col.sortable !== false ?
                      `<button class="sortable-header" data-sort="${col.key}" aria-sort="${this.sortColumn === col.key ? (this.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}">
                        ${col.header}
                        <span class="sort-icon"></span>
                      </button>` :
                      col.header
                    }
                  </th>
                `).join('')}
                ${this.actions.length > 0 ? '<th scope="col">Actions</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${pageData.length > 0 ? pageData.map(row => this._renderRow(row)).join('') :
                `<tr><td colspan="${this.columns.length + (this.actions.length > 0 ? 1 : 0)}" class="empty-state">${this.emptyMessage}</td></tr>`
              }
            </tbody>
          </table>
        </div>
        ${this.paginated && totalPages > 1 ? this._renderPagination(totalPages) : ''}
      </div>
    `;

    return html;
  }

  /**
   * Render a single row
   */
  _renderRow(row) {
    const rowId = row[this.keyField];
    const clickable = this.rowClick ? 'clickable-row' : '';

    return `
      <tr data-id="${rowId}" class="${clickable}">
        ${this.columns.map(col => {
          const value = this._getNestedValue(row, col.key);
          const formatted = col.format ? col.format(value, row) : value;
          return `<td class="${col.class || ''}" data-label="${col.header}">${formatted ?? ''}</td>`;
        }).join('')}
        ${this.actions.length > 0 ? `
          <td class="actions-cell">
            <div class="action-buttons">
              ${this.actions.map(action => `
                <button type="button"
                  class="btn btn-sm btn-${action.variant || 'secondary'}"
                  data-action="${action.name}"
                  data-id="${rowId}"
                  aria-label="${action.label}"
                  ${action.disabled ? 'disabled' : ''}>
                  ${action.icon || action.label}
                </button>
              `).join('')}
            </div>
          </td>
        ` : ''}
      </tr>
    `;
  }

  /**
   * Get nested object value by dot notation
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Render filter inputs
   */
  _renderFilters() {
    const filterableColumns = this.columns.filter(c => c.filterable !== false);
    if (filterableColumns.length === 0) return '';

    return `
      <div class="table-filters">
        ${filterableColumns.map(col => `
          <div class="filter-group">
            <label for="filter-${col.key}" class="visually-hidden">${col.header}</label>
            <input type="text"
              id="filter-${col.key}"
              class="filter-input"
              placeholder="Filter ${col.header}..."
              data-filter="${col.key}"
              value="${this.filters[col.key] || ''}">
          </div>
        `).join('')}
        <button type="button" class="btn btn-sm btn-secondary" data-clear-filters>Clear</button>
      </div>
    `;
  }

  /**
   * Render pagination
   */
  _renderPagination(totalPages) {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return `
      <div class="table-pagination">
        <div class="pagination-info">
          Showing ${((this.currentPage - 1) * this.pageSize) + 1} to ${Math.min(this.currentPage * this.pageSize, this.filteredData.length)} of ${this.filteredData.length} entries
        </div>
        <div class="pagination-controls">
          <button type="button" class="btn btn-sm btn-secondary" data-page="first" ${this.currentPage === 1 ? 'disabled' : ''} aria-label="First page">&laquo;</button>
          <button type="button" class="btn btn-sm btn-secondary" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">&lsaquo;</button>
          ${pages.map(p => `
            <button type="button" class="btn btn-sm ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" ${p === this.currentPage ? 'aria-current="page"' : ''}>${p}</button>
          `).join('')}
          <button type="button" class="btn btn-sm btn-secondary" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">&rsaquo;</button>
          <button type="button" class="btn btn-sm btn-secondary" data-page="last" ${this.currentPage === totalPages ? 'disabled' : ''} aria-label="Last page">&raquo;</button>
        </div>
        <div class="page-size-selector">
          <label for="page-size">Rows per page:</label>
          <select id="page-size" data-page-size>
            <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10</option>
            <option value="25" ${this.pageSize === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Apply filters to data
   */
  _applyFilters() {
    this.filteredData = this.data.filter(row => {
      return Object.entries(this.filters).every(([key, value]) => {
        if (!value) return true;
        const rowValue = this._getNestedValue(row, key);
        return String(rowValue).toLowerCase().includes(value.toLowerCase());
      });
    });
  }

  /**
   * Apply sorting
   */
  _applySort() {
    if (!this.sortColumn) return;

    const col = this.columns.find(c => c.key === this.sortColumn);
    if (!col) return;

    this.filteredData.sort((a, b) => {
      const aVal = this._getNestedValue(a, this.sortColumn);
      const bVal = this._getNestedValue(b, this.sortColumn);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Mount table to DOM element
   */
  mount(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) throw new Error('Container not found');

    container.innerHTML = this.render();
    this.element = container.querySelector('.table-container');
    this._bindEvents();
  }

  /**
   * Bind event listeners
   */
  _bindEvents() {
    if (!this.element) return;

    // Sort
    if (this.sortable) {
      this.element.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', (e) => {
          if (e.target.closest('button') !== th.querySelector('button')) return;
          const column = th.dataset.sort;
          this._handleSort(column);
        });
      });
    }

    // Filters
    if (this.filterable) {
      let filterTimeout;
      this.element.querySelectorAll('[data-filter]').forEach(input => {
        input.addEventListener('input', (e) => {
          clearTimeout(filterTimeout);
          filterTimeout = setTimeout(() => {
            this.filters[e.target.dataset.filter] = e.target.value;
            this.currentPage = 1;
            this.refresh();
          }, 300);
        });
      });

      this.element.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
        this.filters = {};
        this.element.querySelectorAll('[data-filter]').forEach(i => i.value = '');
        this.currentPage = 1;
        this.refresh();
      });
    }

    // Pagination
    if (this.paginated) {
      this.element.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const page = e.target.dataset.page;
          this._handlePageChange(page);
        });
      });

      this.element.querySelector('[data-page-size]')?.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value);
        this.currentPage = 1;
        this.refresh();
      });
    }

    // Actions
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const actionDef = this.actions.find(a => a.name === action);
        if (actionDef?.handler) actionDef.handler(id, btn);
      });
    });

    // Row click
    if (this.rowClick) {
      this.element.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('button, a, input, select')) return;
          const id = row.dataset.id;
          this.rowClick(id, row);
        });
      });
    }
  }

  /**
   * Handle sort
   */
  _handleSort(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.refresh();
  }

  /**
   * Handle page change
   */
  _handlePageChange(page) {
    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);

    switch (page) {
      case 'first': this.currentPage = 1; break;
      case 'last': this.currentPage = totalPages; break;
      case 'prev': this.currentPage = Math.max(1, this.currentPage - 1); break;
      case 'next': this.currentPage = Math.min(totalPages, this.currentPage + 1); break;
      default: this.currentPage = parseInt(page);
    }
    this.refresh();
  }

  /**
   * Update data and refresh
   */
  setData(data) {
    this.data = data;
    this.refresh();
  }

  /**
   * Refresh table display
   */
  refresh() {
    if (!this.element) return;
    const container = this.element.parentNode;
    container.innerHTML = this.render();
    this.element = container.querySelector('.table-container');
    this._bindEvents();
  }

  /**
   * Get selected row data
   */
  getRow(id) {
    return this.data.find(row => row[this.keyField] === id);
  }
}