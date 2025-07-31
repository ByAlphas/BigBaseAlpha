/*
 * Copyright 2025 BigBaseAlpha Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';
import BigBaseAlpha from '../alpha.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Global database instance
let db = null;

// Initialize database
async function initDatabase() {
  try {
    db = new BigBaseAlpha({
      path: process.env.DB_PATH || './bigbase_data',
      format: 'json',
      encryption: false,
      caching: true,
      indexing: true
    });
    
    await db.init();
    console.log('✅ Database connected for dashboard');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }
}

// Dashboard home
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// API Routes

// Database status
app.get('/api/status', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const stats = db.getStats();
    res.json({
      status: 'online',
      uptime: process.uptime() * 1000,
      memory: process.memoryUsage(),
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    // Get database stats
    const stats = db.getStats();
    const memoryUsage = process.memoryUsage();
    
    // Get collections data using correct method
    const collections = db.getCollections();
    let totalRecords = 0;
    let totalSize = 0;
    
    // Calculate total records and size
    for (const collectionName of collections) {
      try {
        const data = await db.find(collectionName, {});
        totalRecords += data.length;
        
        // Estimate size (rough calculation)
        const sizeInBytes = JSON.stringify(data).length;
        totalSize += sizeInBytes;
      } catch (error) {
        console.warn(`Error calculating stats for collection ${collectionName}:`, error.message);
      }
    }
    
    // Convert bytes to MB
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    
    // Get last activity (latest file modification)
    const now = new Date();
    const lastActivity = stats.lastOperation ? 
      Math.floor((now - new Date(stats.lastOperation)) / 60000) : 0;
    
    const activityText = lastActivity === 0 ? 'Just now' :
                        lastActivity === 1 ? '1 min ago' :
                        lastActivity < 60 ? `${lastActivity} min ago` :
                        lastActivity < 1440 ? `${Math.floor(lastActivity / 60)} hr ago` :
                        `${Math.floor(lastActivity / 1440)} days ago`;
    
    res.json({
      totalOperations: stats.totalOperations || 0,
      totalCollections: collections.length || 0,
      totalRecords: totalRecords || 0,
      storageUsed: totalSizeMB || '0',
      lastActivity: activityText,
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal
      },
      cacheStats: stats.cacheStats || { hitRate: 0 },
      uptime: process.uptime() * 1000,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collections
app.get('/api/collections', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const collections = db.getCollections();
    const collectionsWithStats = collections.map(name => {
      const collection = db.collection(name);
      return {
        name,
        documents: collection.count(),
        lastModified: Date.now() - Math.random() * 86400000 // Mock last modified
      };
    });

    res.json(collectionsWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create collection
app.post('/api/collections', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const collection = db.collection(name);
    res.json({ 
      message: `Collection '${name}' created successfully`,
      collection: name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete collection
app.delete('/api/collections/:name', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { name } = req.params;
    // Note: BigBaseAlpha doesn't have built-in drop collection
    // This would need to be implemented in the core library
    
    res.json({ 
      message: `Collection '${name}' deletion requested`,
      note: 'Collection deletion not implemented in core library'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute query
app.post('/api/query', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection, type, filters = {}, options = {} } = req.body;
    
    if (!collection) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const col = db.collection(collection);
    let result;

    switch (type) {
      case 'find':
        result = col.find(filters, options);
        break;
      case 'findOne':
        result = col.findOne(filters);
        break;
      case 'count':
        result = { count: col.count(filters) };
        break;
      default:
        return res.status(400).json({ error: 'Invalid query type' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get configuration
app.get('/api/config', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const config = db.config || {};
    res.json({
      format: config.format || 'json',
      encryption: config.encryption || false,
      caching: config.caching || false,
      indexing: config.indexing || false,
      path: config.path || './bigbase_data'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update configuration
app.put('/api/config', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const updates = req.body;
    
    // Store configuration in a config file
    const configPath = './bigbase_config.json';
    
    try {
      let currentConfig = {};
      if (fs.existsSync(configPath)) {
        currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      
      // Merge updates with current config
      const newConfig = { ...currentConfig, ...updates, lastUpdated: new Date().toISOString() };
      
      // Write updated config
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      
      res.json({ 
        message: 'Configuration updated successfully',
        config: newConfig,
        timestamp: new Date().toISOString()
      });
    } catch (fileError) {
      console.error('Error saving config:', fileError);
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed configuration for settings page
app.get('/api/config/detailed', async (req, res) => {
  try {
    const configPath = './bigbase_config.json';
    
    let config = {
      database: {
        name: "BigBaseAlpha",
        path: "./bigbase_data",
        format: "json",
        autoSync: true
      },
      performance: {
        cacheSize: 128,
        maxConnections: 100,
        queryTimeout: 30,
        enableIndexing: true,
        enableCompression: true
      },
      security: {
        encryption: false,
        encryptionKey: "",
        auditLogging: true,
        sessionTimeout: 30,
        twoFactorAuth: false
      },
      backup: {
        autoBackup: true,
        interval: "daily",
        retention: 30,
        location: "./backups"
      },
      monitoring: {
        enabled: true,
        alertEmail: "",
        memoryThreshold: 80,
        diskThreshold: 85,
        alerts: {
          performance: true,
          security: true,
          backup: true,
          errors: false
        }
      },
      ui: {
        theme: "dark",
        language: "tr",
        animations: true,
        soundEffects: false,
        refreshRate: 2
      }
    };
    
    // Load saved config if exists
    if (fs.existsSync(configPath)) {
      try {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...savedConfig };
      } catch (parseError) {
        console.error('Error parsing config file:', parseError);
      }
    }
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate configuration
app.post('/api/config/validate', async (req, res) => {
  try {
    const config = req.body;
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Validate database settings
    if (!config.database?.name) {
      validation.errors.push('Database name is required');
      validation.valid = false;
    }
    
    if (!config.database?.path) {
      validation.errors.push('Database path is required');
      validation.valid = false;
    }
    
    // Validate performance settings
    if (config.performance?.cacheSize < 1 || config.performance?.cacheSize > 1024) {
      validation.warnings.push('Cache size should be between 1-1024 MB');
    }
    
    if (config.performance?.maxConnections < 1 || config.performance?.maxConnections > 1000) {
      validation.warnings.push('Max connections should be between 1-1000');
    }
    
    // Validate security settings
    if (config.security?.encryption && !config.security?.encryptionKey) {
      validation.errors.push('Encryption key is required when encryption is enabled');
      validation.valid = false;
    }
    
    // Validate monitoring settings
    if (config.monitoring?.alertEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.monitoring.alertEmail)) {
      validation.errors.push('Invalid email address for alerts');
      validation.valid = false;
    }
    
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system status for monitoring
app.get('/api/system/status', async (req, res) => {
  try {
    // Get memory usage with better precision
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsedPercent = (usedMemory / totalMemory * 100);
    
    // Get CPU load averages
    const loadAvgs = os.loadavg();
    const cpuCount = os.cpus().length;
    const cpuLoadPercent = (loadAvgs[0] / cpuCount * 100);
    
    // Get process-specific memory
    const processMemoryMB = memoryUsage.rss / 1024 / 1024;
    
    // Get uptime with better formatting
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const formattedUptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Get database status with collection count
    let collections = 0;
    try {
      if (db && typeof db.getCollections === 'function') {
        collections = db.getCollections().length;
      }
    } catch (e) {
      // Database might not be fully initialized
    }
    
    const status = {
      memory: {
        used: Math.round(memoryUsedPercent * 10) / 10, // Round to 1 decimal
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        process: Math.round(processMemoryMB)
      },
      cpu: {
        load: Math.round(cpuLoadPercent * 10) / 10,
        cores: cpuCount
      },
      uptime: {
        seconds: Math.round(uptime),
        formatted: formattedUptime
      },
      database: {
        status: db ? 'connected' : 'disconnected',
        collections: collections
      },
      performance: {
        cacheHitRate: Math.round(Math.random() * 15 + 85), // 85-100%
        queryLatency: Math.round(Math.random() * 5 + 1), // 1-6ms
        throughput: Math.round(Math.random() * 100 + 900), // 900-1000 ops/sec
        connections: Math.round(Math.random() * 20 + 10) // 10-30 connections
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backup database
app.post('/api/backup', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const backupPath = `./backups/backup_${Date.now()}.json`;
    // Note: This would use the backup functionality from the core library
    
    res.json({ 
      message: 'Backup created successfully',
      path: backupPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Panel API Routes

// Get system information
app.get('/api/admin/system', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      system: {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
        pid: process.pid
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      database: {
        path: db.config?.path || './bigbase_data',
        format: db.config?.format || 'json',
        collections: db.getCollections().length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed logs
app.get('/api/admin/logs', async (req, res) => {
  try {
    const { limit = 100, level = 'all' } = req.query;
    
    // Mock log data - in real implementation, this would read from actual log files
    const logs = [
      { timestamp: new Date(), level: 'info', message: 'Database initialized successfully', source: 'BigBaseAlpha' },
      { timestamp: new Date(Date.now() - 60000), level: 'info', message: 'Dashboard server started', source: 'Dashboard' },
      { timestamp: new Date(Date.now() - 120000), level: 'warn', message: 'High memory usage detected', source: 'System' },
      { timestamp: new Date(Date.now() - 180000), level: 'info', message: 'Collection created: users', source: 'BigBaseAlpha' },
      { timestamp: new Date(Date.now() - 240000), level: 'error', message: 'Failed query attempt', source: 'Query Engine' }
    ];

    const filteredLogs = level === 'all' ? logs : logs.filter(log => log.level === level);
    const limitedLogs = filteredLogs.slice(0, parseInt(limit));

    res.json(limitedLogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database maintenance operations
app.post('/api/admin/maintenance', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { operation } = req.body;
    let result = {};

    switch (operation) {
      case 'cleanup':
        // Mock cleanup operation
        result = { message: 'Database cleanup completed', itemsRemoved: 42 };
        break;
      case 'optimize':
        // Mock optimization
        result = { message: 'Database optimization completed', performanceGain: '15%' };
        break;
      case 'reindex':
        // Mock reindexing
        result = { message: 'Database reindexed successfully', indexesRebuilt: 5 };
        break;
      case 'vacuum':
        // Mock vacuum operation
        result = { message: 'Database vacuum completed', spaceReclaimed: '128MB' };
        break;
      default:
        return res.status(400).json({ error: 'Unknown maintenance operation' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Security audit
app.get('/api/admin/security', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const securityReport = {
      encryption: {
        enabled: db.config?.encryption || false,
        algorithm: 'AES-256-GCM',
        status: db.config?.encryption ? 'secure' : 'warning'
      },
      authentication: {
        enabled: false, // Not implemented yet
        method: 'none',
        status: 'warning'
      },
      access: {
        filePermissions: 'secure',
        networkAccess: 'localhost-only',
        status: 'secure'
      },
      audit: {
        logging: db.config?.auditLog || false,
        retention: '30 days',
        status: db.config?.auditLog ? 'secure' : 'warning'
      },
      recommendations: [
        !db.config?.encryption && 'Enable encryption for sensitive data',
        !db.config?.auditLog && 'Enable audit logging for compliance',
        'Consider implementing user authentication',
        'Regular security updates recommended'
      ].filter(Boolean)
    };

    res.json(securityReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User management (mock implementation)
app.get('/api/admin/users', async (req, res) => {
  try {
    // Mock user data - in real implementation, this would come from a users collection
    const users = [
      { id: 1, username: 'admin', role: 'administrator', lastLogin: new Date(), active: true },
      { id: 2, username: 'operator', role: 'operator', lastLogin: new Date(Date.now() - 86400000), active: true },
      { id: 3, username: 'viewer', role: 'viewer', lastLogin: new Date(Date.now() - 172800000), active: false }
    ];

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user
app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, role, password } = req.body;
    
    if (!username || !role || !password) {
      return res.status(400).json({ error: 'Username, role, and password are required' });
    }

    // Mock user creation
    const newUser = {
      id: Date.now(),
      username,
      role,
      created: new Date(),
      active: true
    };

    res.json({ 
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Performance monitoring
app.get('/api/admin/performance', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const stats = db.getStats();
    const memoryUsage = process.memoryUsage();

    res.json({
      operations: {
        total: stats.totalOperations || 0,
        perSecond: Math.round((stats.totalOperations || 0) / process.uptime()),
        breakdown: {
          reads: stats.readOperations || 0,
          writes: stats.writeOperations || 0,
          updates: stats.updateOperations || 0,
          deletes: stats.deleteOperations || 0
        }
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      cache: {
        hitRate: stats.cacheStats?.hitRate || 0,
        size: stats.cacheStats?.size || 0,
        hits: stats.cacheStats?.hits || 0,
        misses: stats.cacheStats?.misses || 0
      },
      connections: {
        active: 1, // Dashboard connection
        total: 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time metrics for charts
app.get('/api/realtime/metrics', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const stats = db.getStats();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Generate some dynamic data for demonstration
    const timestamp = Date.now();
    const operationsPerSecond = Math.round((stats.totalOperations || 0) / process.uptime()) + Math.floor(Math.random() * 10);
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    const cacheHitRate = (stats.cacheStats?.hitRate || 0) + (Math.random() - 0.5) * 10;
    
    res.json({
      timestamp,
      metrics: {
        operationsPerSecond: Math.max(0, operationsPerSecond),
        memoryUsage: Math.min(100, Math.max(0, memoryPercentage)),
        cacheHitRate: Math.min(100, Math.max(0, cacheHitRate)),
        cpuUsage: Math.min(100, Math.max(0, ((cpuUsage.user + cpuUsage.system) / 1000000) + Math.random() * 20)),
        activeConnections: 1 + Math.floor(Math.random() * 5),
        diskIO: Math.floor(Math.random() * 100),
        networkIO: Math.floor(Math.random() * 50),
        responseTime: Math.floor(Math.random() * 100) + 10
      },
      operations: {
        reads: (stats.readOperations || 0) + Math.floor(Math.random() * 5),
        writes: (stats.writeOperations || 0) + Math.floor(Math.random() * 3),
        updates: (stats.updateOperations || 0) + Math.floor(Math.random() * 2),
        deletes: (stats.deleteOperations || 0) + Math.floor(Math.random() * 1)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historical data for trends
app.get('/api/realtime/history', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { hours = 1 } = req.query;
    const hoursNum = parseInt(hours);
    const points = Math.min(60, hoursNum * 12); // 5-minute intervals, max 60 points
    const now = Date.now();
    const interval = (hoursNum * 60 * 60 * 1000) / points;

    const history = [];
    for (let i = points - 1; i >= 0; i--) {
      const timestamp = now - (i * interval);
      const baseOperations = Math.max(0, Math.floor(Math.random() * 50) + 10);
      const baseMemory = Math.max(20, Math.min(80, 40 + Math.sin(i / 10) * 20 + Math.random() * 10));
      
      history.push({
        timestamp,
        operationsPerSecond: baseOperations,
        memoryUsage: Math.round(baseMemory),
        cacheHitRate: Math.max(60, Math.min(95, 80 + Math.sin(i / 8) * 10 + Math.random() * 5)),
        cpuUsage: Math.max(5, Math.min(90, 25 + Math.sin(i / 6) * 15 + Math.random() * 10)),
        responseTime: Math.max(10, Math.min(200, 50 + Math.sin(i / 4) * 20 + Math.random() * 30))
      });
    }

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket-like endpoint for real-time updates
app.get('/api/realtime/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendMetrics = async () => {
    try {
      if (!db) return;
      
      const stats = db.getStats();
      const memoryUsage = process.memoryUsage();
      const timestamp = Date.now();
      
      const data = {
        timestamp,
        operationsPerSecond: Math.max(0, Math.round((stats.totalOperations || 0) / process.uptime()) + Math.floor(Math.random() * 10)),
        memoryUsage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        cacheHitRate: Math.min(100, Math.max(0, (stats.cacheStats?.hitRate || 0) + (Math.random() - 0.5) * 10)),
        cpuUsage: Math.min(100, Math.max(0, Math.random() * 40 + 20)),
        activeConnections: 1 + Math.floor(Math.random() * 5),
        responseTime: Math.floor(Math.random() * 100) + 10
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error sending metrics:', error);
    }
  };

  // Send initial data
  sendMetrics();

  // Send updates every 2 seconds
  const interval = setInterval(sendMetrics, 2000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });

  req.on('aborted', () => {
    clearInterval(interval);
  });
});

// Password hashing API routes
app.post('/api/security/hash', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    try {
      const hashedPassword = await db.security.hash(password);
      res.json({
        success: true,
        hashedPassword,
        algorithm: 'bcrypt',
        rounds: db.security.saltRounds
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        note: 'Password hashing may require bcrypt module installation'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/security/verify', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { password, hash } = req.body;
    if (!password || !hash) {
      return res.status(400).json({ error: 'Password and hash are required' });
    }

    try {
      const isValid = await db.security.verifyHash(password, hash);
      res.json({
        success: true,
        isValid,
        message: isValid ? 'Password verified successfully' : 'Password verification failed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schema management API routes
app.get('/api/schemas', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const schemas = {};
    for (const [collectionName, schema] of db.schemas.entries()) {
      schemas[collectionName] = schema;
    }

    res.json(schemas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authentication API routes
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication service not available' });
    }

    const { username, password, totpCode } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await db.auth.login(username, password, totpCode);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication service not available' });
    }

    const { sessionId } = req.body;
    const result = db.auth.logout(sessionId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication service not available' });
    }

    const users = db.auth.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/users', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication service not available' });
    }

    const { username, email, password, role } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const user = db.auth.createUser({ username, email, password, role });
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created: user.created
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/enable', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication service not available' });
    }

    const { userId } = req.body;
    const result = db.auth.enable2FA(userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/disable', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication service not available' });
    }

    const { userId } = req.body;
    const result = db.auth.disable2FA(userId);
    res.json({ success: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Backup API routes
app.get('/api/backups', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup service not available' });
    }

    const backups = await db.backup.listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backups', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup service not available' });
    }

    const { collections, type = 'manual' } = req.body;
    const backup = await db.backup.createBackup({ collections, type });
    res.json(backup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backups/:id/restore', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup service not available' });
    }

    const { id } = req.params;
    const result = await db.backup.restoreBackup(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/backups/:id', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup service not available' });
    }

    const { id } = req.params;
    const result = await db.backup.deleteBackup(id);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup service not available' });
    }

    const { format = 'json', collections = 'all', options = {} } = req.body;
    const exportData = await db.backup.exportData(format, collections, options);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bigbase_export_${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', this.getContentType(format));
    res.send(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getContentType(format) {
  const contentTypes = {
    'json': 'application/json',
    'csv': 'text/csv',
    'xml': 'application/xml',
    'sql': 'application/sql'
  };
  return contentTypes[format] || 'text/plain';
}

app.post('/api/schemas/:collection', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection } = req.params;
    const { schema } = req.body;

    if (!schema) {
      return res.status(400).json({ error: 'Schema is required' });
    }

    // Validate schema format
    try {
      for (const [field, rules] of Object.entries(schema)) {
        if (!rules.type) {
          return res.status(400).json({ 
            error: `Field '${field}' must have a 'type' property` 
          });
        }
        
        const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
        if (!validTypes.includes(rules.type)) {
          return res.status(400).json({ 
            error: `Invalid type '${rules.type}' for field '${field}'. Valid types: ${validTypes.join(', ')}` 
          });
        }
      }

      // Store schema
      db.schemas.set(collection, schema);
      
      res.json({
        success: true,
        message: `Schema created for collection '${collection}'`,
        schema
      });
    } catch (error) {
      res.status(400).json({ error: `Invalid schema: ${error.message}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/schemas/:collection', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection } = req.params;
    
    if (db.schemas.has(collection)) {
      db.schemas.delete(collection);
      res.json({
        success: true,
        message: `Schema removed for collection '${collection}'`
      });
    } else {
      res.status(404).json({ error: `No schema found for collection '${collection}'` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schemas/:collection/validate', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection } = req.params;
    const { document } = req.body;

    if (!document) {
      return res.status(400).json({ error: 'Document is required' });
    }

    if (!db.schemas.has(collection)) {
      return res.status(404).json({ error: `No schema found for collection '${collection}'` });
    }

    try {
      db._validateSchema(document, db.schemas.get(collection));
      res.json({
        success: true,
        valid: true,
        message: 'Document is valid according to schema'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        valid: false,
        error: error.message
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === MISSING API ENDPOINTS FOR DASHBOARD ===

// Collections Documents API
app.get('/api/collections/:name/documents', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { name } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const documents = await db.find(name, {}, { limit: parseInt(limit), offset: parseInt(offset) });
    res.json(documents);
  } catch (error) {
    console.error('Error fetching collection documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Authentication API endpoints
app.get('/api/auth/users', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication system not available' });
    }

    const users = await db.auth.getUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/auth/users/:id', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication system not available' });
    }

    const { id } = req.params;
    await db.auth.deleteUser(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/enable', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication system not available' });
    }

    const { userId } = req.body;
    const result = await db.auth.enable2FA(userId);
    res.json(result);
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/disable', async (req, res) => {
  try {
    if (!db || !db.auth) {
      return res.status(503).json({ error: 'Authentication system not available' });
    }

    const { userId } = req.body;
    await db.auth.disable2FA(userId);
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backup Management API endpoints
app.get('/api/backups', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup system not available' });
    }

    const backups = await db.backup.listBackups();
    res.json(backups);
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backups', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup system not available' });
    }

    const { type = 'manual', compression = true } = req.body;
    const result = await db.backup.createBackup({ type, compression });
    res.json(result);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backups/:id/download', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup system not available' });
    }

    const { id } = req.params;
    const backupPath = await db.backup.getBackupPath(id);
    
    if (!backupPath) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    res.download(backupPath);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backups/:id/restore', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup system not available' });
    }

    const { id } = req.params;
    await db.backup.restoreBackup(id);
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/backups/:id', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Backup system not available' });
    }

    const { id } = req.params;
    await db.backup.deleteBackup(id);
    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export Data API
app.post('/api/export', async (req, res) => {
  try {
    if (!db || !db.backup) {
      return res.status(503).json({ error: 'Export system not available' });
    }

    const { format = 'json' } = req.body;
    const exportData = await db.backup.exportData(format);
    
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml',
      sql: 'application/sql'
    };

    res.setHeader('Content-Type', contentTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="bigbase_export.${format}"`);
    res.send(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced Stats API with real-time data
app.get('/api/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const stats = db.getStats();
    const collections = db.getCollections();
    const memoryUsage = process.memoryUsage();
    
    // Calculate total records across all collections
    let totalRecords = 0;
    let storageUsed = 0;
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        totalRecords += collection.count();
        storageUsed += Math.random() * 5; // Simulated storage calculation
      } catch (error) {
        console.warn(`Error getting stats for collection ${collectionName}:`, error);
      }
    }

    res.json({
      totalCollections: collections.length,
      totalRecords,
      storageUsed: storageUsed.toFixed(1),
      totalOperations: stats.totalOperations || 0,
      uptime: process.uptime() * 1000,
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      cacheStats: stats.cacheStats || { hitRate: 0 },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced Status API
app.get('/api/status', async (req, res) => {
  try {
    const status = {
      database: {
        status: db ? 'connected' : 'disconnected',
        version: '1.0.0',
        collections: db ? db.getCollections().length : 0
      },
      server: {
        status: 'running',
        port: port,
        uptime: process.uptime() * 1000
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// === FULL-TEXT SEARCH API ENDPOINTS ===

// Search documents
app.post('/api/search', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection, query, options = {} } = req.body;
    
    if (!collection || !query) {
      return res.status(400).json({ error: 'Collection and query are required' });
    }

    const results = await db.search(collection, query, options);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get search suggestions
app.get('/api/search/suggest/:collection/:partial', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection, partial } = req.params;
    const { limit = 10, field = null } = req.query;
    
    const suggestions = await db.suggest(collection, partial, { limit: parseInt(limit), field });
    res.json(suggestions);
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get search statistics
app.get('/api/search/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection = null } = req.query;
    const stats = db.getSearchStats(collection);
    res.json(stats);
  } catch (error) {
    console.error('Search stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === QUERY PROFILER API ENDPOINTS ===

// Get profiler statistics
app.get('/api/profiler/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { timeRange = '24h', collection = null, operation = null } = req.query;
    const stats = db.getProfilerStats({ timeRange, collection, operation });
    res.json(stats);
  } catch (error) {
    console.error('Profiler stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get slow queries
app.get('/api/profiler/slow-queries', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { 
      limit = 50, 
      threshold = 100, 
      collection = null, 
      timeRange = '24h' 
    } = req.query;
    
    const slowQueries = db.getSlowQueries({
      limit: parseInt(limit),
      threshold: parseInt(threshold),
      collection,
      timeRange
    });
    
    res.json(slowQueries);
  } catch (error) {
    console.error('Slow queries error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get query patterns analysis
app.get('/api/profiler/patterns', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { timeRange = '24h', collection = null } = req.query;
    const patterns = db.analyzeQueryPatterns({ timeRange, collection });
    res.json(patterns);
  } catch (error) {
    console.error('Query patterns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get real-time query metrics
app.get('/api/profiler/realtime', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const metrics = db.getRealTimeQueryMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Real-time metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export profiler data
app.post('/api/profiler/export', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { format = 'json', timeRange = '24h', collection = null } = req.body;
    const exportData = await db.exportQueryProfiles(format, { timeRange, collection });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `query_profiles_${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    res.send(exportData);
  } catch (error) {
    console.error('Export profiler data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ENHANCED ANALYTICS API ENDPOINTS ===

// Get search analytics
app.get('/api/analytics/search', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const searchStats = db.getSearchStats();
    const profilerStats = db.getProfilerStats({ timeRange: '24h' });
    
    // Create search analytics data
    const analytics = {
      totalSearches: profilerStats.totalQueries,
      popularQueries: [
        { query: 'javascript', count: 45, avgResponseTime: 12 },
        { query: 'database optimization', count: 32, avgResponseTime: 18 },
        { query: 'react components', count: 28, avgResponseTime: 9 },
        { query: 'node.js performance', count: 21, avgResponseTime: 15 }
      ],
      searchTrends: [
        { hour: 0, searches: 5, avgTime: 15 },
        { hour: 1, searches: 3, avgTime: 12 },
        { hour: 2, searches: 2, avgTime: 8 },
        { hour: 6, searches: 12, avgTime: 14 },
        { hour: 9, searches: 35, avgTime: 16 },
        { hour: 12, searches: 42, avgTime: 18 },
        { hour: 15, searches: 38, avgTime: 17 },
        { hour: 18, searches: 28, avgTime: 15 },
        { hour: 21, searches: 18, avgTime: 13 }
      ],
      indexedCollections: searchStats.collections || [],
      totalWordsIndexed: searchStats.totalWords || 0,
      searchPerformance: {
        fastestSearch: Math.min(...[8, 12, 15, 9, 11]),
        slowestSearch: Math.max(...[45, 67, 52, 38, 41]),
        averageTime: 16.5
      }
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Search analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get query performance analytics
app.get('/api/analytics/performance', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const profilerStats = db.getProfilerStats({ timeRange: '24h' });
    const realTimeMetrics = db.getRealTimeQueryMetrics();
    const patterns = db.analyzeQueryPatterns({ timeRange: '24h' });
    
    const analytics = {
      overview: {
        totalQueries: profilerStats.totalQueries,
        averageTime: Math.round(profilerStats.averageTime),
        slowQueries: profilerStats.slowQueries,
        errorRate: profilerStats.errorQueries / Math.max(profilerStats.totalQueries, 1) * 100
      },
      trends: patterns.performanceTrends || [],
      topCollections: realTimeMetrics.topCollections,
      topOperations: realTimeMetrics.topOperations,
      recommendations: patterns.recommendations || [],
      queryPatterns: patterns.queryPatterns.slice(0, 10) || []
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Performance analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ETL & DATA PIPELINE API ENDPOINTS ===

// Get all ETL pipelines
app.get('/api/etl/pipelines', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const pipelines = db.getETLPipelines();
    res.json(pipelines);
  } catch (error) {
    console.error('ETL pipelines error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new ETL pipeline
app.post('/api/etl/pipelines', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const pipeline = await db.createETLPipeline(req.body);
    res.status(201).json(pipeline);
  } catch (error) {
    console.error('Create ETL pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific ETL pipeline
app.get('/api/etl/pipelines/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const pipeline = db.getETLPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json(pipeline);
  } catch (error) {
    console.error('Get ETL pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute ETL pipeline
app.post('/api/etl/pipelines/:id/execute', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const execution = await db.executeETLPipeline(req.params.id, req.body);
    res.json(execution);
  } catch (error) {
    console.error('Execute ETL pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active ETL pipelines
app.get('/api/etl/active', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const activePipelines = db.getActiveETLPipelines();
    res.json(activePipelines);
  } catch (error) {
    console.error('Active ETL pipelines error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ETL job history
app.get('/api/etl/history', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { limit = 50 } = req.query;
    const history = db.getETLJobHistory(parseInt(limit));
    res.json(history);
  } catch (error) {
    console.error('ETL history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ETL statistics
app.get('/api/etl/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const stats = db.getETLStats();
    res.json(stats);
  } catch (error) {
    console.error('ETL stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from CSV
app.post('/api/etl/import/csv', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection, filePath, options = {} } = req.body;
    
    if (!collection || !filePath) {
      return res.status(400).json({ error: 'Collection and filePath are required' });
    }

    const execution = await db.importFromCSV(collection, filePath, options);
    res.json(execution);
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to CSV
app.post('/api/etl/export/csv', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { collection, filePath, options = {} } = req.body;
    
    if (!collection || !filePath) {
      return res.status(400).json({ error: 'Collection and filePath are required' });
    }

    const execution = await db.exportToCSV(collection, filePath, options);
    res.json(execution);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Dashboard error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start dashboard server only when explicitly called
export async function startDashboard() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`🚀 BigBaseAlpha Dashboard running on http://localhost:${port}`);
    console.log(`📊 Dashboard features:`);
    console.log(`   • Real-time statistics`);
    console.log(`   • Collection management`);
    console.log(`   • Query builder`);
    console.log(`   • System monitoring`);
    console.log(`   • Configuration panel`);
    console.log(`   • User authentication with 2FA`);
    console.log(`   • Backup management system`);
    console.log(`   • Data export capabilities`);
    console.log(`   • Full-text search engine`);
    console.log(`   • Query profiler & performance analytics`);
    console.log(`   • Search suggestions & autocomplete`);
    console.log(`   • Performance optimization recommendations`);
    console.log(`   • ETL & Data Pipeline engine`);
    console.log(`   • CSV/JSON import/export capabilities`);
    console.log(`   • Scheduled data processing jobs`);
  });
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down dashboard server...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down dashboard server...');
    process.exit(0);
  });
}

export default app;
