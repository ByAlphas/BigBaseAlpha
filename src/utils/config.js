import { promises as fs, existsSync } from 'fs';
import { join } from 'path';

/**
 * Configuration Manager for BigBaseAlpha
 * Handles database configuration and settings
 */
export class ConfigManager {
  constructor(initialConfig = {}) {
    this.config = { ...initialConfig };
    this.configPath = null;
    this.watchers = new Map();
    this.changeListeners = [];
  }

  async init(initialConfig = {}) {
    // Set config file path
    this.configPath = join(this.config.path || './', 'bigbase.config.json');
    
    // Load existing config if available
    await this.load();
    
    // Merge with initial config
    this.config = { ...this.config, ...initialConfig };
    
    // Save merged config
    await this.save();
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  async set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    // Navigate to parent object
    for (const k of keys) {
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    // Set value
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    // Notify listeners
    this._notifyChange(key, value, oldValue);
    
    // Save config
    await this.save();
  }

  /**
   * Delete configuration key
   */
  async delete(key) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    // Navigate to parent object
    for (const k of keys) {
      if (!current[k] || typeof current[k] !== 'object') {
        return false;
      }
      current = current[k];
    }
    
    if (lastKey in current) {
      const oldValue = current[lastKey];
      delete current[lastKey];
      
      // Notify listeners
      this._notifyChange(key, undefined, oldValue);
      
      // Save config
      await this.save();
      return true;
    }
    
    return false;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Set multiple configuration values
   */
  async setMultiple(values) {
    const changes = [];
    
    for (const [key, value] of Object.entries(values)) {
      const oldValue = this.get(key);
      await this.set(key, value);
      changes.push({ key, value, oldValue });
    }
    
    return changes;
  }

  /**
   * Reset configuration to defaults
   */
  async reset(defaultConfig = {}) {
    const oldConfig = { ...this.config };
    this.config = { ...defaultConfig };
    
    // Notify listeners of reset
    this._notifyChange('*', this.config, oldConfig);
    
    await this.save();
  }

  /**
   * Load configuration from file
   */
  async load() {
    if (!this.configPath || !existsSync(this.configPath)) {
      return false;
    }

    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const loadedConfig = JSON.parse(configData);
      
      // Validate configuration
      this._validateConfig(loadedConfig);
      
      this.config = { ...this.config, ...loadedConfig };
      return true;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return false;
    }
  }

  /**
   * Save configuration to file
   */
  async save() {
    if (!this.configPath) {
      return false;
    }

    try {
      const configData = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, configData);
      return true;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return false;
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }
    
    this.watchers.get(key).push(callback);
    
