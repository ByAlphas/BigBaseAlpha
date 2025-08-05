import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

/**
 * Advanced Monitoring System for BigBaseAlpha
 * Provides comprehensive system monitoring, alerting, and health checks
 */
export class MonitoringEngine extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      enabled: config.monitoring?.enabled || true,
      interval: config.monitoring?.interval || 30000, // 30 seconds
      alerting: config.monitoring?.alerting || false,
      email: config.monitoring?.email || {},
      slack: config.monitoring?.slack || {},
      prometheus: config.monitoring?.prometheus || false,
      logLevel: config.monitoring?.logLevel || 'info',
      retentionDays: config.monitoring?.retentionDays || 30,
      thresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        responseTime: 1000,
        errorRate: 5,
        connectionCount: 1000,
        ...config.monitoring?.thresholds
      },
      ...config.monitoring
    };

    this.database = null;
    this.isInitialized = false;
    this.alerter = null;
    
    // Metrics storage
    this.metrics = new Map();
    this.alerts = new Map();
    this.healthChecks = new Map();
    this.performanceHistory = [];
    
    // Current system state
    this.systemState = {
      status: 'healthy',
      uptime: Date.now(),
      lastCheck: null,
      alerts: [],
      warnings: []
    };

    // Performance monitoring
    this.performance = {
      queryTimes: [],
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      throughput: 0
    };

    this.timers = new Map();
  }

  async init() {
    if (this.isInitialized) return;

    console.log('📊 Initializing Advanced Monitoring System...');

    try {
      // Initialize alerting system
      if (this.config.alerting) {
        await this._initializeAlerting();
      }

      // Register default health checks
      this._registerDefaultHealthChecks();

      // Start monitoring processes
      this._startSystemMonitoring();
      this._startPerformanceMonitoring();
      this._startHealthChecks();

      // Setup metric retention cleanup
      this._setupMetricRetention();

      this.isInitialized = true;
      console.log('✅ Advanced Monitoring System initialized');

      this.emit('monitoringStarted', {
        enabled: this.config.enabled,
        alerting: this.config.alerting,
        interval: this.config.interval
      });

    } catch (error) {
      console.error('❌ Failed to initialize monitoring:', error.message);
      throw error;
    }
  }

  setDatabase(database) {
    this.database = database;

    // Monitor database events
    this.database.on('query', (event) => {
      this._recordQueryMetric(event);
    });

    this.database.on('error', (error) => {
      this._recordError(error);
    });

    this.database.on('connection', (event) => {
      this._recordConnectionMetric(event);
    });
  }

  async _initializeAlerting() {
    this.alerter = {
      email: null,
      slack: null
    };

    // Setup email alerting
    if (this.config.email.enabled) {
      console.log('📧 Email alerting configured (requires nodemailer package)');
      // this.alerter.email = nodemailer.createTransporter({
      //   host: this.config.email.host,
      //   port: this.config.email.port,
      //   secure: this.config.email.secure,
      //   auth: {
      //     user: this.config.email.user,
      //     pass: this.config.email.password
      //   }
      // });
    }

    // Setup Slack alerting
    if (this.config.slack.enabled) {
      this.alerter.slack = {
        webhook: this.config.slack.webhook,
        channel: this.config.slack.channel
      };
    }
  }

  _registerDefaultHealthChecks() {
    // System health checks
    this.registerHealthCheck('cpu', async () => {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (let type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - ~~(100 * idle / total);

      return {
        status: usage < this.config.thresholds.cpuUsage ? 'healthy' : 'critical',
        value: usage,
        unit: '%',
        message: `CPU usage: ${usage}%`
      };
    });

    this.registerHealthCheck('memory', async () => {
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      const usage = (used / total) * 100;

      return {
        status: usage < this.config.thresholds.memoryUsage ? 'healthy' : 'critical',
        value: usage,
        unit: '%',
        total: total,
        used: used,
        free: free,
        message: `Memory usage: ${usage.toFixed(1)}%`
      };
    });

    this.registerHealthCheck('disk', async () => {
      try {
        const stats = await fs.stat(this.database?.config?.path || './');
        // Simplified disk check - in production, use a proper disk space library
        return {
          status: 'healthy',
          value: 0,
          unit: '%',
          message: 'Disk space monitoring requires additional implementation'
        };
      } catch (error) {
        return {
          status: 'error',
          message: error.message
        };
      }
    });

    this.registerHealthCheck('database', async () => {
      if (!this.database) {
        return {
          status: 'error',
          message: 'Database not initialized'
        };
      }

      try {
        const stats = this.database.getStats();
        const responseTime = this.performance.avgResponseTime;
        
        return {
          status: responseTime < this.config.thresholds.responseTime ? 'healthy' : 'warning',
          value: responseTime,
          unit: 'ms',
          collections: stats.collections,
          operations: stats.totalOperations,
          message: `Database responsive - ${responseTime}ms avg response time`
        };
      } catch (error) {
        return {
          status: 'critical',
          message: `Database error: ${error.message}`
        };
      }
    });
  }

  _startSystemMonitoring() {
    if (this.timers.has('system')) return;

    const systemTimer = setInterval(async () => {
      await this._collectSystemMetrics();
    }, this.config.interval);

    this.timers.set('system', systemTimer);
  }

  _startPerformanceMonitoring() {
    if (this.timers.has('performance')) return;

    const perfTimer = setInterval(() => {
      this._calculatePerformanceMetrics();
    }, this.config.interval);

    this.timers.set('performance', perfTimer);
  }

  _startHealthChecks() {
    if (this.timers.has('health')) return;

    const healthTimer = setInterval(async () => {
      await this._runHealthChecks();
    }, this.config.interval);

    this.timers.set('health', healthTimer);
  }

  async _collectSystemMetrics() {
    const timestamp = Date.now();
    
    // System metrics
    const systemMetrics = {
      timestamp,
      cpu: {
        load: os.loadavg(),
        count: os.cpus().length
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      network: os.networkInterfaces(),
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname()
    };

    // Database metrics (if available)
    if (this.database) {
      let dbStats = {};
      try {
        dbStats = this.database.getStats();
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        // Ignore ENOENT error, throw others
      }
      systemMetrics.database = {
        collections: dbStats.collections || 0,
        operations: dbStats.totalOperations || 0,
        uptime: dbStats.uptime || 0,
        memory: dbStats.memoryUsage || 0,
        cache: dbStats.cacheStats || {}
      };
    }

    // Store metrics
    this._storeMetric('system', systemMetrics);
    
    // Check thresholds and trigger alerts
    await this._checkThresholds(systemMetrics);
  }

  _calculatePerformanceMetrics() {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    
    // Filter recent query times
    this.performance.queryTimes = this.performance.queryTimes.filter(
      qt => now - qt.timestamp < windowSize
    );

    // Calculate average response time
    if (this.performance.queryTimes.length > 0) {
      const totalTime = this.performance.queryTimes.reduce((sum, qt) => sum + qt.duration, 0);
      this.performance.avgResponseTime = totalTime / this.performance.queryTimes.length;
    }

    // Calculate throughput (requests per second)
    this.performance.throughput = this.performance.queryTimes.length / (windowSize / 1000);

    // Calculate error rate
    const errorRate = this.performance.requestCount > 0 
      ? (this.performance.errorCount / this.performance.requestCount) * 100 
      : 0;

    const perfMetrics = {
      timestamp: now,
      avgResponseTime: this.performance.avgResponseTime,
      throughput: this.performance.throughput,
      errorRate: errorRate,
      requestCount: this.performance.requestCount,
      errorCount: this.performance.errorCount
    };

    this._storeMetric('performance', perfMetrics);
    
    // Store in history for trends
    this.performanceHistory.push(perfMetrics);
    
    // Keep only last 24 hours of performance data
    const dayAgo = now - (24 * 60 * 60 * 1000);
    this.performanceHistory = this.performanceHistory.filter(p => p.timestamp > dayAgo);
  }

  async _runHealthChecks() {
    const timestamp = Date.now();
    const results = {};

    for (const [name, checkFn] of this.healthChecks) {
      try {
        const result = await checkFn();
        results[name] = {
          ...result,
          timestamp,
          checkName: name
        };

        // Trigger alerts for critical issues
        if (result.status === 'critical' || result.status === 'error') {
          await this._triggerAlert('health_check', {
            check: name,
            status: result.status,
            message: result.message,
            value: result.value
          });
        }
      } catch (error) {
        results[name] = {
          status: 'error',
          message: error.message,
          timestamp,
          checkName: name
        };
      }
    }

    this._storeMetric('health_checks', results);
    this.systemState.lastCheck = timestamp;
    
    // Update overall system status
    this._updateSystemStatus(results);
  }

  async _checkThresholds(metrics) {
    const alerts = [];

    // CPU threshold
    if (metrics.cpu.load[0] > this.config.thresholds.cpuUsage / 100) {
      alerts.push({
        type: 'cpu_high',
        severity: 'warning',
        message: `High CPU load: ${(metrics.cpu.load[0] * 100).toFixed(1)}%`,
        value: metrics.cpu.load[0] * 100,
        threshold: this.config.thresholds.cpuUsage
      });
    }

    // Memory threshold
    if (metrics.memory.percentage > this.config.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory_high',
        severity: 'critical',
        message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        value: metrics.memory.percentage,
        threshold: this.config.thresholds.memoryUsage
      });
    }

    // Response time threshold
    if (this.performance.avgResponseTime > this.config.thresholds.responseTime) {
      alerts.push({
        type: 'response_time_high',
        severity: 'warning',
        message: `Slow response time: ${this.performance.avgResponseTime.toFixed(0)}ms`,
        value: this.performance.avgResponseTime,
        threshold: this.config.thresholds.responseTime
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this._triggerAlert(alert.type, alert);
    }
  }

  async _triggerAlert(type, details) {
    const alertId = `${type}_${Date.now()}`;
    const alert = {
      id: alertId,
      type: type,
      severity: details.severity || 'warning',
      message: details.message,
      timestamp: Date.now(),
      details: details,
      acknowledged: false,
      resolved: false
    };

    this.alerts.set(alertId, alert);
    
    // Send notifications
    if (this.config.alerting) {
      await this._sendNotification(alert);
    }

    this.emit('alert', alert);
    console.warn(`🚨 Alert triggered: ${alert.message}`);
  }

  async _sendNotification(alert) {
    // Email notification (requires nodemailer package)
    if (this.alerter?.email && this.config.email.enabled) {
      try {
        console.log('📧 Email alert would be sent:', {
          to: this.config.email.to,
          subject: `[BigBaseAlpha] ${alert.severity.toUpperCase()}: ${alert.type}`,
          message: alert.message
        });
        // await this.alerter.email.sendMail({
        //   from: this.config.email.from,
        //   to: this.config.email.to,
        //   subject: `[BigBaseAlpha] ${alert.severity.toUpperCase()}: ${alert.type}`,
        //   html: this._generateEmailTemplate(alert)
        // });
      } catch (error) {
        console.error('❌ Failed to send email alert:', error.message);
      }
    }

    // Slack notification
    if (this.alerter?.slack && this.config.slack.enabled) {
      try {
        const payload = {
          channel: this.config.slack.channel,
          username: 'BigBaseAlpha Monitor',
          icon_emoji: ':warning:',
          text: `*${alert.severity.toUpperCase()}*: ${alert.message}`,
          attachments: [{
            color: alert.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
            ]
          }]
        };

        // Send to Slack webhook (requires implementation)
        console.log('📱 Slack notification:', payload);
      } catch (error) {
        console.error('❌ Failed to send Slack alert:', error.message);
      }
    }
  }

  _generateEmailTemplate(alert) {
    return `
      <h2>BigBaseAlpha Monitoring Alert</h2>
      <p><strong>Type:</strong> ${alert.type}</p>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
      <hr>
      <p><em>This is an automated message from BigBaseAlpha Monitoring System</em></p>
    `;
  }

  _updateSystemStatus(healthResults) {
    const statuses = Object.values(healthResults).map(r => r.status);
    
    if (statuses.includes('critical') || statuses.includes('error')) {
      this.systemState.status = 'critical';
    } else if (statuses.includes('warning')) {
      this.systemState.status = 'warning';
    } else {
      this.systemState.status = 'healthy';
    }
  }

  _storeMetric(category, data) {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }
    
    const categoryMetrics = this.metrics.get(category);
    categoryMetrics.push(data);
    
    // Keep only recent metrics (based on retention policy)
    const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionTime;
    
    this.metrics.set(category, categoryMetrics.filter(m => m.timestamp > cutoff));
  }

  _recordQueryMetric(event) {
    this.performance.queryTimes.push({
      timestamp: Date.now(),
      duration: event.duration || 0,
      collection: event.collection,
      operation: event.operation
    });
    
    this.performance.requestCount++;
  }

  _recordError(error) {
    this.performance.errorCount++;
    
    this._storeMetric('errors', {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      type: error.name
    });
  }

  _recordConnectionMetric(event) {
    this._storeMetric('connections', {
      timestamp: Date.now(),
      type: event.type,
      count: event.count || 1
    });
  }

  _setupMetricRetention() {
    if (this.timers.has('retention')) return;

    const retentionTimer = setInterval(() => {
      this._cleanupOldMetrics();
    }, 60 * 60 * 1000); // Every hour

    this.timers.set('retention', retentionTimer);
  }

  _cleanupOldMetrics() {
    const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionTime;

    for (const [category, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(category, filtered);
    }
  }

  // Public API methods
  registerHealthCheck(name, checkFunction) {
    this.healthChecks.set(name, checkFunction);
  }

  removeHealthCheck(name) {
    return this.healthChecks.delete(name);
  }

  getSystemStatus() {
    return {
      ...this.systemState,
      uptime: Date.now() - this.systemState.uptime,
      activeAlerts: Array.from(this.alerts.values()).filter(a => !a.resolved),
      healthChecks: this.healthChecks.size
    };
  }

  getMetrics(category, timeRange = 3600000) { // Default 1 hour
    const cutoff = Date.now() - timeRange;
    const categoryMetrics = this.metrics.get(category) || [];
    
    return categoryMetrics.filter(m => m.timestamp > cutoff);
  }

  getPerformanceMetrics() {
    return {
      current: this.performance,
      history: this.performanceHistory,
      trends: this._calculateTrends()
    };
  }

  _calculateTrends() {
    if (this.performanceHistory.length < 2) return {};

    const recent = this.performanceHistory.slice(-10);
    const older = this.performanceHistory.slice(-20, -10);

    const recentAvg = recent.reduce((sum, p) => sum + p.avgResponseTime, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, p) => sum + p.avgResponseTime, 0) / older.length 
      : recentAvg;

    return {
      responseTime: {
        trend: recentAvg > olderAvg ? 'increasing' : 'decreasing',
        change: ((recentAvg - olderAvg) / olderAvg) * 100
      }
    };
  }

  getAlerts(includeResolved = false) {
    const alerts = Array.from(this.alerts.values());
    return includeResolved ? alerts : alerts.filter(a => !a.resolved);
  }

  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      return true;
    }
    return false;
  }

  resolveAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  async runHealthCheck(name) {
    const checkFn = this.healthChecks.get(name);
    if (!checkFn) {
      throw new Error(`Health check '${name}' not found`);
    }
    
    return await checkFn();
  }

  exportMetrics(format = 'json') {
    const data = {
      timestamp: Date.now(),
      systemStatus: this.getSystemStatus(),
      metrics: Object.fromEntries(this.metrics),
      performance: this.getPerformanceMetrics(),
      alerts: this.getAlerts(true)
    };

    if (format === 'prometheus') {
      return this._exportPrometheusFormat(data);
    }
    
    return data;
  }

  _exportPrometheusFormat(data) {
    // Basic Prometheus format export
    let output = '';
    
    output += `# HELP bigbase_system_status System health status (0=healthy, 1=warning, 2=critical)\n`;
    output += `# TYPE bigbase_system_status gauge\n`;
    const statusValue = data.systemStatus.status === 'healthy' ? 0 : 
                       data.systemStatus.status === 'warning' ? 1 : 2;
    output += `bigbase_system_status ${statusValue}\n\n`;
    
    output += `# HELP bigbase_response_time_ms Average response time in milliseconds\n`;
    output += `# TYPE bigbase_response_time_ms gauge\n`;
    output += `bigbase_response_time_ms ${data.performance.current.avgResponseTime}\n\n`;
    
    return output;
  }

  async shutdown() {
    // Stop all timers
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();

    console.log('📊 Monitoring engine shutdown complete');
  }
}

export default MonitoringEngine;
