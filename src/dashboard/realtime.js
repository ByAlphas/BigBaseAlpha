import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';

/**
 * BigBaseAlpha Real-time Dashboard Enhancement
 * WebSocket-based real-time updates and advanced monitoring
 * 
 * @copyright 2025 ByAlphas. All rights reserved.
 */
export class RealtimeDashboard extends EventEmitter {
    constructor(database, authManager, options = {}) {
        super();
        
        this.database = database;
        this.authManager = authManager;
        this.options = {
            wsPort: options.wsPort || 8080,
            updateInterval: options.updateInterval || 5000, // 5 seconds (optimized)
            maxClients: options.maxClients || 100,
            enableMetrics: options.enableMetrics !== false,
            enableAlerts: options.enableAlerts !== false,
            retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
            ...options
        };
        
        this.wsServer = null;
        this.clients = new Map();
        this.metrics = {
            system: [],
            database: [],
            users: [],
            api: []
        };
        
        this.alerts = [];
        this.thresholds = {
            cpuUsage: 95, // Increased from 80% to 95%
            memoryUsage: 90, // Increased from 85% to 90%
            diskUsage: 95, // Increased from 90% to 95%
            responseTime: 2000, // Increased from 1000ms to 2000ms
            errorRate: 10 // Increased from 5% to 10%
        };
        
        this.updateInterval = null;
        this.isMonitoring = false;
        
        // Real-time counters
        this.counters = {
            requests: 0,
            errors: 0,
            connections: 0,
            lastReset: Date.now()
        };
        
        this._setupMetricsCollection();
    }
    
    /**
     * Start the real-time dashboard WebSocket server
     */
    async start() {
        try {
            this.wsServer = new WebSocketServer({ 
                port: this.options.wsPort,
                maxPayload: 1024 * 1024 // 1MB
            });
            
            this.wsServer.on('connection', (ws, req) => {
                this._handleClientConnection(ws, req);
            });
            
            this.wsServer.on('error', (error) => {
                console.error('WebSocket server error:', error);
                this.emit('error', error);
            });
            
            // Start metrics collection
            await this._startMetricsCollection();
            
            console.log(`📊 Real-time Dashboard WebSocket server started on port ${this.options.wsPort}`);
            this.emit('dashboardStarted', { port: this.options.wsPort });
            
        } catch (error) {
            console.error('Failed to start real-time dashboard:', error);
            throw error;
        }
    }
    
