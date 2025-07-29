import { promises as fs, existsSync } from 'fs';
import { join } from 'path';

/**
 * Audit Logger for BigBaseAlpha
 * Tracks all database operations for security and compliance
 */
export class AuditLogger {
  constructor(config) {
    this.config = config;
    this.enabled = config.auditLog !== false;
    this.logPath = join(config.path, 'audit.log');
    this.maxLogSize = config.maxLogSize || 100 * 1024 * 1024; // 100MB
    this.retentionDays = config.logRetentionDays || 30;
  }

  async init() {
    if (!this.enabled) {
      return;
    }

    // Create initial log entry
    await this.log('system', 'audit_started', {
      timestamp: new Date(),
      version: '1.0.0'
    });
  }

  /**
   * Log an operation
   */
  async log(category, operation, details = {}) {
    if (!this.enabled) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      category,
      operation,
      details,
      session: this._getSessionId(),
      user: details.user || 'system'
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      // Check log rotation
      await this._checkLogRotation();
      
      // Append to log file
      await fs.appendFile(this.logPath, logLine);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Query audit logs
   */
  async query(filters = {}) {
    if (!this.enabled || !existsSync(this.logPath)) {
      return [];
    }

    try {
      const logContent = await fs.readFile(this.logPath, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line);
      
      let entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(entry => entry);

      // Apply filters
      if (filters.category) {
        entries = entries.filter(entry => entry.category === filters.category);
      }
      
      if (filters.operation) {
        entries = entries.filter(entry => entry.operation === filters.operation);
      }
      
      if (filters.user) {
        entries = entries.filter(entry => entry.user === filters.user);
      }
      
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        entries = entries.filter(entry => new Date(entry.timestamp) >= start);
      }
      
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        entries = entries.filter(entry => new Date(entry.timestamp) <= end);
      }

      // Apply pagination
      if (filters.limit) {
        entries = entries.slice(0, filters.limit);
      }

      return entries;
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getStats() {
    if (!this.enabled) {
      return null;
    }

    try {
      const entries = await this.query();
      const stats = {
        totalEntries: entries.length,
        categories: {},
        operations: {},
        users: {},
        dateRange: {
          earliest: null,
          latest: null
        }
      };

      for (const entry of entries) {
        // Count categories
        stats.categories[entry.category] = (stats.categories[entry.category] || 0) + 1;
        
        // Count operations
        stats.operations[entry.operation] = (stats.operations[entry.operation] || 0) + 1;
        
        // Count users
        stats.users[entry.user] = (stats.users[entry.user] || 0) + 1;
        
        // Track date range
        const entryDate = new Date(entry.timestamp);
        if (!stats.dateRange.earliest || entryDate < stats.dateRange.earliest) {
          stats.dateRange.earliest = entryDate;
        }
        if (!stats.dateRange.latest || entryDate > stats.dateRange.latest) {
          stats.dateRange.latest = entryDate;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return null;
    }
  }

  /**
   * Export audit logs
   */
  async export(format = 'json', outputPath = null) {
    if (!this.enabled) {
      throw new Error('Audit logging is disabled');
    }

    const entries = await this.query();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `audit_export_${timestamp}.${format}`;
    const exportPath = outputPath || defaultPath;

    try {
      switch (format.toLowerCase()) {
        case 'json':
          await fs.writeFile(exportPath, JSON.stringify(entries, null, 2));
          break;
          
        case 'csv':
          const csv = this._convertToCSV(entries);
          await fs.writeFile(exportPath, csv);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return exportPath;
    } catch (error) {
      throw new Error(`Failed to export audit logs: ${error.message}`);
    }
  }

  /**
   * Clear old audit logs
   */
  async cleanup() {
    if (!this.enabled) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      const entries = await this.query();
      const recentEntries = entries.filter(entry => 
        new Date(entry.timestamp) > cutoffDate
      );

      // Backup old logs before cleanup
      if (entries.length > recentEntries.length) {
        const oldEntries = entries.filter(entry => 
          new Date(entry.timestamp) <= cutoffDate
        );
        
        const backupPath = `${this.logPath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, oldEntries.map(e => JSON.stringify(e)).join('\n'));
      }

      // Write recent entries back
      const newContent = recentEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      await fs.writeFile(this.logPath, newContent);

      await this.log('system', 'audit_cleanup', {
        removedEntries: entries.length - recentEntries.length,
        retainedEntries: recentEntries.length
      });
    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
    }
  }

  // Private methods

  async _checkLogRotation() {
    if (!existsSync(this.logPath)) {
      return;
    }

    const stats = await fs.stat(this.logPath);
    if (stats.size > this.maxLogSize) {
      // Rotate log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${this.logPath}.${timestamp}`;
      
      await fs.rename(this.logPath, rotatedPath);
      
      // Create new log file
      await this.log('system', 'log_rotated', {
        oldFile: rotatedPath,
        newFile: this.logPath,
        size: stats.size
      });
    }
  }

  _getSessionId() {
    // Simple session ID generation - in production, use proper session management
    if (!this._sessionId) {
      this._sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._sessionId;
  }

  _convertToCSV(entries) {
    if (entries.length === 0) {
      return '';
    }

    // Get all unique keys
    const allKeys = new Set();
    entries.forEach(entry => {
      Object.keys(entry).forEach(key => allKeys.add(key));
      if (entry.details && typeof entry.details === 'object') {
        Object.keys(entry.details).forEach(key => allKeys.add(`details.${key}`));
      }
    });

    const headers = Array.from(allKeys).sort();
    const csvLines = [headers.join(',')];

    entries.forEach(entry => {
      const row = headers.map(header => {
        let value;
        
        if (header.startsWith('details.')) {
          const detailKey = header.substring(8);
          value = entry.details && entry.details[detailKey];
        } else {
          value = entry[header];
        }

        if (value === undefined || value === null) {
          return '';
        }
        
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        
        // Escape CSV values
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      });
      
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }
}

export default AuditLogger;