    // Return unwatch function
    return () => {
      const callbacks = this.watchers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
        
        if (callbacks.length === 0) {
          this.watchers.delete(key);
        }
      }
    };
  }

  /**
   * Add global change listener
   */
  onChange(callback) {
    this.changeListeners.push(callback);
    
    // Return remove listener function
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index !== -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Export configuration
   */
  async export(filePath, format = 'json') {
    const exportData = this.getAll();
    
    try {
      switch (format.toLowerCase()) {
        case 'json':
          await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
          break;
          
        case 'yaml':
          const yaml = this._convertToYAML(exportData);
          await fs.writeFile(filePath, yaml);
          break;
          
        case 'env':
          const env = this._convertToEnv(exportData);
          await fs.writeFile(filePath, env);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to export configuration:', error);
      return false;
    }
  }

  /**
   * Import configuration
   */
  async import(filePath, format = 'json', merge = true) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      let importedConfig;
      
      switch (format.toLowerCase()) {
        case 'json':
          importedConfig = JSON.parse(fileContent);
          break;
          
        case 'yaml':
          importedConfig = this._parseYAML(fileContent);
          break;
          
        case 'env':
          importedConfig = this._parseEnv(fileContent);
          break;
          
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }
      
      // Validate imported configuration
      this._validateConfig(importedConfig);
      
      if (merge) {
        this.config = { ...this.config, ...importedConfig };
      } else {
        this.config = importedConfig;
      }
      
      await this.save();
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getSchema() {
    return {
      path: {
        type: 'string',
        description: 'Database storage path',
        default: './bigbase_data'
      },
      format: {
        type: 'string',
        description: 'Storage format',
        enum: ['json', 'binary', 'hybrid'],
        default: 'json'
      },
      encryption: {
        type: 'boolean',
        description: 'Enable encryption',
        default: false
      },
      compression: {
        type: 'boolean',
        description: 'Enable compression',
        default: false
      },
      maxMemory: {
        type: 'string',
        description: 'Maximum memory usage',
        pattern: '^\\d+(\\.\\d+)?(B|KB|MB|GB)$',
        default: '512MB'
      },
      backupInterval: {
        type: 'number',
        description: 'Backup interval in milliseconds',
        minimum: 0,
        default: 3600000
      },
      indexing: {
        type: 'boolean',
        description: 'Enable indexing',
        default: true
      },
      caching: {
        type: 'boolean',
        description: 'Enable caching',
        default: true
      },
      auditLog: {
        type: 'boolean',
        description: 'Enable audit logging',
        default: true
      },
      plugins: {
        type: 'array',
        description: 'Enabled plugins',
        items: {
          oneOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: {
                name: { type: 'string' },
                options: { type: 'object' }
              },
              required: ['name']
            }
          ]
        },
        default: []
      }
    };
  }

  /**
   * Validate configuration against schema
   */
  validate() {
    return this._validateConfig(this.config);
  }

  // Private methods

  _validateConfig(config) {
    const schema = this.getSchema();
    const errors = [];
    
    for (const [key, rule] of Object.entries(schema)) {
      const value = config[key];
      
      // Check required fields
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }
      
      // Skip validation if value is undefined and not required
      if (value === undefined) {
        continue;
      }
      
      // Type validation
      if (rule.type && typeof value !== rule.type) {
        if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push(`Field ${key} must be an array`);
        } else if (rule.type !== 'array') {
          errors.push(`Field ${key} must be of type ${rule.type}`);
        }
      }
      
      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`Field ${key} must be one of: ${rule.enum.join(', ')}`);
      }
      
      // Pattern validation
      if (rule.pattern && typeof value === 'string') {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          errors.push(`Field ${key} does not match required pattern`);
        }
      }
      
      // Range validation
      if (typeof value === 'number') {
        if (rule.minimum !== undefined && value < rule.minimum) {
          errors.push(`Field ${key} must be at least ${rule.minimum}`);
        }
        if (rule.maximum !== undefined && value > rule.maximum) {
          errors.push(`Field ${key} must be at most ${rule.maximum}`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }

  _notifyChange(key, newValue, oldValue) {
    // Notify specific watchers
    const watchers = this.watchers.get(key) || [];
    for (const callback of watchers) {
      try {
        callback(newValue, oldValue, key);
      } catch (error) {
        console.error('Configuration watcher error:', error);
      }
    }
    
    // Notify global listeners
    for (const callback of this.changeListeners) {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        console.error('Configuration change listener error:', error);
      }
    }
  }

  _convertToYAML(obj, indent = 0) {
    let yaml = '';
    const spaces = '  '.repeat(indent);
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n${this._convertToYAML(value, indent + 1)}`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  - ${JSON.stringify(item)}\n`;
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
    
    return yaml;
  }

  _convertToEnv(obj, prefix = '') {
    let env = '';
    
    for (const [key, value] of Object.entries(obj)) {
      const envKey = prefix ? `${prefix}_${key.toUpperCase()}` : key.toUpperCase();
      
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        env += this._convertToEnv(value, envKey);
      } else if (Array.isArray(value)) {
        env += `${envKey}=${JSON.stringify(value)}\n`;
      } else {
        env += `${envKey}=${value}\n`;
      }
    }
    
    return env;
  }

  _parseYAML(yamlContent) {
    // Simple YAML parser - for production use a proper YAML library
    const lines = yamlContent.split('\n');
    const result = {};
    let currentObj = result;
    const stack = [result];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const indent = line.length - line.trimStart().length;
      const colonIndex = trimmed.indexOf(':');
      
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      // Adjust stack based on indentation
      while (stack.length > Math.floor(indent / 2) + 1) {
        stack.pop();
      }
      
      currentObj = stack[stack.length - 1];
      
      if (value === '') {
        // Object
        currentObj[key] = {};
        stack.push(currentObj[key]);
      } else if (value === 'null') {
        currentObj[key] = null;
      } else if (value === 'true') {
        currentObj[key] = true;
      } else if (value === 'false') {
        currentObj[key] = false;
      } else if (!isNaN(value)) {
        currentObj[key] = parseFloat(value);
      } else {
        currentObj[key] = value;
      }
    }
    
    return result;
  }

  _parseEnv(envContent) {
    const result = {};
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = trimmed.substring(0, equalIndex);
      const value = trimmed.substring(equalIndex + 1);
      
      // Convert back to nested object
      const keys = key.toLowerCase().split('_');
      let current = result;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      
      // Parse value
      if (value === 'null') {
        current[lastKey] = null;
      } else if (value === 'true') {
        current[lastKey] = true;
      } else if (value === 'false') {
        current[lastKey] = false;
      } else if (!isNaN(value)) {
        current[lastKey] = parseFloat(value);
      } else if (value.startsWith('[') || value.startsWith('{')) {
        try {
          current[lastKey] = JSON.parse(value);
        } catch {
          current[lastKey] = value;
        }
      } else {
        current[lastKey] = value;
      }
    }
    
    return result;
  }
}

export default ConfigManager;