    /**
     * Stop the real-time dashboard
     */
    async stop() {
        this.isMonitoring = false;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.wsServer) {
            this.wsServer.close();
            console.log('🛑 Real-time Dashboard stopped');
            this.emit('dashboardStopped');
        }
    }
    
    /**
     * Handle new WebSocket client connection
     */
    async _handleClientConnection(ws, req) {
        const clientId = this._generateClientId();
        const ipAddress = req.socket.remoteAddress;
        
        try {
            // Authentication check
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                ws.close(1008, 'Authentication required');
                return;
            }
            
            const token = authHeader.split(' ')[1];
            const authResult = await this.authManager.verifyToken(token);
            
            if (!authResult.valid) {
                ws.close(1008, 'Invalid token');
                return;
            }
            
            // Check permissions
            if (!this.authManager.hasPermission(authResult.user.permissions, 'dashboard:read')) {
                ws.close(1008, 'Insufficient permissions');
                return;
            }
            
            // Register client
            const client = {
                id: clientId,
                ws,
                user: authResult.user,
                ipAddress,
                connectedAt: new Date(),
                lastPing: Date.now(),
                subscriptions: new Set(),
                isAlive: true
            };
            
            this.clients.set(clientId, client);
            this.counters.connections++;
            
            console.log(`📱 Dashboard client connected: ${authResult.user.username} (${clientId})`);
            
            // Setup client handlers
            ws.on('message', (data) => {
                this._handleClientMessage(clientId, data);
            });
            
            ws.on('close', () => {
                this._handleClientDisconnect(clientId);
            });
            
            ws.on('error', (error) => {
                console.error(`Client ${clientId} error:`, error);
                this._handleClientDisconnect(clientId);
            });
            
            // Setup ping/pong for connection health
            ws.on('pong', () => {
                client.lastPing = Date.now();
                client.isAlive = true;
            });
            
            // Send initial data
            this._sendToClient(clientId, {
                type: 'connected',
                clientId,
                serverTime: new Date().toISOString(),
                user: authResult.user
            });
            
            // Send current metrics
            const currentMetrics = this._getCurrentMetrics();
            this._sendToClient(clientId, {
                type: 'metrics',
                data: currentMetrics
            });
            
            this.emit('clientConnected', { clientId, user: authResult.user });
            
        } catch (error) {
            console.error('Client connection error:', error);
            ws.close(1011, 'Internal server error');
        }
    }
    
    /**
     * Handle client message
     */
    _handleClientMessage(clientId, data) {
        try {
            const client = this.clients.get(clientId);
            if (!client) return;
            
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'subscribe':
                    this._handleSubscription(clientId, message.channels);
                    break;
                    
                case 'unsubscribe':
                    this._handleUnsubscription(clientId, message.channels);
                    break;
                    
                case 'ping':
                    this._sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
                    break;
                    
                case 'getMetrics':
                    const metrics = this._getCurrentMetrics();
                    this._sendToClient(clientId, { type: 'metrics', data: metrics });
                    break;
                    
                case 'getAlerts':
                    this._sendToClient(clientId, { 
                        type: 'alerts', 
                        data: this.alerts.slice(-50) // Last 50 alerts
                    });
                    break;
                    
                case 'acknowledgeAlert':
                    this._acknowledgeAlert(message.alertId, client.user._id);
                    break;
                    
                case 'executeQuery':
                    if (this.authManager.hasPermission(client.user.permissions, 'query:execute')) {
                        this._executeRealtimeQuery(clientId, message.query);
                    } else {
                        this._sendToClient(clientId, {
                            type: 'error',
                            message: 'Insufficient permissions for query execution'
                        });
                    }
                    break;
                    
                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
            
        } catch (error) {
            console.error(`Error handling client message:`, error);
            this._sendToClient(clientId, {
                type: 'error',
                message: 'Invalid message format'
            });
        }
    }
    
    /**
     * Handle client disconnect
     */
    _handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            console.log(`📱 Dashboard client disconnected: ${client.user.username} (${clientId})`);
            this.clients.delete(clientId);
            this.counters.connections--;
            this.emit('clientDisconnected', { clientId, user: client.user });
        }
    }
    
    /**
     * Handle channel subscriptions
     */
    _handleSubscription(clientId, channels) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        const validChannels = ['system', 'database', 'users', 'api', 'alerts', 'logs'];
        
        channels.forEach(channel => {
            if (validChannels.includes(channel)) {
                client.subscriptions.add(channel);
                console.log(`📺 Client ${clientId} subscribed to ${channel}`);
            }
        });
        
        this._sendToClient(clientId, {
            type: 'subscribed',
            channels: Array.from(client.subscriptions)
        });
    }
    
    /**
     * Handle channel unsubscriptions
     */
    _handleUnsubscription(clientId, channels) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        channels.forEach(channel => {
            client.subscriptions.delete(channel);
        });
        
        this._sendToClient(clientId, {
            type: 'unsubscribed',
            channels: channels
        });
    }
    
    /**
     * Send message to specific client
     */
    _sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Error sending to client ${clientId}:`, error);
                this._handleClientDisconnect(clientId);
            }
        }
    }
    
    /**
     * Broadcast message to all clients with specific subscription
     */
    _broadcastToChannel(channel, message) {
        const messageData = {
            ...message,
            timestamp: new Date().toISOString(),
            channel
        };
        
        this.clients.forEach((client, clientId) => {
            if (client.subscriptions.has(channel)) {
                this._sendToClient(clientId, messageData);
            }
        });
    }
    
    /**
     * Setup metrics collection
     */
    _setupMetricsCollection() {
        // Listen to database events
        this.database.on('operation', (data) => {
            this._recordDatabaseMetric(data);
        });
        
        this.database.on('error', (error) => {
            this._createAlert('database_error', 'high', error.message);
        });
        
        // Listen to auth events
        this.authManager.on('userLoggedIn', (data) => {
            this._recordUserMetric('login', data);
        });
        
        this.authManager.on('userLoggedOut', (data) => {
            this._recordUserMetric('logout', data);
        });
    }
    
    /**
     * Start metrics collection
     */
    async _startMetricsCollection() {
        this.isMonitoring = true;
        
        this.updateInterval = setInterval(async () => {
            if (!this.isMonitoring) return;
            
            try {
                // Collect system metrics
                const systemMetrics = await this._collectSystemMetrics();
                this._recordSystemMetric(systemMetrics);
                
                // Collect database metrics
                const databaseMetrics = await this._collectDatabaseMetrics();
                this._recordDatabaseMetrics(databaseMetrics);
                
                // Check thresholds and create alerts
                this._checkThresholds(systemMetrics, databaseMetrics);
                
                // Broadcast to subscribed clients
                this._broadcastMetrics();
                
                // Clean old metrics
                this._cleanOldMetrics();
                
            } catch (error) {
                console.error('Error collecting metrics:', error);
            }
            
        }, this.options.updateInterval);
        
        console.log('📈 Metrics collection started');
    }
    
    /**
     * Collect system metrics
     */
    async _collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            timestamp: Date.now(),
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                usage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
                usage: this._calculateCPUUsage(cpuUsage)
            },
            uptime: process.uptime(),
            connections: this.clients.size,
            platform: process.platform,
            nodeVersion: process.version
        };
    }
    
    /**
     * Collect database metrics
     */
    async _collectDatabaseMetrics() {
        try {
            const collections = await this.database.listCollections();
            let totalDocuments = 0;
            let totalSize = 0;
            
            const collectionStats = await Promise.all(
                collections.map(async (name) => {
                    try {
                        const collection = this.database.collection(name);
                        const count = await collection.countDocuments();
                        const size = await collection.estimatedDocumentSize?.() || 0;
                        
                        totalDocuments += count;
                        totalSize += size;
                        
                        return { name, count, size };
                    } catch (error) {
                        return { name, count: 0, size: 0, error: error.message };
                    }
                })
            );
            
            return {
                timestamp: Date.now(),
                collections: {
                    total: collections.length,
                    stats: collectionStats
                },
                documents: {
                    total: totalDocuments
                },
                size: {
                    total: totalSize
                },
                operations: {
                    requests: this.counters.requests,
                    errors: this.counters.errors,
                    errorRate: this.counters.requests > 0 ? 
                        (this.counters.errors / this.counters.requests) * 100 : 0
                }
            };
            
        } catch (error) {
            console.error('Error collecting database metrics:', error);
            return {
                timestamp: Date.now(),
                error: error.message
            };
        }
    }
    
    /**
     * Record system metric
     */
    _recordSystemMetric(metric) {
        this.metrics.system.push(metric);
        
        // Keep only recent metrics
        const cutoff = Date.now() - this.options.retentionPeriod;
        this.metrics.system = this.metrics.system.filter(m => m.timestamp > cutoff);
    }
    
    /**
     * Record database metrics
     */
    _recordDatabaseMetrics(metrics) {
        this.metrics.database.push(metrics);
        
        // Keep only recent metrics
        const cutoff = Date.now() - this.options.retentionPeriod;
        this.metrics.database = this.metrics.database.filter(m => m.timestamp > cutoff);
    }
    
    /**
     * Record database operation metric
     */
    _recordDatabaseMetric(operation) {
        this.counters.requests++;
        
        if (operation.error) {
            this.counters.errors++;
        }
        
        // Broadcast real-time operation
        this._broadcastToChannel('database', {
            type: 'operation',
            data: {
                ...operation,
                timestamp: Date.now()
            }
        });
    }
    
    /**
     * Record user activity metric
     */
    _recordUserMetric(activity, data) {
        const metric = {
            timestamp: Date.now(),
            activity,
            userId: data.user?._id,
            username: data.user?.username,
            sessionId: data.session?.sessionId
        };
        
        this.metrics.users.push(metric);
        
        // Keep only recent metrics
        const cutoff = Date.now() - this.options.retentionPeriod;
        this.metrics.users = this.metrics.users.filter(m => m.timestamp > cutoff);
        
        // Broadcast user activity
        this._broadcastToChannel('users', {
            type: 'activity',
            data: metric
        });
    }
    
    /**
     * Check thresholds and create alerts
     */
    _checkThresholds(systemMetrics, databaseMetrics) {
        // Check CPU usage
        if (systemMetrics.cpu.usage > this.thresholds.cpuUsage) {
            this._createAlert('high_cpu_usage', 'warning', 
                `CPU usage is ${systemMetrics.cpu.usage.toFixed(1)}%`);
        }
        
        // Check memory usage
        if (systemMetrics.memory.usage > this.thresholds.memoryUsage) {
            this._createAlert('high_memory_usage', 'warning',
                `Memory usage is ${systemMetrics.memory.usage.toFixed(1)}%`);
        }
        
        // Check error rate
        if (databaseMetrics.operations.errorRate > this.thresholds.errorRate) {
            this._createAlert('high_error_rate', 'critical',
                `Error rate is ${databaseMetrics.operations.errorRate.toFixed(1)}%`);
        }
    }
    
    /**
     * Create alert
     */
    _createAlert(type, severity, message, details = {}) {
        const alert = {
            id: this._generateAlertId(),
            type,
            severity,
            message,
            details,
            timestamp: Date.now(),
            acknowledged: false,
            acknowledgedBy: null,
            acknowledgedAt: null
        };
        
        this.alerts.push(alert);
        
        // Keep only recent alerts
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(-500);
        }
        
        // Broadcast alert
        this._broadcastToChannel('alerts', {
            type: 'alert',
            data: alert
        });
        
        console.warn(`⚠️ Alert: ${severity.toUpperCase()} - ${message}`);
        this.emit('alert', alert);
    }
    
    /**
     * Acknowledge alert
     */
    _acknowledgeAlert(alertId, userId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert && !alert.acknowledged) {
            alert.acknowledged = true;
            alert.acknowledgedBy = userId;
            alert.acknowledgedAt = Date.now();
            
            this._broadcastToChannel('alerts', {
                type: 'alert_acknowledged',
                data: alert
            });
        }
    }
    
    /**
     * Execute real-time query
     */
    async _executeRealtimeQuery(clientId, query) {
        try {
            const startTime = Date.now();
            
            // Basic security: only allow read operations
            if (query.operation && !['find', 'aggregate', 'count'].includes(query.operation)) {
                throw new Error('Only read operations are allowed in real-time queries');
            }
            
            const collection = this.database.collection(query.collection);
            let result;
            
            switch (query.operation) {
                case 'find':
                    result = await collection.find(query.filter || {})
                        .limit(query.limit || 100)
                        .toArray();
                    break;
                    
                case 'count':
                    result = await collection.countDocuments(query.filter || {});
                    break;
                    
                case 'aggregate':
                    result = await collection.aggregate(query.pipeline || []).toArray();
                    break;
                    
                default:
                    throw new Error('Unsupported operation');
            }
            
            const duration = Date.now() - startTime;
            
            this._sendToClient(clientId, {
                type: 'query_result',
                data: {
                    query,
                    result,
                    duration,
                    timestamp: Date.now()
                }
            });
            
        } catch (error) {
            this._sendToClient(clientId, {
                type: 'query_error',
                error: error.message,
                query
            });
        }
    }
    
    /**
     * Broadcast current metrics to all subscribed clients
     */
    _broadcastMetrics() {
        const metrics = this._getCurrentMetrics();
        
        this._broadcastToChannel('system', {
            type: 'metrics_update',
            data: metrics
        });
    }
    
    /**
     * Get current aggregated metrics
     */
    _getCurrentMetrics() {
        const now = Date.now();
        const lastHour = now - (60 * 60 * 1000);
        
        // Get latest system metrics
        const latestSystem = this.metrics.system[this.metrics.system.length - 1];
        
        // Get latest database metrics
        const latestDatabase = this.metrics.database[this.metrics.database.length - 1];
        
        // Calculate hourly user activity
        const hourlyUsers = this.metrics.users.filter(m => m.timestamp > lastHour);
        const uniqueUsers = new Set(hourlyUsers.map(m => m.userId)).size;
        
        return {
            timestamp: now,
            system: latestSystem || {},
            database: latestDatabase || {},
            users: {
                active: this.clients.size,
                hourly: uniqueUsers,
                total: hourlyUsers.length
            },
            api: {
                requests: this.counters.requests,
                errors: this.counters.errors,
                errorRate: this.counters.requests > 0 ? 
                    (this.counters.errors / this.counters.requests) * 100 : 0
            },
            alerts: {
                total: this.alerts.length,
                unacknowledged: this.alerts.filter(a => !a.acknowledged).length
            }
        };
    }
    
    /**
     * Clean old metrics to prevent memory leaks
     */
    _cleanOldMetrics() {
        const cutoff = Date.now() - this.options.retentionPeriod;
        
        this.metrics.system = this.metrics.system.filter(m => m.timestamp > cutoff);
        this.metrics.database = this.metrics.database.filter(m => m.timestamp > cutoff);
        this.metrics.users = this.metrics.users.filter(m => m.timestamp > cutoff);
        
        // Reset counters periodically
        if (Date.now() - this.counters.lastReset > 60 * 60 * 1000) { // 1 hour
            this.counters.requests = 0;
            this.counters.errors = 0;
            this.counters.lastReset = Date.now();
        }
    }
    
    /**
     * Calculate CPU usage percentage
     */
    _calculateCPUUsage(cpuUsage) {
        // More accurate CPU usage calculation
        if (!this.lastCpuUsage) {
            this.lastCpuUsage = cpuUsage;
            this.lastCpuTime = Date.now();
            return 0; // First measurement, return 0
        }
        
        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastCpuTime;
        
        if (timeDiff < 100) return this.lastCalculatedCpu || 0; // Too soon
        
        const userDiff = cpuUsage.user - this.lastCpuUsage.user;
        const systemDiff = cpuUsage.system - this.lastCpuUsage.system;
        const totalDiff = userDiff + systemDiff;
        
        // Convert microseconds to percentage
        const usage = Math.min(100, (totalDiff / (timeDiff * 1000)) * 100);
        
        this.lastCpuUsage = cpuUsage;
        this.lastCpuTime = currentTime;
        this.lastCalculatedCpu = Math.max(0, Math.min(100, usage));
        
        return this.lastCalculatedCpu;
    }
    
    // Utility methods
    _generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9);
    }
    
    _generateAlertId() {
        return 'alert_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Get dashboard statistics
     */
    getDashboardStats() {
        return {
            clients: {
                connected: this.clients.size,
                maxClients: this.options.maxClients
            },
            metrics: {
                system: this.metrics.system.length,
                database: this.metrics.database.length,
                users: this.metrics.users.length
            },
            alerts: {
                total: this.alerts.length,
                unacknowledged: this.alerts.filter(a => !a.acknowledged).length
            },
            server: {
                running: !!this.wsServer,
                port: this.options.wsPort,
                uptime: this.isMonitoring ? Date.now() - this.counters.lastReset : 0
            }
        };
    }
    
    /**
     * Health check for monitoring systems
     */
    healthCheck() {
        const stats = this.getDashboardStats();
        const latestMetrics = this._getCurrentMetrics();
        
        return {
            status: this.isMonitoring ? 'healthy' : 'stopped',
            timestamp: new Date().toISOString(),
            stats,
            metrics: latestMetrics,
            version: '1.5.0'
        };
    }
}

export default RealtimeDashboard;
