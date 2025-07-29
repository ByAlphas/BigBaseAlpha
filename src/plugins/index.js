import { EventEmitter } from 'events';
import { promises as fs, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Plugin Manager for BigBaseAlpha
 * Handles plugin loading, lifecycle, and event management
 */
export class PluginManager extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.plugins = new Map();
    this.pluginConfigs = new Map();
    this.hooks = new Map();
    this.pluginPaths = config.pluginPaths || ['./plugins', './node_modules'];
    this.enabledPlugins = config.plugins || [];
  }

  async init() {
    // Load built-in plugins
    await this._loadBuiltinPlugins();
    
    // Load configured plugins
    for (const pluginConfig of this.enabledPlugins) {
      await this.loadPlugin(pluginConfig);
    }
    
    // Initialize all loaded plugins
    await this._initializePlugins();
  }

  /**
   * Load a plugin
   */
  async loadPlugin(pluginConfig) {
    try {
      let pluginName, pluginOptions = {};
      
      if (typeof pluginConfig === 'string') {
        pluginName = pluginConfig;
      } else {
        pluginName = pluginConfig.name;
        pluginOptions = pluginConfig.options || {};
      }

      // Check if plugin is already loaded
      if (this.plugins.has(pluginName)) {
        console.warn(`Plugin ${pluginName} is already loaded`);
        return false;
      }

      // Find plugin module
      const pluginModule = await this._findPlugin(pluginName);
      if (!pluginModule) {
        throw new Error(`Plugin ${pluginName} not found`);
      }

      // Load plugin
      const PluginClass = pluginModule.default || pluginModule;
      let plugin;

      if (typeof PluginClass === 'function') {
        // Plugin is a class
        plugin = new PluginClass(pluginOptions);
      } else if (typeof PluginClass === 'object') {
        // Plugin is an object
        plugin = PluginClass;
      } else {
        throw new Error(`Invalid plugin format for ${pluginName}`);
      }

      // Validate plugin
      this._validatePlugin(plugin, pluginName);

      // Store plugin
      this.plugins.set(pluginName, plugin);
      this.pluginConfigs.set(pluginName, { 
        name: pluginName, 
        options: pluginOptions,
        loaded: new Date()
      });

      // Register plugin hooks
      this._registerPluginHooks(pluginName, plugin);

      console.log(`✓ Plugin ${pluginName} loaded successfully`);
      this.emit('pluginLoaded', { name: pluginName, plugin });
      
      return true;
    } catch (error) {
      console.error(`✗ Failed to load plugin ${pluginConfig}:`, error.message);
      this.emit('pluginError', { name: pluginConfig, error });
      return false;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    try {
      // Call plugin cleanup if available
      if (typeof plugin.cleanup === 'function') {
        await plugin.cleanup();
      }

      // Unregister hooks
      this._unregisterPluginHooks(pluginName);

      // Remove plugin
      this.plugins.delete(pluginName);
      this.pluginConfigs.delete(pluginName);

      console.log(`✓ Plugin ${pluginName} unloaded successfully`);
      this.emit('pluginUnloaded', { name: pluginName });
      
      return true;
    } catch (error) {
      console.error(`✗ Failed to unload plugin ${pluginName}:`, error.message);
      return false;
    }
  }

  /**
   * Get loaded plugins
   */
  getLoadedPlugins() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get plugin info
   */
  getPluginInfo(pluginName) {
    const plugin = this.plugins.get(pluginName);
    const config = this.pluginConfigs.get(pluginName);
    
    if (!plugin) {
      return null;
    }

    return {
      name: pluginName,
      version: plugin.version || '1.0.0',
      description: plugin.description || 'No description',
      author: plugin.author || 'Unknown',
      config,
      hooks: this._getPluginHooks(pluginName)
    };
  }

  /**
   * Execute hook
   */
  async executeHook(hookName, ...args) {
    const hookPlugins = this.hooks.get(hookName) || [];
    const results = [];

    for (const { pluginName, handler } of hookPlugins) {
      try {
        const result = await handler.call(this.plugins.get(pluginName), ...args);
        results.push({ pluginName, result });
      } catch (error) {
        console.error(`Error executing hook ${hookName} in plugin ${pluginName}:`, error);
        results.push({ pluginName, error });
      }
    }

    return results;
  }

  /**
   * Register a hook
   */
  registerHook(pluginName, hookName, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    this.hooks.get(hookName).push({ pluginName, handler });
  }

  /**
   * Unregister hooks for a plugin
   */
  unregisterHooks(pluginName) {
    for (const [hookName, handlers] of this.hooks) {
      const filteredHandlers = handlers.filter(h => h.pluginName !== pluginName);
      if (filteredHandlers.length === 0) {
        this.hooks.delete(hookName);
      } else {
        this.hooks.set(hookName, filteredHandlers);
      }
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    const stats = {
      totalPlugins: this.plugins.size,
      loadedPlugins: this.getLoadedPlugins(),
      hooks: {}
    };

    for (const [hookName, handlers] of this.hooks) {
      stats.hooks[hookName] = handlers.length;
    }

    return stats;
  }

  async close() {
    // Unload all plugins
    const pluginNames = Array.from(this.plugins.keys());
    for (const pluginName of pluginNames) {
      await this.unloadPlugin(pluginName);
    }

    this.removeAllListeners();
  }

  // Private methods

  async _loadBuiltinPlugins() {
    const builtinPlugins = [
      {
        name: 'core-logger',
        plugin: {
          name: 'core-logger',
          version: '1.0.0',
          description: 'Core logging plugin',
          
          async onInit(db) {
            console.log('🚀 BigBaseAlpha database initialized');
          },
          
          async onWrite(collection, data) {
            console.log(`📝 Document written to collection: ${collection}`);
          },
          
          async onDelete(collection, id) {
            console.log(`🗑️  Document deleted from collection: ${collection}, ID: ${id}`);
          },
          
          async onBackup(path) {
            console.log(`💾 Database backup created: ${path}`);
          }
        }
      },
      {
        name: 'performance-monitor',
        plugin: {
          name: 'performance-monitor',
          version: '1.0.0',
          description: 'Performance monitoring plugin',
          
          stats: {
            operations: 0,
            startTime: Date.now()
          },
          
          async onInit(db) {
            this.stats.startTime = Date.now();
            console.log('📊 Performance monitoring started');
          },
          
          async onWrite() {
            this.stats.operations++;
          },
          
          async onDelete() {
            this.stats.operations++;
          },
          
          getStats() {
            const uptime = Date.now() - this.stats.startTime;
            return {
              operations: this.stats.operations,
              uptime: Math.round(uptime / 1000),
              operationsPerSecond: Math.round((this.stats.operations / uptime) * 1000)
            };
          }
        }
      }
    ];

    for (const { name, plugin } of builtinPlugins) {
      this.plugins.set(name, plugin);
      this.pluginConfigs.set(name, {
        name,
        options: {},
        loaded: new Date(),
        builtin: true
      });
      this._registerPluginHooks(name, plugin);
    }
  }

  async _findPlugin(pluginName) {
    // Try to find plugin in configured paths
    for (const pluginPath of this.pluginPaths) {
      const possiblePaths = [
        join(pluginPath, `${pluginName}.js`),
        join(pluginPath, pluginName, 'index.js'),
        join(pluginPath, `bigbase-plugin-${pluginName}`, 'index.js'),
        join(pluginPath, `@bigbase/${pluginName}`, 'index.js')
      ];

      for (const path of possiblePaths) {
        if (existsSync(resolve(path))) {
          try {
            return await import(resolve(path));
          } catch (error) {
            console.warn(`Failed to load plugin from ${path}:`, error.message);
          }
        }
      }
    }

    // Try to load as npm module
    try {
      return await import(pluginName);
    } catch (error) {
      // Try with bigbase-plugin prefix
      try {
        return await import(`bigbase-plugin-${pluginName}`);
      } catch {
        return null;
      }
    }
  }

  _validatePlugin(plugin, pluginName) {
    if (!plugin || typeof plugin !== 'object') {
      throw new Error(`Plugin ${pluginName} must export an object or class`);
    }

    // Plugin should have a name
    if (!plugin.name) {
      plugin.name = pluginName;
    }

    // Plugin should have at least one hook method
    const hookMethods = this._getAvailableHooks();
    const hasHooks = hookMethods.some(hook => typeof plugin[hook] === 'function');
    
    if (!hasHooks) {
      console.warn(`Plugin ${pluginName} doesn't implement any hooks`);
    }
  }

  _registerPluginHooks(pluginName, plugin) {
    const hookMethods = this._getAvailableHooks();
    
    for (const hookName of hookMethods) {
      if (typeof plugin[hookName] === 'function') {
        this.registerHook(pluginName, hookName, plugin[hookName]);
      }
    }
  }

  _unregisterPluginHooks(pluginName) {
    this.unregisterHooks(pluginName);
  }

  _getPluginHooks(pluginName) {
    const pluginHooks = [];
    
    for (const [hookName, handlers] of this.hooks) {
      const pluginHandler = handlers.find(h => h.pluginName === pluginName);
      if (pluginHandler) {
        pluginHooks.push(hookName);
      }
    }
    
    return pluginHooks;
  }

  _getAvailableHooks() {
    return [
      'onInit',
      'onWrite',
      'onDelete',
      'onBackup',
      'onRestore',
      'onError',
      'onQuery',
      'onIndex',
      'onCache',
      'onConnect',
      'onDisconnect'
    ];
  }

  async _initializePlugins() {
    // Initialize plugins in order
    for (const [pluginName, plugin] of this.plugins) {
      try {
        if (typeof plugin.init === 'function') {
          await plugin.init();
          console.log(`✓ Plugin ${pluginName} initialized`);
        }
      } catch (error) {
        console.error(`✗ Failed to initialize plugin ${pluginName}:`, error.message);
      }
    }
  }
}

/**
 * Base Plugin Class
 * Plugins can extend this class for common functionality
 */
export class BasePlugin {
  constructor(options = {}) {
    this.options = options;
    this.name = this.constructor.name;
    this.version = '1.0.0';
    this.description = 'No description provided';
  }

  async init() {
    // Override in subclass
  }

  async cleanup() {
    // Override in subclass
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
  }

  error(message, error = null) {
    this.log(`${message}${error ? ': ' + error.message : ''}`, 'error');
  }

  warn(message) {
    this.log(message, 'warn');
  }

  debug(message) {
    this.log(message, 'debug');
  }
}

export default PluginManager;
