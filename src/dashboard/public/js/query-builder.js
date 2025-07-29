// Advanced Query Builder
class QueryBuilder {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.conditions = [];
    this.init();
  }

  init() {
    this.setupHTML();
    this.setupStyles();
    this.addCondition();
  }

  setupHTML() {
    this.container.innerHTML = `
      <div class="query-builder">
        <div class="query-header">
          <h3 class="query-title">Advanced Query Builder</h3>
          <div class="query-actions">
            <button type="button" class="btn btn-secondary" onclick="queryBuilder.clear()">Clear</button>
            <button type="button" class="btn btn-primary" onclick="queryBuilder.execute()">Execute Query</button>
          </div>
        </div>
        
        <div class="query-conditions" id="query-conditions"></div>
        
        <div class="query-add">
          <button type="button" class="btn btn-outline" onclick="queryBuilder.addCondition()">
            <span>+</span> Add Condition
          </button>
        </div>

        <div class="query-preview">
          <h4>Query Preview</h4>
          <pre class="query-code" id="query-preview">// Your query will appear here</pre>
        </div>

        <div class="query-results" id="query-results" style="display: none;">
          <h4>Results</h4>
          <div class="results-content"></div>
        </div>
      </div>
    `;
  }

  setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .query-builder {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        margin: var(--space-lg) 0;
      }

      .query-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-md);
        border-bottom: 1px solid var(--border-color);
      }

      .query-title {
        color: var(--text-primary);
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .query-actions {
        display: flex;
        gap: var(--space-sm);
      }

      .query-condition {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        margin-bottom: var(--space-md);
      }

      .query-condition select,
      .query-condition input {
        padding: var(--space-sm);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 0.875rem;
      }

      .query-condition select {
        min-width: 120px;
      }

      .query-condition input {
        flex: 1;
        min-width: 200px;
      }

      .condition-remove {
        background: var(--error);
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .query-add {
        margin: var(--space-lg) 0;
      }

      .query-preview {
        margin-top: var(--space-lg);
      }

      .query-preview h4 {
        color: var(--text-primary);
        margin-bottom: var(--space-md);
        font-size: 1rem;
      }

      .query-code {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        color: var(--text-secondary);
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.875rem;
        white-space: pre-wrap;
        margin: 0;
      }

      .query-results {
        margin-top: var(--space-lg);
        padding-top: var(--space-lg);
        border-top: 1px solid var(--border-color);
      }

      .query-results h4 {
        color: var(--text-primary);
        margin-bottom: var(--space-md);
      }

      .results-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg-surface);
        border-radius: var(--radius-md);
        overflow: hidden;
      }

      .results-table th,
      .results-table td {
        padding: var(--space-sm);
        text-align: left;
        border-bottom: 1px solid var(--border-color);
      }

      .results-table th {
        background: var(--bg-card);
        color: var(--text-primary);
        font-weight: 600;
      }

      .results-table td {
        color: var(--text-secondary);
      }
    `;
    document.head.appendChild(style);
  }

  addCondition() {
    const conditionId = Date.now();
    const conditionDiv = document.createElement('div');
    conditionDiv.className = 'query-condition';
    conditionDiv.dataset.id = conditionId;

    conditionDiv.innerHTML = `
      ${this.conditions.length > 0 ? `
        <select class="condition-logic" onchange="queryBuilder.updatePreview()">
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
      ` : ''}
      
      <select class="condition-field" onchange="queryBuilder.updatePreview()">
        <option value="">Select Field</option>
        <option value="id">ID</option>
        <option value="name">Name</option>
        <option value="email">Email</option>
        <option value="age">Age</option>
        <option value="status">Status</option>
        <option value="created_at">Created At</option>
        <option value="updated_at">Updated At</option>
      </select>

      <select class="condition-operator" onchange="queryBuilder.updatePreview()">
        <option value="equals">Equals</option>
        <option value="not_equals">Not Equals</option>
        <option value="contains">Contains</option>
        <option value="starts_with">Starts With</option>
        <option value="ends_with">Ends With</option>
        <option value="greater_than">Greater Than</option>
        <option value="less_than">Less Than</option>
        <option value="is_null">Is Null</option>
        <option value="is_not_null">Is Not Null</option>
      </select>

      <input type="text" class="condition-value" placeholder="Value" 
             oninput="queryBuilder.updatePreview()">

      <button type="button" class="condition-remove" 
              onclick="queryBuilder.removeCondition(${conditionId})">&times;</button>
    `;

    document.getElementById('query-conditions').appendChild(conditionDiv);
    this.conditions.push(conditionId);
    this.updatePreview();
  }

  removeCondition(conditionId) {
    const condition = document.querySelector(`[data-id="${conditionId}"]`);
    if (condition) {
      condition.remove();
      this.conditions = this.conditions.filter(id => id !== conditionId);
      this.updatePreview();
    }
  }

  updatePreview() {
    const conditions = Array.from(document.querySelectorAll('.query-condition'));
    let query = 'collection.find({\n';

    const queryConditions = [];

    conditions.forEach((condition, index) => {
      const field = condition.querySelector('.condition-field')?.value;
      const operator = condition.querySelector('.condition-operator')?.value;
      const value = condition.querySelector('.condition-value')?.value;
      const logic = condition.querySelector('.condition-logic')?.value;

      if (field && operator) {
        let conditionStr = '';
        
        switch (operator) {
          case 'equals':
            conditionStr = `  "${field}": ${this.formatValue(value)}`;
            break;
          case 'not_equals':
            conditionStr = `  "${field}": { $ne: ${this.formatValue(value)} }`;
            break;
          case 'contains':
            conditionStr = `  "${field}": { $regex: /${value}/i }`;
            break;
          case 'starts_with':
            conditionStr = `  "${field}": { $regex: /^${value}/i }`;
            break;
          case 'ends_with':
            conditionStr = `  "${field}": { $regex: /${value}$/i }`;
            break;
          case 'greater_than':
            conditionStr = `  "${field}": { $gt: ${this.formatValue(value)} }`;
            break;
          case 'less_than':
            conditionStr = `  "${field}": { $lt: ${this.formatValue(value)} }`;
            break;
          case 'is_null':
            conditionStr = `  "${field}": null`;
            break;
          case 'is_not_null':
            conditionStr = `  "${field}": { $ne: null }`;
            break;
        }

        if (conditionStr) {
          if (index > 0 && logic) {
            queryConditions.push(`  // ${logic}`);
          }
          queryConditions.push(conditionStr);
        }
      }
    });

    query += queryConditions.join(',\n');
    query += '\n});';

    document.getElementById('query-preview').textContent = query;
  }

  formatValue(value) {
    if (!value) return '""';
    if (!isNaN(value)) return value;
    return `"${value}"`;
  }

  clear() {
    document.getElementById('query-conditions').innerHTML = '';
    this.conditions = [];
    this.addCondition();
    document.getElementById('query-results').style.display = 'none';
  }

  async execute() {
    const query = document.getElementById('query-preview').textContent;
    
    try {
      // Show loading
      const resultsDiv = document.getElementById('query-results');
      resultsDiv.style.display = 'block';
      resultsDiv.querySelector('.results-content').innerHTML = '<div class="loading">Executing query...</div>';

      // Simulate API call
      setTimeout(() => {
        const mockResults = [
          { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, status: 'active' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 28, status: 'active' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, status: 'inactive' }
        ];

        this.displayResults(mockResults);
        
        if (window.notifications) {
          window.notifications.success(`Query Executed - Found ${mockResults.length} records`);
        }
      }, 1000);

    } catch (error) {
      if (window.notifications) {
        window.notifications.error(`Query Error - Failed to execute query: ${error.message}`);
      }
    }
  }

  displayResults(results) {
    const resultsContent = document.getElementById('query-results').querySelector('.results-content');
    
    if (results.length === 0) {
      resultsContent.innerHTML = '<div class="no-results">No results found</div>';
      return;
    }

    const headers = Object.keys(results[0]);
    let tableHTML = '<table class="results-table"><thead><tr>';
    
    headers.forEach(header => {
      tableHTML += `<th>${header}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    results.forEach(row => {
      tableHTML += '<tr>';
      headers.forEach(header => {
        tableHTML += `<td>${row[header] || ''}</td>`;
      });
      tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    resultsContent.innerHTML = tableHTML;
  }
}

// Initialize query builder when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('query-builder-container')) {
    window.queryBuilder = new QueryBuilder('query-builder-container');
  }
});
