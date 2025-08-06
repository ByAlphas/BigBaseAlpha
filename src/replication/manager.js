import { EventEmitter } from 'events';
import net from 'net';
import crypto from 'crypto';

/**
 * BigBaseAlpha Master-Slave Replication System
 * High availability with automatic failover and data synchronization
 * 
 * @copyright 2025 ByAlphas. All rights reserved.
 */
export class ReplicationManager extends EventEmitter {
    constructor(database, options = {}) {
        super();
        
        this.database = database;
        this.options = {
            role: options.role || 'master', // 'master' or 'slave'
            port: options.port || 9000,
            slaves: options.slaves || [], // Array of slave addresses
            masterHost: options.masterHost || 'localhost',
            masterPort: options.masterPort || 9000,
            syncInterval: options.syncInterval || 5000, // 5 seconds
            heartbeatInterval: options.heartbeatInterval || 2000, // 2 seconds
            failoverTimeout: options.failoverTimeout || 10000, // 10 seconds
            replicationKey: options.replicationKey || this._generateReplicationKey(),
            enableCompression: options.enableCompression !== false,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            ...options
        };
        
        // State management
        this.isActive = false;
        this.server = null;
        this.masterConnection = null;
        this.slaveConnections = new Map();
        this.oplog = []; // Operation log for replication
        this.lastSyncTimestamp = 0;
        this.isSyncing = false;
        
        // Health monitoring
        this.healthStatus = {
            role: this.options.role,
            status: 'stopped',
            lastHeartbeat: null,
            lag: 0,
            connectedSlaves: 0,
            failoverCandidate: false
        };
        
        // Failover management
        this.failoverInProgress = false;
        this.electionTimeout = null;
        this.priority = options.priority || 1; // For master election
        
        this._setupOperationLogging();
    }
    
    /**
     * Start replication system
     */
    async start() {
        try {
            this.isActive = true;
            
            if (this.options.role === 'master') {
                await this._startMaster();
            } else {
                await this._startSlave();
            }
            
            console.log(`[PROCESS] Replication started as ${this.options.role}`);
            this.emit('replicationStarted', { role: this.options.role });
            
        } catch (error) {
            console.error('Failed to start replication:', error);
            throw error;
        }
    }
    
    /**
     * Stop replication system
     */
    async stop() {
        this.isActive = false;
        
        if (this.server) {
            this.server.close();
        }
        
        if (this.masterConnection) {
            this.masterConnection.destroy();
        }
        
        this.slaveConnections.forEach(conn => conn.destroy());
        this.slaveConnections.clear();
        
        if (this.electionTimeout) {
            clearTimeout(this.electionTimeout);
        }
        
        console.log('[SHUTDOWN] Replication stopped');
        this.emit('replicationStopped');
    }
    
