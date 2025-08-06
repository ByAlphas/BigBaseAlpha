/*
 * Copyright 2025 ByAlphas
 *
 * Licensed under the       legacy: {
        info: '[INFO]',
        success: '[SUCCESS]',
        warn: '[WARN]',
        error: '[ERROR]',
        debug: '[DEBUG]',
        process: '[PROCESS]'
      },icense, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import colors from 'colors/safe.js';

/**
 * Modular and Customizable Logger for BigBaseAlpha v1.5.1
 * 
 * Features:
 * - Text-based log levels instead of emojis
 * - Fully customizable colors and formats
 * - Support for different output formats
 * - Professional enterprise logging
 */
export class ModularLogger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.format = options.format || 'text'; // 'text', 'minimal', 'json'
    this.colors = options.colors !== false; // Enable colors by default
    this.timestamp = options.timestamp !== undefined ? options.timestamp : true; // Explicit check for timestamp
    this.timestampFormat = options.timestampFormat || 'simple'; // Default to simple format
    this.customTimestampFormatter = options.customTimestampFormatter; // Custom formatter function
    this.prefix = options.prefix || 'BigBaseAlpha';
    
    // Custom colors for each log level
    this.colorScheme = {
      info: options.colorScheme?.info || 'cyan',
      success: options.colorScheme?.success || 'green',
      warn: options.colorScheme?.warn || 'yellow',
      error: options.colorScheme?.error || 'red',
      debug: options.colorScheme?.debug || 'magenta',
      process: options.colorScheme?.process || 'blue',
      ...options.colorScheme
    };
    
    // Log level prefixes for different formats
    this.levelPrefixes = {
      text: {
        info: '[INFO]',
        success: '[SUCCESS]',
        warn: '[WARN]',
        error: '[ERROR]',
        debug: '[DEBUG]',
        process: '[PROCESS]'
      },
      minimal: {
        info: 'I',
        success: '✓',
        warn: '!',
        error: 'X',
        debug: 'D',
        process: '→'
      },
      json: {} // JSON format doesn't use prefixes
    };
    
    this.outputFunction = options.outputFunction || console.log;
  }

  /**
   * Get formatted timestamp with customizable format
   */
  _getTimestamp() {
    if (!this.timestamp) return '';
    
    const now = new Date();
    const format = this.timestampFormat || 'simple'; // Default to simple format
    
    switch (format) {
      case 'none':
        // No timestamp
        return '';
        
      case 'simple':
        // Only hours and minutes: 16:07
        return `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
        
      case 'time':
        // Only time: 16:07:02
        return `[${now.toTimeString().split(' ')[0]}]`;
        
      case 'datetime':
        // Date and time: 2025-08-06 16:07:02
        return `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
        
      case 'datetime-ms':
        // Date, time and milliseconds: 2025-08-06 16:07:02.123
        return `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}]`;
        
      case 'date':
        // Only date: 2025-08-06
        return `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}]`;
        
      case 'iso':
        // Full ISO format: 2025-08-06T16:07:02.123Z
        return `[${now.toISOString()}]`;
        
      case 'relative':
        // Relative time: 14:30 (only hours:minutes)
        return `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
        
      case 'unix':
        // Unix timestamp: 1691344622
        return `[${Math.floor(now.getTime() / 1000)}]`;
        
      case 'custom':
        // Custom format function provided by user
        if (this.customTimestampFormatter && typeof this.customTimestampFormatter === 'function') {
          return `[${this.customTimestampFormatter(now)}]`;
        }
        return `[${now.toLocaleString()}]`;
        
      default:
        // Fallback to datetime
        return `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
    }
  }

  /**
   * Apply color to text if colors are enabled
   */
  _colorize(text, color) {
    if (!this.colors || !colors[color]) return text;
    return colors[color](text);
  }

  /**
   * Format log message based on current format setting
   */
  _formatMessage(level, message, ...args) {
    const timestamp = this._getTimestamp();
    const prefix = this.levelPrefixes[this.format]?.[level] || `[${level.toUpperCase()}]`;
    
    switch (this.format) {
      case 'json':
        return JSON.stringify({
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          prefix: this.prefix,
          message,
          args: args.length > 0 ? args : undefined
        });
        
      case 'minimal':
        const coloredPrefix = this._colorize(prefix, this.colorScheme[level]);
        return `${coloredPrefix} ${message}${args.length > 0 ? ' ' + args.join(' ') : ''}`;
        
      case 'text':
      case 'minimal':
      default:
        const coloredLevelPrefix = this._colorize(prefix, this.colorScheme[level]);
        const parts = [
          timestamp,
          coloredLevelPrefix,
          this.prefix ? `[${this.prefix}]` : '',
          message
        ].filter(Boolean);
        
        return parts.join(' ') + (args.length > 0 ? ' ' + args.join(' ') : '');
    }
  }

  /**
   * Generic log method
   */
  _log(level, message, ...args) {
    if (this.silent) return;
    
    const formattedMessage = this._formatMessage(level, message, ...args);
    this.outputFunction(formattedMessage);
  }

  /**
   * Info level logging
   */
  info(message, ...args) {
    this._log('info', message, ...args);
  }

  /**
   * Success level logging
   */
  success(message, ...args) {
    this._log('success', message, ...args);
  }

  /**
   * Warning level logging
   */
  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  /**
   * Error level logging
   */
  error(message, ...args) {
    this._log('error', message, ...args);
  }

  /**
   * Debug level logging
   */
  debug(message, ...args) {
    this._log('debug', message, ...args);
  }

  /**
   * Process level logging (for initialization, shutdown, etc.)
   */
  process(message, ...args) {
    this._log('process', message, ...args);
  }

  /**
   * Module-specific logging (maintains compatibility with existing _logModule)
   */
  module(message, ...args) {
    // Detect log level from message content
    const messageStr = String(message);
    
    if (messageStr.includes('initialized') || messageStr.includes('ready') || messageStr.includes('closed') || messageStr.includes('stopped')) {
      this.success(message, ...args);
    } else if (messageStr.includes('disabled') || messageStr.includes('warning')) {
      this.warn(message, ...args);
    } else if (messageStr.includes('error') || messageStr.includes('failed')) {
      this.error(message, ...args);
    } else if (messageStr.includes('Initializing') || messageStr.includes('Starting') || messageStr.includes('Stopping')) {
      this.process(message, ...args);
    } else {
      this.info(message, ...args);
    }
  }

  /**
   * Change log format on the fly
   */
  setFormat(format) {
    if (['text', 'minimal', 'json'].includes(format)) {
      this.format = format;
    } else {
      throw new Error(`Unsupported format: ${format}. Supported formats: text, minimal, json`);
    }
  }

  /**
   * Enable or disable colors
   */
  setColors(enabled) {
    this.colors = enabled;
  }

  /**
   * Update color scheme
   */
  setColorScheme(newScheme) {
    this.colorScheme = { ...this.colorScheme, ...newScheme };
  }

  /**
   * Set timestamp format
   * @param {string} format - 'none', 'simple', 'time', 'datetime', 'datetime-ms', 'date', 'iso', 'relative', 'unix', 'custom'
   * @param {function} customFormatter - Custom formatter function for 'custom' format
   */
  setTimestampFormat(format, customFormatter = null) {
    const validFormats = ['none', 'simple', 'time', 'datetime', 'datetime-ms', 'date', 'iso', 'relative', 'unix', 'custom'];
    if (!validFormats.includes(format)) {
      throw new Error(`Invalid timestamp format: ${format}. Valid formats: ${validFormats.join(', ')}`);
    }
    this.timestampFormat = format;
    if (format === 'custom' && customFormatter) {
      this.customTimestampFormatter = customFormatter;
    }
  }

  /**
   * Enable or disable timestamps
   */
  setTimestamp(enabled) {
    this.timestamp = enabled;
  }

  /**
   * Set silent mode
   */
  setSilent(silent) {
    this.silent = silent;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      silent: this.silent,
      format: this.format,
      colors: this.colors,
      timestamp: this.timestamp,
      timestampFormat: this.timestampFormat,
      prefix: this.prefix,
      colorScheme: this.colorScheme
    };
  }

  /**
   * Create a child logger with different settings
   */
  createChild(options = {}) {
    return new ModularLogger({
      ...this.getConfig(),
      ...options,
      colorScheme: { ...this.colorScheme, ...options.colorScheme }
    });
  }
}

