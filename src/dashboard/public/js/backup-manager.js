// Data Backup & Export Manager
class BackupManager {
  constructor() {
    this.backupHistory = [];
    this.isBackingUp = false;
    this.init();
  }

  init() {
    this.createBackupInterface();
    this.loadBackupHistory();
  }

  createBackupInterface() {
    const container = document.getElementById('backup-manager');
    if (!container) return;

    container.innerHTML = `
      <div class="backup-dashboard">
        <div class="backup-header">
          <h3 class="backup-title">Data Backup & Export</h3>
          <div class="backup-actions">
            <button class="btn btn-primary" onclick="backupManager.createBackup()">
              <span class="icon">💾</span> Create Backup
            </button>
            <button class="btn btn-secondary" onclick="backupManager.exportData()">
              <span class="icon">📤</span> Export Data
            </button>
          </div>
        </div>

        <div class="backup-options">
          <div class="option-group">
            <h4>Backup Options</h4>
            <div class="backup-settings">
              <label class="checkbox-label">
                <input type="checkbox" id="include-data" checked>
                <span class="checkmark"></span>
                Include Collection Data
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="include-schema" checked>
                <span class="checkmark"></span>
                Include Schema Definitions
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="include-config" checked>
                <span class="checkmark"></span>
                Include Configuration
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="compress-backup">
                <span class="checkmark"></span>
                Compress Backup (ZIP)
              </label>
            </div>
          </div>

          <div class="option-group">
            <h4>Export Format</h4>
            <div class="export-formats">
              <label class="radio-label">
                <input type="radio" name="export-format" value="json" checked>
                <span class="radio-mark"></span>
                JSON
              </label>
              <label class="radio-label">
                <input type="radio" name="export-format" value="csv">
                <span class="radio-mark"></span>
                CSV
              </label>
              <label class="radio-label">
                <input type="radio" name="export-format" value="xml">
                <span class="radio-mark"></span>
                XML
              </label>
              <label class="radio-label">
                <input type="radio" name="export-format" value="sql">
                <span class="radio-mark"></span>
                SQL
              </label>
            </div>
          </div>
        </div>

        <div class="backup-progress" id="backup-progress" style="display: none;">
          <div class="progress-header">
            <h4>Backup in Progress</h4>
            <span class="progress-percentage">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-status">Initializing backup...</div>
        </div>

        <div class="backup-history">
          <h4>Backup History</h4>
          <div class="history-list" id="backup-history-list">
            <div class="no-backups">No backups created yet</div>
          </div>
        </div>
      </div>
    `;

    this.setupBackupStyles();
  }

  setupBackupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .backup-dashboard {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        margin: var(--space-lg) 0;
      }