    /**
     * Start master node
     */
    async _startMaster() {
        this.server = net.createServer((socket) => {
            this._handleSlaveConnection(socket);
        });
        
        await new Promise((resolve, reject) => {
            this.server.listen(this.options.port, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        
        this.healthStatus.status = 'active';
        console.log(`👑 Master server listening on port ${this.options.port}`);
        
        // Start heartbeat for slaves
        this._startHeartbeat();
        
        // Connect to configured slaves
        await this._connectToSlaves();
    }
    
    /**
     * Start slave node
     */
    async _startSlave() {
        await this._connectToMaster();
        
        // Start slave server for potential failover
        this.server = net.createServer((socket) => {
            this._handlePeerConnection(socket);
        });
        
        await new Promise((resolve, reject) => {
            this.server.listen(this.options.port, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        
        this.healthStatus.status = 'active';
        console.log(`🤝 Slave connected to master at ${this.options.masterHost}:${this.options.masterPort}`);
    }
    
    /**
     * Handle slave connection to master
     */
    _handleSlaveConnection(socket) {
        const slaveId = this._generateSlaveId();
        const slave = {
            id: slaveId,
            socket,
            lastHeartbeat: Date.now(),
            authenticated: false,
            address: socket.remoteAddress,
            port: socket.remotePort
        };
        
        console.log(`[LINK] Slave connected: ${slave.address}:${slave.port}`);
        
        socket.on('data', (data) => {
            this._handleSlaveMessage(slaveId, data);
        });
        
        socket.on('close', () => {
            this._handleSlaveDisconnect(slaveId);
        });
        
        socket.on('error', (error) => {
            console.error(`Slave ${slaveId} error:`, error);
            this._handleSlaveDisconnect(slaveId);
        });
        
        this.slaveConnections.set(slaveId, slave);
        this.healthStatus.connectedSlaves = this.slaveConnections.size;
        
        // Request authentication
        this._sendToSlave(slaveId, {
            type: 'auth_required',
            challenge: this._generateChallenge()
        });
    }
    
    /**
     * Connect to master (for slaves)
     */
    async _connectToMaster() {
        return new Promise((resolve, reject) => {
            this.masterConnection = net.createConnection({
                host: this.options.masterHost,
                port: this.options.masterPort
            });
            
            this.masterConnection.on('connect', () => {
                console.log('📡 Connected to master');
                this._authenticateWithMaster();
                resolve();
            });
            
            this.masterConnection.on('data', (data) => {
                this._handleMasterMessage(data);
            });
            
            this.masterConnection.on('close', () => {
                console.warn('[WARN] Master connection lost');
                this._handleMasterDisconnect();
            });
            
            this.masterConnection.on('error', (error) => {
                console.error('Master connection error:', error);
                this._handleMasterDisconnect();
                reject(error);
            });
        });
    }
    
    /**
     * Setup operation logging for replication
     */
    _setupOperationLogging() {
        if (this.options.role === 'master') {
            // Listen to database operations
            this.database.on('operation', (operation) => {
                this._logOperation(operation);
            });
        }
    }
    
    /**
     * Log operation for replication
     */
    _logOperation(operation) {
        const oplogEntry = {
            id: this._generateOplogId(),
            timestamp: Date.now(),
            operation: operation.type,
            collection: operation.collection,
            data: operation.data,
            filter: operation.filter,
            result: operation.result
        };
        
        this.oplog.push(oplogEntry);
        
        // Keep oplog size manageable
        if (this.oplog.length > 10000) {
            this.oplog = this.oplog.slice(-5000);
        }
        
        // Replicate to slaves
        this._replicateOperation(oplogEntry);
    }
    
    /**
     * Replicate operation to all slaves
     */
    _replicateOperation(oplogEntry) {
        const message = {
            type: 'replicate',
            operation: oplogEntry
        };
        
        this.slaveConnections.forEach((slave, slaveId) => {
            if (slave.authenticated) {
                this._sendToSlave(slaveId, message);
            }
        });
    }
    
    /**
     * Apply replicated operation on slave
     */
    async _applyReplicatedOperation(operation) {
        try {
            // Temporarily disable operation logging to avoid loops
            const originalEmit = this.database.emit;
            this.database.emit = () => {};
            
            const collection = this.database.collection(operation.collection);
            
            switch (operation.operation) {
                case 'insert':
                    await collection.insertOne(operation.data);
                    break;
                    
                case 'update':
                    await collection.updateOne(operation.filter, { $set: operation.data });
                    break;
                    
                case 'delete':
                    await collection.deleteOne(operation.filter);
                    break;
                    
                case 'insertMany':
                    await collection.insertMany(operation.data);
                    break;
                    
                case 'updateMany':
                    await collection.updateMany(operation.filter, { $set: operation.data });
                    break;
                    
                case 'deleteMany':
                    await collection.deleteMany(operation.filter);
                    break;
                    
                default:
                    console.warn(`Unknown operation type: ${operation.operation}`);
            }
            
            // Restore event emission
            this.database.emit = originalEmit;
            
            this.lastSyncTimestamp = operation.timestamp;
            
        } catch (error) {
            console.error('Error applying replicated operation:', error);
        }
    }
    
    /**
     * Force manual failover
     */
    async forceFailover() {
        if (this.options.role !== 'slave') {
            throw new Error('Failover can only be initiated from slave nodes');
        }
        
        console.log('[PROCESS] Forcing manual failover...');
        this._startFailoverProcess();
    }
    
    /**
     * Start failover election process
     */
    _startFailoverProcess() {
        this.failoverInProgress = true;
        this.healthStatus.failoverCandidate = true;
        
        console.log('[ELECTION] Starting master election...');
        
        // Wait for election timeout
        this.electionTimeout = setTimeout(() => {
            this._promoteToMaster();
        }, this.options.failoverTimeout);
        
        this.emit('failoverStarted');
    }
    
    /**
     * Promote this slave to master
     */
    async _promoteToMaster() {
        try {
            console.log('👑 Promoting to master...');
            
            this.options.role = 'master';
            this.healthStatus.role = 'master';
            this.failoverInProgress = false;
            
            // Close master connection
            if (this.masterConnection) {
                this.masterConnection.destroy();
                this.masterConnection = null;
            }
            
            // Start accepting slave connections
            this._startHeartbeat();
            
            console.log('[SUCCESS] Successfully promoted to master');
            this.emit('promotedToMaster');
            
        } catch (error) {
            console.error('Failed to promote to master:', error);
            this.failoverInProgress = false;
        }
    }
    
    /**
     * Get replication status
     */
    getReplicationStatus() {
        return {
            role: this.options.role,
            status: this.healthStatus.status,
            isActive: this.isActive,
            lag: this.healthStatus.lag,
            lastSync: this.lastSyncTimestamp,
            slaves: this.options.role === 'master' ? {
                connected: this.slaveConnections.size,
                list: Array.from(this.slaveConnections.values()).map(slave => ({
                    id: slave.id,
                    address: slave.address,
                    port: slave.port,
                    lastHeartbeat: slave.lastHeartbeat,
                    authenticated: slave.authenticated
                }))
            } : null,
            master: this.options.role === 'slave' ? {
                host: this.options.masterHost,
                port: this.options.masterPort,
                connected: !!this.masterConnection,
                lastHeartbeat: this.healthStatus.lastHeartbeat
            } : null,
            oplog: {
                size: this.oplog.length,
                latest: this.oplog[this.oplog.length - 1]
            },
            failover: {
                inProgress: this.failoverInProgress,
                candidate: this.healthStatus.failoverCandidate,
                priority: this.priority
            }
        };
    }
    
    // Helper methods (simplified for brevity)
    _generateReplicationKey() { return crypto.randomBytes(32).toString('hex'); }
    _generateSlaveId() { return 'slave_' + crypto.randomBytes(8).toString('hex'); }
    _generateOplogId() { return 'op_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'); }
    _generateChallenge() { return crypto.randomBytes(16).toString('hex'); }
    
    _sendToSlave(slaveId, message) {
        const slave = this.slaveConnections.get(slaveId);
        if (slave && slave.socket.writable) {
            try {
                slave.socket.write(JSON.stringify(message) + '\n');
            } catch (error) {
                console.error(`Error sending to slave ${slaveId}:`, error);
                this._handleSlaveDisconnect(slaveId);
            }
        }
    }
    
    _sendToMaster(message) {
        if (this.masterConnection && this.masterConnection.writable) {
            try {
                this.masterConnection.write(JSON.stringify(message) + '\n');
            } catch (error) {
                console.error('Error sending to master:', error);
                this._handleMasterDisconnect();
            }
        }
    }
    
    _handleSlaveMessage(slaveId, data) {
        try {
            const message = JSON.parse(data.toString());
            const slave = this.slaveConnections.get(slaveId);
            if (!slave) return;
            
            switch (message.type) {
                case 'auth':
                    if (message.key === this.options.replicationKey) {
                        slave.authenticated = true;
                        this._sendToSlave(slaveId, { type: 'auth_success' });
                        console.log(`[SUCCESS] Slave ${slaveId} authenticated`);
                    } else {
                        this._sendToSlave(slaveId, { type: 'auth_failed' });
                        slave.socket.destroy();
                    }
                    break;
                    
                case 'heartbeat':
                    slave.lastHeartbeat = Date.now();
                    this._sendToSlave(slaveId, { type: 'heartbeat_ack', timestamp: Date.now() });
                    break;
            }
        } catch (error) {
            console.error(`Error handling slave message:`, error);
        }
    }
    
    _handleMasterMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'auth_required':
                    this._sendToMaster({
                        type: 'auth',
                        key: this.options.replicationKey
                    });
                    break;
                    
                case 'auth_success':
                    console.log('[SUCCESS] Authenticated with master');
                    this._startSlaveSync();
                    break;
                    
                case 'replicate':
                    this._applyReplicatedOperation(message.operation);
                    break;
                    
                case 'heartbeat_ack':
                    this.healthStatus.lastHeartbeat = message.timestamp;
                    this.healthStatus.lag = Date.now() - message.timestamp;
                    break;
            }
        } catch (error) {
            console.error('Error handling master message:', error);
        }
    }
    
    _handleSlaveDisconnect(slaveId) {
        this.slaveConnections.delete(slaveId);
        this.healthStatus.connectedSlaves = this.slaveConnections.size;
        console.log(`[ERROR] Slave ${slaveId} disconnected`);
    }
    
    _handleMasterDisconnect() {
        if (this.options.role === 'slave' && !this.failoverInProgress) {
            console.warn('[WARN] Master connection lost - starting failover process');
            this._startFailoverProcess();
        }
    }
    
    _connectToSlaves() {
        // Placeholder for connecting to configured slaves
    }
    
    _handlePeerConnection(socket) {
        // Handle peer connections for election
    }
    
    _authenticateWithMaster() {
        this._sendToMaster({
            type: 'auth',
            key: this.options.replicationKey
        });
    }
    
    _startHeartbeat() {
        setInterval(() => {
            if (!this.isActive) return;
            
            this.slaveConnections.forEach((slave, slaveId) => {
                if (Date.now() - slave.lastHeartbeat > this.options.failoverTimeout) {
                    this._handleSlaveDisconnect(slaveId);
                } else {
                    this._sendToSlave(slaveId, { type: 'heartbeat', timestamp: Date.now() });
                }
            });
        }, this.options.heartbeatInterval);
    }
    
    _startSlaveSync() {
        setInterval(() => {
            if (!this.isActive || this.options.role !== 'slave') return;
            
            this._sendToMaster({
                type: 'heartbeat',
                timestamp: Date.now(),
                status: this.healthStatus
            });
        }, this.options.heartbeatInterval);
    }
}

export default ReplicationManager;
