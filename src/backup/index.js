import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { createGzip, createGunzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

/**
 * Backup Manager
 * Handles automated backups, restoration, and data export/import
 */
export class BackupManager extends EventEmitter {
  constructor(config = {}, logger = null) {
    super();
    
    this.logger = config.logger || logger || {
      info: (...args) => console.log(...args),
      success: (...args) => console.log(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
      debug: (...args) => console.log(...args)
    };
    
    this.config = {
      backupDir: config.backupDir || './backups',
      autoBackup: config.autoBackup !== false,
      interval: config.interval || 'daily', // daily, weekly, monthly
      retention: config.retention || 30, // days
      compress: config.compress !== false,
      encryption: config.encryption || false,
      encryptionKey: config.encryptionKey || null,
      maxBackupSize: config.maxBackupSize || '1GB',
      ...config
    };

    this.database = null;
    this.backupSchedule = null;
    this.isBackingUp = false;
    this.isInitialized = false;
    
    this.ensureBackupDirectory();
  }

  /**
   * Initialize the backup system
   */
  async init() {
    try {
      this.ensureBackupDirectory();
      
      if (this.config.autoBackup) {
        this.scheduleBackups();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      this.logger.success('Backup system initialized');
    } catch (error) {
      console.error('[ERROR] Failed to initialize backup system:', error);
      throw error;
    }
  }

  setDatabase(database) {
    this.database = database;
  }

  /**
   * Get all available backups
   */
  async listBackups() {
    try {
      const backupFiles = fs.readdirSync(this.config.backupDir)
        .filter(file => file.endsWith('.bba') || file.endsWith('.bba.gz'))
        .map(file => {
          const filePath = path.join(this.config.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            id: file.replace(/\.(bba|gz)$/, ''),
            filename: file,
            size: this.formatSize(stats.size),
            created: stats.birthtime.toISOString(),
            path: filePath
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      return backupFiles;
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Get backup file path by ID
   */
  async getBackupPath(backupId) {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id === backupId);
      return backup ? backup.path : null;
    } catch (error) {
      console.error('Error getting backup path:', error);
      return null;
    }
  }

  /**
   * Delete a backup by ID
   */
  async deleteBackup(backupId) {
    try {
      const backupPath = await this.getBackupPath(backupId);
      if (!backupPath) {
        throw new Error('Backup not found');
      }

      fs.unlinkSync(backupPath);
      this.emit('backupDeleted', { id: backupId, path: backupPath });
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete backup: ${error.message}`);
    }
  }

  /**
   * Export data in various formats
   */
  async exportData(format = 'json') {
    try {
      if (!this.database) {
        throw new Error('Database not set');
      }

      const collections = this.database.getCollections();
      const exportData = {};

      // Collect all data
      for (const collectionName of collections) {
        try {
          const documents = await this.database.find(collectionName);
          exportData[collectionName] = documents;
        } catch (error) {
          console.warn(`Error exporting collection ${collectionName}:`, error);
          exportData[collectionName] = [];
        }
      }

      // Format based on requested format
      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        
        case 'csv':
          return this.convertToCSV(exportData);
        
        case 'xml':
          return this.convertToXML(exportData);
        
        case 'sql':
          return this.convertToSQL(exportData);
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to export data: ${error.message}`);
    }
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  scheduleBackups() {
    const intervals = {
      'hourly': 3600000,    // 1 hour
      'daily': 86400000,    // 24 hours
      'weekly': 604800000,  // 7 days
      'monthly': 2592000000 // 30 days
    };
    
    const intervalMs = intervals[this.config.interval] || intervals.daily;
    
    this.backupSchedule = setInterval(() => {
      // Only run auto backup if database is still active
      if (this.database && this.database.isInitialized) {
        this.createAutoBackup();
      }
    }, intervalMs);
    
    // Create initial backup after 1 minute (only if database is initialized)
    setTimeout(() => {
      if (this.database && this.database.isInitialized) {
        this.createAutoBackup();
      }
    }, 60000);
  }

  async createBackup(options = {}) {
    if (this.isBackingUp) {
      throw new Error('Backup already in progress');
    }

    // Check if database is initialized before starting backup
    if (!this.database || !this.database.isInitialized) {
      throw new Error('Cannot create backup - database not initialized');
    }

    this.isBackingUp = true;
    const startTime = Date.now();
    
    try {
      const backupId = this.generateBackupId();
      const backupInfo = {
        id: backupId,
        filename: `backup_${backupId}.bba`,
        timestamp: new Date(),
        type: options.type || 'manual',
        collections: options.collections || 'all',
        compressed: this.config.compress,
        encrypted: this.config.encryption,
        size: 0,
        status: 'in_progress'
      };

      this.emit('backupStarted', backupInfo);

      // Get data to backup
      const data = await this.collectBackupData(options.collections);
      
      // Create backup file
      const backupPath = await this.writeBackupFile(backupId, data, backupInfo);
      
      // Update backup info
      const stats = fs.statSync(backupPath);
      backupInfo.size = stats.size;
      backupInfo.status = 'completed';
      backupInfo.duration = Date.now() - startTime;
      backupInfo.path = backupPath;

      // Save backup metadata
      await this.saveBackupMetadata(backupInfo);
      
      this.emit('backupCompleted', backupInfo);
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      return backupInfo;
      
    } catch (error) {
      this.emit('backupFailed', { error: error.message });
      throw error;
    } finally {
      this.isBackingUp = false;
    }
  }

  async createAutoBackup() {
    try {
      // Check if database is still initialized before attempting backup
      if (!this.database || !this.database.isInitialized) {
        console.log('[SKIP] Skipping auto backup - database not initialized');
        return;
      }
      
      await this.createBackup({ type: 'automatic' });
    } catch (error) {
      console.error('Auto backup failed:', error.message);
    }
  }

  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `backup_${timestamp}_${random}`;
  }

  async collectBackupData(collections = 'all') {
    if (!this.database) {
      throw new Error('Database not set');
    }

    const backupData = {
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        database: {
          version: this.database.version || '1.0',
          config: this.database.config
        }
      },
      collections: {}
    };

    let collectionsToBackup;
    if (collections === 'all') {
      collectionsToBackup = this.database.getCollections();
    } else if (Array.isArray(collections)) {
      collectionsToBackup = collections;
    } else {
      collectionsToBackup = [collections];
    }

    for (const collectionName of collectionsToBackup) {
      try {
        const collection = this.database.collection(collectionName);
        const documents = collection.find({});
        const metadata = collection.getMetadata ? collection.getMetadata() : {};
        
        backupData.collections[collectionName] = {
          metadata,
          documents: documents,
          count: documents.length,
          indexes: collection.getIndexes ? collection.getIndexes() : []
        };
      } catch (error) {
        console.warn(`Failed to backup collection ${collectionName}:`, error.message);
      }
    }

    return backupData;
  }

  async writeBackupFile(backupId, data, backupInfo) {
    const filename = `${backupId}.json${this.config.compress ? '.gz' : ''}`;
    const backupPath = path.join(this.config.backupDir, filename);
    
    const jsonData = JSON.stringify(data, null, 2);
    
    if (this.config.compress) {
      await this.writeCompressedFile(backupPath, jsonData);
    } else {
      fs.writeFileSync(backupPath, jsonData, 'utf8');
    }
    
    return backupPath;
  }

  async writeCompressedFile(filePath, data) {
    const readStream = Readable.from([data]);
    const writeStream = createWriteStream(filePath);
    const gzipStream = createGzip();
    
    await pipeline(readStream, gzipStream, writeStream);
  }

  async readCompressedFile(filePath) {
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();
    
    let data = '';
    gunzipStream.on('data', chunk => {
      data += chunk.toString();
    });
    
    await pipeline(readStream, gunzipStream);
    return data;
  }

  async saveBackupMetadata(backupInfo) {
    const metadataPath = path.join(this.config.backupDir, 'backups.json');
    let metadata = [];
    
    if (fs.existsSync(metadataPath)) {
      try {
        const existingData = fs.readFileSync(metadataPath, 'utf8');
        metadata = JSON.parse(existingData);
      } catch (error) {
        console.warn('Failed to read existing backup metadata:', error.message);
      }
    }
    
    metadata.push(backupInfo);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async restoreBackup(backupId) {
    if (!this.database) {
      throw new Error('Database not set');
    }

    const backupInfo = await this.getBackupInfo(backupId);
    if (!backupInfo) {
      throw new Error('Backup not found');
    }

    if (!fs.existsSync(backupInfo.path)) {
      throw new Error('Backup file not found');
    }

    this.emit('restoreStarted', { backupId });

    try {
      // Read backup data
      let backupData;
      if (backupInfo.compressed) {
        const jsonData = await this.readCompressedFile(backupInfo.path);
        backupData = JSON.parse(jsonData);
      } else {
        const jsonData = fs.readFileSync(backupInfo.path, 'utf8');
        backupData = JSON.parse(jsonData);
      }

      // Restore collections
      for (const [collectionName, collectionData] of Object.entries(backupData.collections)) {
        const collection = this.database.collection(collectionName);
        
        // Clear existing data
        collection.drop();
        
        // Restore documents
        for (const document of collectionData.documents) {
          collection.insert(document);
        }
        
        // Restore indexes if available
        if (collectionData.indexes && collection.createIndex) {
          for (const index of collectionData.indexes) {
            try {
              collection.createIndex(index);
            } catch (error) {
              console.warn(`Failed to restore index for ${collectionName}:`, error.message);
            }
          }
        }
      }

      this.emit('restoreCompleted', { backupId, collections: Object.keys(backupData.collections).length });
      
      return {
        success: true,
        collectionsRestored: Object.keys(backupData.collections).length,
        timestamp: new Date()
      };

    } catch (error) {
      this.emit('restoreFailed', { backupId, error: error.message });
      throw error;
    }
  }

  async getBackupInfo(backupId) {
    const metadataPath = path.join(this.config.backupDir, 'backups.json');
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }
    
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata.find(backup => backup.id === backupId);
    } catch (error) {
      console.error('Failed to read backup metadata:', error.message);
      return null;
    }
  }

  async listBackups() {
    const metadataPath = path.join(this.config.backupDir, 'backups.json');
    
    if (!fs.existsSync(metadataPath)) {
      return [];
    }
    
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to read backup metadata:', error.message);
      return [];
    }
  }

  async deleteBackup(backupId) {
    const backupInfo = await this.getBackupInfo(backupId);
    if (!backupInfo) {
      throw new Error('Backup not found');
    }

    // Delete backup file
    if (fs.existsSync(backupInfo.path)) {
      fs.unlinkSync(backupInfo.path);
    }

    // Remove from metadata
    const metadataPath = path.join(this.config.backupDir, 'backups.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const updatedMetadata = metadata.filter(backup => backup.id !== backupId);
    fs.writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2));

    this.emit('backupDeleted', { backupId });
    
    return true;
  }

  async cleanupOldBackups() {
    const backups = await this.listBackups();
    const cutoffDate = new Date(Date.now() - (this.config.retention * 24 * 60 * 60 * 1000));
    
    let deletedCount = 0;
    for (const backup of backups) {
      if (new Date(backup.timestamp) < cutoffDate && backup.type === 'automatic') {
        try {
          await this.deleteBackup(backup.id);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete old backup ${backup.id}:`, error.message);
        }
      }
    }
    
    if (deletedCount > 0) {
      this.emit('oldBackupsCleanup', { deletedCount });
    }
  }

  // Export data in various formats
  async exportData(format = 'json', collections = 'all', options = {}) {
    const data = await this.collectBackupData(collections);
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
        
      case 'csv':
        return this.convertToCSV(data, options);
        
      case 'xml':
        return this.convertToXML(data, options);
        
      case 'sql':
        return this.convertToSQL(data, options);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    let csv = '';
    
    for (const [collectionName, documents] of Object.entries(data)) {
      if (documents.length === 0) continue;
      
      csv += `-- Collection: ${collectionName}\n`;
      
      // Get all unique keys
      const keys = [...new Set(documents.flatMap(doc => Object.keys(doc)))];
      csv += keys.join(',') + '\n';
      
      // Add data rows
      documents.forEach(doc => {
        const values = keys.map(key => {
          const value = doc[key];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value).replace(/,/g, '\\,');
        });
        csv += values.join(',') + '\n';
      });
      
      csv += '\n';
    }
    
    return csv;
  }

  /**
   * Convert data to XML format
   */
  convertToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<database>\n';
    
    for (const [collectionName, documents] of Object.entries(data)) {
      xml += `  <collection name="${collectionName}">\n`;
      
      documents.forEach(doc => {
        xml += '    <document>\n';
        for (const [key, value] of Object.entries(doc)) {
          const escapedValue = this.escapeXML(String(value));
          xml += `      <${key}>${escapedValue}</${key}>\n`;
        }
        xml += '    </document>\n';
      });
      
      xml += '  </collection>\n';
    }
    
    xml += '</database>';
    return xml;
  }

  /**
   * Convert data to SQL format
   */
  convertToSQL(data) {
    let sql = '-- BigBaseAlpha SQL Export\n';
    sql += `-- Generated on: ${new Date().toISOString()}\n\n`;
    
    for (const [collectionName, documents] of Object.entries(data)) {
      if (documents.length === 0) continue;
      
      // Create table
      const sampleDoc = documents[0];
      const columns = Object.keys(sampleDoc).map(key => {
        const value = sampleDoc[key];
        let type = 'TEXT';
        if (typeof value === 'number') type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
        if (typeof value === 'boolean') type = 'BOOLEAN';
        return `${key} ${type}`;
      });
      
      sql += `CREATE TABLE ${collectionName} (\n  ${columns.join(',\n  ')}\n);\n\n`;
      
      // Insert data
      documents.forEach(doc => {
        const values = Object.values(doc).map(value => {
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          return String(value);
        });
        
        sql += `INSERT INTO ${collectionName} VALUES (${values.join(', ')});\n`;
      });
      
      sql += '\n';
    }
    
    return sql;
  }

  /**
   * Escape XML special characters
   */
  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  convertToCSV(data, options = {}) {
    let csv = '';
    
    for (const [collectionName, collection] of Object.entries(data.collections)) {
      csv += `\n# Collection: ${collectionName}\n`;
      
      if (collection.documents.length === 0) {
        csv += 'No documents\n';
        continue;
      }
      
      // Get all unique fields
      const fields = new Set();
      collection.documents.forEach(doc => {
        Object.keys(doc).forEach(key => fields.add(key));
      });
      
      const fieldArray = Array.from(fields);
      
      // Header
      csv += fieldArray.join(',') + '\n';
      
      // Data rows
      collection.documents.forEach(doc => {
        const row = fieldArray.map(field => {
          const value = doc[field];
          if (value === undefined || value === null) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value).replace(/"/g, '""');
        });
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
    }
    
    return csv;
  }

  convertToXML(data, options = {}) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<database>\n';
    
    for (const [collectionName, collection] of Object.entries(data.collections)) {
      xml += `  <collection name="${collectionName}">\n`;
      
      collection.documents.forEach(doc => {
        xml += '    <document>\n';
        for (const [key, value] of Object.entries(doc)) {
          const xmlValue = typeof value === 'object' ? 
            JSON.stringify(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') :
            String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          xml += `      <${key}>${xmlValue}</${key}>\n`;
        }
        xml += '    </document>\n';
      });
      
      xml += '  </collection>\n';
    }
    
    xml += '</database>';
    return xml;
  }

  convertToSQL(data, options = {}) {
    let sql = '-- BigBaseAlpha Database Export\n';
    sql += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    for (const [collectionName, collection] of Object.entries(data.collections)) {
      if (collection.documents.length === 0) continue;
      
      // Create table
      const sampleDoc = collection.documents[0];
      const fields = Object.keys(sampleDoc).map(field => {
        return `\`${field}\` TEXT`;
      }).join(',\n  ');
      
      sql += `CREATE TABLE IF NOT EXISTS \`${collectionName}\` (\n  ${fields}\n);\n\n`;
      
      // Insert data
      collection.documents.forEach(doc => {
        const fields = Object.keys(doc).map(f => `\`${f}\``).join(', ');
        const values = Object.values(doc).map(v => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        
        sql += `INSERT INTO \`${collectionName}\` (${fields}) VALUES (${values});\n`;
      });
      
      sql += '\n';
    }
    
    return sql;
  }

  getStats() {
    return {
      backupDirectory: this.config.backupDir,
      autoBackupEnabled: this.config.autoBackup,
      backupInterval: this.config.interval,
      retentionDays: this.config.retention,
      compressionEnabled: this.config.compress,
      isBackingUp: this.isBackingUp
    };
  }

  destroy() {
    if (this.backupSchedule) {
      clearInterval(this.backupSchedule);
      this.backupSchedule = null;
    }
  }
}

export default BackupManager;