      .backup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-xl);
        padding-bottom: var(--space-lg);
        border-bottom: 1px solid var(--border-color);
      }

      .backup-title {
        color: var(--text-primary);
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }

      .backup-actions {
        display: flex;
        gap: var(--space-md);
      }

      .backup-actions .icon {
        margin-right: var(--space-sm);
      }

      .backup-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-xl);
        margin-bottom: var(--space-xl);
      }

      .option-group h4 {
        color: var(--text-primary);
        margin: 0 0 var(--space-md) 0;
        font-size: 1.125rem;
        font-weight: 600;
      }

      .backup-settings,
      .export-formats {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .checkbox-label,
      .radio-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        user-select: none;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .checkbox-label input,
      .radio-label input {
        display: none;
      }

      .checkmark,
      .radio-mark {
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-color);
        margin-right: var(--space-sm);
        position: relative;
        transition: all 0.2s ease;
      }

      .checkmark {
        border-radius: 4px;
      }

      .radio-mark {
        border-radius: 50%;
      }

      .checkbox-label input:checked + .checkmark,
      .radio-label input:checked + .radio-mark {
        border-color: var(--primary);
        background: var(--primary);
      }

      .checkbox-label input:checked + .checkmark::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 12px;
        font-weight: bold;
      }

      .radio-label input:checked + .radio-mark::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: white;
      }

      .backup-progress {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        margin-bottom: var(--space-xl);
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-md);
      }

      .progress-header h4 {
        color: var(--text-primary);
        margin: 0;
        font-size: 1rem;
      }

      .progress-percentage {
        color: var(--primary);
        font-weight: 600;
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: var(--bg-primary);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: var(--space-sm);
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary), var(--primary-dark));
        width: 0%;
        transition: width 0.3s ease;
      }

      .progress-status {
        color: var(--text-secondary);
        font-size: 0.875rem;
      }

      .backup-history h4 {
        color: var(--text-primary);
        margin: 0 0 var(--space-md) 0;
        font-size: 1.125rem;
        font-weight: 600;
      }

      .history-list {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        max-height: 300px;
        overflow-y: auto;
      }

      .no-backups {
        color: var(--text-muted);
        text-align: center;
        padding: var(--space-xl);
        font-size: 0.875rem;
      }

      .backup-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-md);
        border-bottom: 1px solid var(--border-color);
        transition: background 0.2s ease;
      }

      .backup-item:hover {
        background: var(--bg-hover);
      }

      .backup-item:last-child {
        border-bottom: none;
      }

      .backup-info {
        flex: 1;
      }

      .backup-name {
        color: var(--text-primary);
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 4px;
      }

      .backup-meta {
        color: var(--text-muted);
        font-size: 0.75rem;
        display: flex;
        gap: var(--space-md);
      }

      .backup-actions-item {
        display: flex;
        gap: var(--space-sm);
      }

      .btn-icon {
        padding: var(--space-sm);
        min-width: auto;
        border-radius: 6px;
        font-size: 0.875rem;
      }

      @media (max-width: 768px) {
        .backup-options {
          grid-template-columns: 1fr;
        }
        
        .backup-header {
          flex-direction: column;
          gap: var(--space-md);
        }
      }
    `;
    document.head.appendChild(style);
  }

  async createBackup() {
    if (this.isBackingUp) return;

    this.isBackingUp = true;
    const progressDiv = document.getElementById('backup-progress');
    progressDiv.style.display = 'block';

    const includeData = document.getElementById('include-data').checked;
    const includeSchema = document.getElementById('include-schema').checked;
    const includeConfig = document.getElementById('include-config').checked;
    const compress = document.getElementById('compress-backup').checked;

    try {
      // Simulate backup process
      await this.simulateBackupProgress();

      const backup = {
        id: Date.now(),
        name: `Backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`,
        date: new Date(),
        size: this.generateRandomSize(),
        type: compress ? 'ZIP' : 'JSON',
        includes: {
          data: includeData,
          schema: includeSchema,
          config: includeConfig
        }
      };

      this.backupHistory.unshift(backup);
      this.saveBackupHistory();
      this.renderBackupHistory();

      if (window.notifications) {
        window.notifications.success(`Backup Created - "${backup.name}" created successfully`);
      }

    } catch (error) {
      if (window.notifications) {
        window.notifications.error(`Backup Failed - Failed to create backup: ${error.message}`);
      }
    } finally {
      this.isBackingUp = false;
      progressDiv.style.display = 'none';
    }
  }

  async simulateBackupProgress() {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercentage = document.querySelector('.progress-percentage');
    const progressStatus = document.querySelector('.progress-status');

    const steps = [
      { progress: 10, status: 'Preparing backup...' },
      { progress: 25, status: 'Reading collection data...' },
      { progress: 50, status: 'Processing schemas...' },
      { progress: 75, status: 'Compressing data...' },
      { progress: 90, status: 'Finalizing backup...' },
      { progress: 100, status: 'Backup completed!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      progressFill.style.width = `${step.progress}%`;
      progressPercentage.textContent = `${step.progress}%`;
      progressStatus.textContent = step.status;
    }
  }

  async exportData() {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    
    try {
      window.notifications && window.notifications.info(
        'Export Started',
        `Exporting data in ${format.toUpperCase()} format...`
      );

      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock export data
      const exportData = this.generateExportData(format);
      this.downloadFile(exportData, `bigbase_export_${Date.now()}.${format}`);

      window.notifications && window.notifications.success(
        'Export Complete',
        `Data exported successfully in ${format.toUpperCase()} format`
      );

    } catch (error) {
      window.notifications && window.notifications.error(
        'Export Failed',
        'Failed to export data: ' + error.message
      );
    }
  }

  generateExportData(format) {
    const mockData = [
      { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 28 },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
    ];

    switch (format) {
      case 'json':
        return JSON.stringify(mockData, null, 2);
      
      case 'csv':
        const headers = Object.keys(mockData[0]).join(',');
        const rows = mockData.map(row => Object.values(row).join(',')).join('\n');
        return `${headers}\n${rows}`;
      
      case 'xml':
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
        mockData.forEach(item => {
          xml += '  <record>\n';
          Object.entries(item).forEach(([key, value]) => {
            xml += `    <${key}>${value}</${key}>\n`;
          });
          xml += '  </record>\n';
        });
        xml += '</data>';
        return xml;
      
      case 'sql':
        let sql = 'CREATE TABLE IF NOT EXISTS users (\n';
        sql += '  id INTEGER PRIMARY KEY,\n';
        sql += '  name VARCHAR(255),\n';
        sql += '  email VARCHAR(255),\n';
        sql += '  age INTEGER\n';
        sql += ');\n\n';
        mockData.forEach(item => {
          sql += `INSERT INTO users (id, name, email, age) VALUES (${item.id}, '${item.name}', '${item.email}', ${item.age});\n`;
        });
        return sql;
      
      default:
        return JSON.stringify(mockData, null, 2);
    }
  }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  generateRandomSize() {
    const sizes = ['KB', 'MB'];
    const size = Math.random() * 100 + 10;
    const unit = sizes[Math.floor(Math.random() * sizes.length)];
    return `${size.toFixed(1)} ${unit}`;
  }

  renderBackupHistory() {
    const historyList = document.getElementById('backup-history-list');
    
    if (this.backupHistory.length === 0) {
      historyList.innerHTML = '<div class="no-backups">No backups created yet</div>';
      return;
    }

    historyList.innerHTML = this.backupHistory.map(backup => `
      <div class="backup-item">
        <div class="backup-info">
          <div class="backup-name">${backup.name}</div>
          <div class="backup-meta">
            <span>📅 ${backup.date.toLocaleDateString()}</span>
            <span>⏰ ${backup.date.toLocaleTimeString()}</span>
            <span>📁 ${backup.size}</span>
            <span>📦 ${backup.type}</span>
          </div>
        </div>
        <div class="backup-actions-item">
          <button class="btn btn-outline btn-icon" onclick="backupManager.downloadBackup(${backup.id})" title="Download">
            ⬇️
          </button>
          <button class="btn btn-secondary btn-icon" onclick="backupManager.restoreBackup(${backup.id})" title="Restore">
            🔄
          </button>
          <button class="btn btn-danger btn-icon" onclick="backupManager.deleteBackup(${backup.id})" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  downloadBackup(backupId) {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) return;

    window.notifications && window.notifications.info(
      'Download Started',
      `Downloading backup "${backup.name}"`
    );

    // Simulate download
    setTimeout(() => {
      window.notifications && window.notifications.success(
        'Download Complete',
        `Backup "${backup.name}" downloaded successfully`
      );
    }, 1000);
  }

  async restoreBackup(backupId) {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) return;

    const confirmed = confirm(`Are you sure you want to restore backup "${backup.name}"? This will overwrite current data.`);
    if (!confirmed) return;

    try {
      window.notifications && window.notifications.info(
        'Restore Started',
        `Restoring backup "${backup.name}"`
      );

      // Simulate restore process
      await new Promise(resolve => setTimeout(resolve, 3000));

      window.notifications && window.notifications.success(
        'Restore Complete',
        `Backup "${backup.name}" restored successfully`
      );

    } catch (error) {
      window.notifications && window.notifications.error(
        'Restore Failed',
        'Failed to restore backup: ' + error.message
      );
    }
  }

  deleteBackup(backupId) {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) return;

    const confirmed = confirm(`Are you sure you want to delete backup "${backup.name}"?`);
    if (!confirmed) return;

    this.backupHistory = this.backupHistory.filter(b => b.id !== backupId);
    this.saveBackupHistory();
    this.renderBackupHistory();

    window.notifications && window.notifications.success(
      'Backup Deleted',
      `Backup "${backup.name}" deleted successfully`
    );
  }

  loadBackupHistory() {
    const saved = localStorage.getItem('bigbase_backup_history');
    if (saved) {
      this.backupHistory = JSON.parse(saved).map(backup => ({
        ...backup,
        date: new Date(backup.date)
      }));
      this.renderBackupHistory();
    }
  }

  saveBackupHistory() {
    localStorage.setItem('bigbase_backup_history', JSON.stringify(this.backupHistory));
  }
}

// Initialize backup manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('backup-manager')) {
    window.backupManager = new BackupManager();
  }
});