/**
 * Create default logger instance
 */
export function createLogger(options = {}) {
  return new ModularLogger(options);
}

/**
 * Preset logger configurations
 */
export const LoggerPresets = {
  // Default text-based enterprise logging (v1.5.1 default)
  enterprise: {
    format: 'text',
    colors: true,
    timestamp: true,
    timestampFormat: 'simple', // 16:07 (saat:dakika)
    colorScheme: {
      info: 'cyan',
      success: 'green',
      warn: 'yellow',
      error: 'red',
      debug: 'magenta',
      process: 'blue'
    }
  },
  
  // Clean preset - timestamps yok, sadece renkli log levels
  clean: {
    format: 'text',
    colors: true,
    timestamp: false,
    timestampFormat: 'none'
  },
  
  // Minimal logging for production
  minimal: {
    format: 'minimal',
    colors: false,
    timestamp: true,
    timestampFormat: 'time' // Only 16:07:02
  },
  
  // JSON logging for log aggregation systems
  json: {
    format: 'json',
    colors: false,
    timestamp: true,
    timestampFormat: 'iso' // Full ISO format for systems
  },
  
  // Debug logging with full details
  debug: {
    format: 'text',
    colors: true,
    timestamp: true,
    timestampFormat: 'datetime-ms', // Include milliseconds for debugging
    colorScheme: {
      info: 'cyan',
      success: 'green',
      warn: 'yellow',
      error: 'red',
      debug: 'magenta',
      process: 'blue'
    }
  },
  
  // Development logging with relative timestamps
  development: {
    format: 'text',
    colors: true,
    timestamp: true,
    timestampFormat: 'relative', // Only hours:minutes
    colorScheme: {
      info: 'brightCyan',
      success: 'brightGreen',
      warn: 'brightYellow',
      error: 'brightRed',
      debug: 'brightMagenta',
      process: 'brightBlue'
    }
  },
  
  // Silent mode (no output)
  silent: {
    silent: true
  }
};

export default ModularLogger;
