import { EventEmitter } from 'events';

/**
 * BigBaseAlpha Performance Engine
 * Lazy write operations and performance optimizations
 */
class PerformanceEngine extends EventEmitter {
    constructor(database, options = {}) {
        super();
        
        this.database = database;
        this.options = {
            lazyWriteDelay: 5000,           // 5 seconds default
            batchSize: 100,                 // Max operations per batch
            maxPendingOperations: 10000,    // Memory limit
            compressionEnabled: true,       // Compress batches
            syncOnClose: true,              // Force sync on database close
            ...options
        };
        
        // Performance state
        this.lazyWriteEnabled = false;
        this.pendingOperations = [];
        this.writeTimer = null;
        this.operationQueue = new Map(); // Collection -> operations
        
        // Performance metrics
        this.metrics = {
            totalOperations: 0,
            batchesWritten: 0,
            averageBatchSize: 0,
            lastWriteTime: null,
            pendingCount: 0,
            compressionRatio: 0
        };
        
        // Bind methods
        this._processPendingWrites = this._processPendingWrites.bind(this);
        
        this.emit('performanceEngineInitialized');
    }
    
    /**
     * Enable lazy write mode
     * @param {Object} options - Lazy write options
     */
    enableLazyWrite(options = {}) {
        if (this.lazyWriteEnabled) {
            this.disableLazyWrite(); // Reset if already enabled
        }
        
        // Update options
        Object.assign(this.options, options);
        
        this.lazyWriteEnabled = true;
        this.database.lazyWrite = true;
        
        // Start write timer
        this._scheduleWrite();
        
        this.emit('lazyWriteEnabled', {
            delay: this.options.lazyWriteDelay,
            batchSize: this.options.batchSize
        });
        
        console.log(`🚀 Lazy Write enabled: ${this.options.lazyWriteDelay}ms delay, ${this.options.batchSize} batch size`);
    }
    
    /**
     * Disable lazy write mode and flush pending operations
     */
    async disableLazyWrite() {
        if (!this.lazyWriteEnabled) return;
        
        // Clear timer
        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
            this.writeTimer = null;
        }
        
        // Flush all pending operations
        await this._processPendingWrites();
        
        this.lazyWriteEnabled = false;
        this.database.lazyWrite = false;
        
        this.emit('lazyWriteDisabled');
        console.log('🛑 Lazy Write disabled, all operations flushed');
    }
    
    /**
     * Queue an operation for lazy writing
     * @param {string} collection - Collection name
     * @param {string} operation - Operation type
     * @param {Object} data - Operation data
     */
    queueOperation(collection, operation, data) {
        if (!this.lazyWriteEnabled) {
            throw new Error('Lazy write is not enabled');
        }
        
        // Check memory limits
        if (this.pendingOperations.length >= this.options.maxPendingOperations) {
            console.warn('⚠️ Max pending operations reached, forcing write...');
            this._processPendingWrites();
        }
        
        const op = {
            id: this._generateOperationId(),
            collection,
            operation,
            data,
            timestamp: Date.now(),
            retries: 0
        };
        
        this.pendingOperations.push(op);
        
        // Group by collection
        if (!this.operationQueue.has(collection)) {
            this.operationQueue.set(collection, []);
        }
        this.operationQueue.get(collection).push(op);
        
        this.metrics.totalOperations++;
        this.metrics.pendingCount = this.pendingOperations.length;
        
        this.emit('operationQueued', { operation: op });
    }
    
    /**
     * Force immediate write of all pending operations
     */
    async flush() {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
            this.writeTimer = null;
        }
        
        await this._processPendingWrites();
        
        this.emit('operationsFlushed', {
            operationsWritten: this.metrics.totalOperations,
            batchesWritten: this.metrics.batchesWritten
        });
    }
    
    /**
     * Get performance statistics
     */
    getStats() {
        return {
            ...this.metrics,
            lazyWriteEnabled: this.lazyWriteEnabled,
            options: { ...this.options },
            memoryUsage: this._calculateMemoryUsage(),
            uptime: Date.now() - (this.metrics.startTime || Date.now())
        };
    }
    
    /**
     * Schedule next write operation
     * @private
     */
    _scheduleWrite() {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
        }
        
        this.writeTimer = setTimeout(
            this._processPendingWrites,
            this.options.lazyWriteDelay
        );
    }
    
    /**
     * Process all pending write operations
     * @private
     */
    async _processPendingWrites() {
        if (this.pendingOperations.length === 0) {
            if (this.lazyWriteEnabled) {
                this._scheduleWrite(); // Continue scheduling
            }
            return;
        }
        
        const startTime = Date.now();
        const operations = [...this.pendingOperations];
        this.pendingOperations = [];
        this.operationQueue.clear();
        
        console.log(`📝 Processing ${operations.length} pending operations...`);
        
        try {
            // Group operations by collection for batch processing
            const batches = this._createBatches(operations);
            
            for (const batch of batches) {
                await this._processBatch(batch);
                this.metrics.batchesWritten++;
            }
            
            // Update metrics
            this.metrics.lastWriteTime = Date.now();
            this.metrics.averageBatchSize = Math.round(
                (this.metrics.averageBatchSize * (this.metrics.batchesWritten - batches.length) + 
                 operations.length) / this.metrics.batchesWritten
            );
            this.metrics.pendingCount = 0;
            
            const duration = Date.now() - startTime;
            
            this.emit('writeCompleted', {
                operationsProcessed: operations.length,
                batchesWritten: batches.length,
                duration
            });
            
            console.log(`✅ Wrote ${operations.length} operations in ${duration}ms (${batches.length} batches)`);
            
        } catch (error) {
            console.error('❌ Error processing pending writes:', error);
            
            // Re-queue failed operations with retry limit
            const retriableOps = operations.filter(op => op.retries < 3);
            retriableOps.forEach(op => {
                op.retries++;
                this.pendingOperations.push(op);
            });
            
            this.emit('writeError', { error, retriedOperations: retriableOps.length });
        }
        
        // Schedule next write if lazy mode is still enabled
        if (this.lazyWriteEnabled) {
            this._scheduleWrite();
        }
    }
    
    /**
     * Create batches from operations
     * @private
     */
    _createBatches(operations) {
        const batches = [];
        const batchSize = this.options.batchSize;
        
        // Group by collection first
        const collectionOps = new Map();
        
        for (const op of operations) {
            if (!collectionOps.has(op.collection)) {
                collectionOps.set(op.collection, []);
            }
            collectionOps.get(op.collection).push(op);
        }
        
        // Create batches within each collection
        for (const [collection, ops] of collectionOps) {
            for (let i = 0; i < ops.length; i += batchSize) {
                const batch = {
                    collection,
                    operations: ops.slice(i, i + batchSize),
                    compressed: false
                };
                
                // Compress batch if enabled
                if (this.options.compressionEnabled) {
                    batch.compressed = true;
                    batch.originalSize = JSON.stringify(batch.operations).length;
                    batch.operations = this._compressBatch(batch.operations);
                    batch.compressedSize = JSON.stringify(batch.operations).length;
                    
                    this.metrics.compressionRatio = 
                        (this.metrics.compressionRatio + 
                         (batch.compressedSize / batch.originalSize)) / 2;
                }
                
                batches.push(batch);
            }
        }
        
        return batches;
    }
    
    /**
     * Process a single batch
     * @private
     */
    async _processBatch(batch) {
        const { collection, operations, compressed } = batch;
        
        // Decompress if needed
        const ops = compressed ? this._decompressBatch(operations) : operations;
        
        // Get collection instance
        const collectionInstance = this.database.collections?.get(collection) ||
                                 this.database.collection(collection);
        
        if (!collectionInstance) {
            throw new Error(`Collection '${collection}' not found`);
        }
        
        // Process operations in order
        for (const op of ops) {
            try {
                switch (op.operation) {
                    case 'insert':
                        await this._persistInsert(collectionInstance, op.data);
                        break;
                    case 'update':
                        await this._persistUpdate(collectionInstance, op.data);
                        break;
                    case 'delete':
                        await this._persistDelete(collectionInstance, op.data);
                        break;
                    default:
                        console.warn(`Unknown operation type: ${op.operation}`);
                }
            } catch (error) {
                console.error(`Error processing operation ${op.id}:`, error);
                throw error;
            }
        }
    }
    
    /**
     * Persist insert operation
     * @private
     */
    async _persistInsert(collection, data) {
        if (this.database.storage) {
            await this.database.storage.saveDocument(collection.name, data.document);
        }
    }
    
    /**
     * Persist update operation
     * @private
     */
    async _persistUpdate(collection, data) {
        if (this.database.storage) {
            await this.database.storage.updateDocument(collection.name, data.document);
        }
    }
    
    /**
     * Persist delete operation
     * @private
     */
    async _persistDelete(collection, data) {
        if (this.database.storage) {
            await this.database.storage.removeDocument(collection.name, data.documentId);
        }
    }
    
    /**
     * Simple compression for operation batches
     * @private
     */
    _compressBatch(operations) {
        // Simple deduplication and field extraction
        const compressed = {
            template: null,
            variations: []
        };
        
        if (operations.length > 0) {
            // Use first operation as template
            compressed.template = {
                operation: operations[0].operation,
                collection: operations[0].collection
            };
            
            // Store only variations
            compressed.variations = operations.map(op => ({
                id: op.id,
                data: op.data,
                timestamp: op.timestamp
            }));
        }
        
        return compressed;
    }
    
    /**
     * Decompress operation batch
     * @private
     */
    _decompressBatch(compressed) {
        if (!compressed.template) return [];
        
        return compressed.variations.map(variation => ({
            ...compressed.template,
            ...variation
        }));
    }
    
    /**
     * Calculate memory usage of pending operations
     * @private
     */
    _calculateMemoryUsage() {
        let size = 0;
        
        for (const op of this.pendingOperations) {
            size += JSON.stringify(op).length;
        }
        
        return {
            bytes: size,
            kb: Math.round(size / 1024),
            mb: Math.round(size / (1024 * 1024))
        };
    }
    
    /**
     * Generate unique operation ID
     * @private
     */
    _generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Clean up resources
     */
    async destroy() {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
            this.writeTimer = null;
        }
        
        // Force flush remaining operations
        if (this.pendingOperations.length > 0) {
            await this._processPendingWrites();
        }
        
        this.emit('performanceEngineDestroyed');
    }
}

export default PerformanceEngine;
