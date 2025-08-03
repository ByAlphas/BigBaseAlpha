import { EventEmitter } from 'events';
import QueryEngine from '../query/index.js';

/**
 * BigBaseAlpha Collection System
 * MongoDB-style collection and document management
 */
class CollectionManager extends EventEmitter {
    constructor(database, options = {}) {
        super();
        
        this.database = database;
        this.options = {
            maxCollections: 1000,
            autoCreateCollections: true,
            strictMode: false,
            ...options
        };
        
        // Collection registry
        this.collections = new Map();
        this.collectionMetadata = new Map();
        
        // Query engine integration
        this.queryEngine = new QueryEngine(this);
        
        // Performance tracking
        this.stats = {
            totalOperations: 0,
            collectionCount: 0,
            documentCount: 0,
            lastOperation: null
        };
        
        this.emit('collectionManagerInitialized');
    }
    
    /**
     * Get or create a collection
     * @param {string} name - Collection name
     * @param {Object} options - Collection options
     * @returns {Collection} Collection instance
     */
    collection(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Collection name must be a non-empty string');
        }
        
        // Return existing collection
        if (this.collections.has(name)) {
            return this.collections.get(name);
        }
        
        // Check collection limit
        if (this.collections.size >= this.options.maxCollections) {
            throw new Error(`Maximum collection limit reached: ${this.options.maxCollections}`);
        }
        
        // Create new collection
        const collection = new Collection(name, this, options);
        this.collections.set(name, collection);
        
        // Update metadata
        this.collectionMetadata.set(name, {
            created: new Date(),
            options,
            documentCount: 0,
            lastModified: new Date()
        });
        
        this.stats.collectionCount++;
        this.emit('collectionCreated', { name, collection });
        
        return collection;
    }
    
    /**
     * List all collections
     * @returns {Array} Collection names
     */
    listCollections() {
        return Array.from(this.collections.keys());
    }
    
    /**
     * Drop a collection
     * @param {string} name - Collection name
     * @returns {boolean} Success status
     */
    async dropCollection(name) {
        if (!this.collections.has(name)) {
            return false;
        }
        
        const collection = this.collections.get(name);
        await collection.drop();
        
        this.collections.delete(name);
        this.collectionMetadata.delete(name);
        this.stats.collectionCount--;
        
        this.emit('collectionDropped', { name });
        return true;
    }
    
    /**
     * Get collection statistics
     * @param {string} name - Collection name
     * @returns {Object} Collection stats
     */
    getCollectionStats(name) {
        if (!this.collections.has(name)) {
            throw new Error(`Collection '${name}' does not exist`);
        }
        
        const collection = this.collections.get(name);
        const metadata = this.collectionMetadata.get(name);
        
        return {
            name,
            documentCount: collection.documents.size,
            created: metadata.created,
            lastModified: metadata.lastModified,
            options: metadata.options,
            indexes: collection.indexes.size,
            memoryUsage: this._calculateMemoryUsage(collection)
        };
    }
    
    /**
     * Get overall statistics
     * @returns {Object} Manager stats
     */
    getStats() {
        return {
            ...this.stats,
            collections: this.listCollections().map(name => this.getCollectionStats(name))
        };
    }
    
    /**
     * Calculate memory usage for a collection
     * @private
     */
    _calculateMemoryUsage(collection) {
        let size = 0;
        for (const doc of collection.documents.values()) {
            size += JSON.stringify(doc).length;
        }
        return size;
    }
}

/**
 * Collection class - represents a single collection
 */
class Collection extends EventEmitter {
    constructor(name, manager, options = {}) {
        super();
        
        this.name = name;
        this.manager = manager;
        this.database = manager.database;
        this.options = {
            autoIndex: true,
            strictSchema: false,
            maxDocuments: 100000,
            ...options
        };
        
        // Document storage
        this.documents = new Map();
        this.indexes = new Map();
        this.nextId = 1;
        
        // Schema validation
        this.schema = null;
        
        this.emit('collectionInitialized', { name });
    }
    
    /**
     * Insert a document
     * @param {Object|Array} doc - Document(s) to insert
     * @param {Object} options - Insert options
     * @returns {Object|Array} Inserted document(s) with _id
     */
    async insert(doc, options = {}) {
        if (Array.isArray(doc)) {
            return Promise.all(doc.map(d => this.insertOne(d, options)));
        }
        return this.insertOne(doc, options);
    }
    
    /**
     * Insert a single document
     * @private
     */
    async insertOne(doc, options = {}) {
        if (!doc || typeof doc !== 'object') {
            throw new Error('Document must be an object');
        }
        
        // Check document limit
        if (this.documents.size >= this.options.maxDocuments) {
            throw new Error(`Maximum document limit reached: ${this.options.maxDocuments}`);
        }
        
        // Generate ID if not provided
        if (!doc._id) {
            doc._id = this._generateId();
        }
        
        // Validate against schema
        if (this.schema && !this._validateSchema(doc)) {
            throw new Error('Document does not match collection schema');
        }
        
        // Clone document to prevent mutations
        const insertedDoc = { ...doc };
        insertedDoc._createdAt = new Date();
        insertedDoc._updatedAt = new Date();
        
        // Store document
        this.documents.set(insertedDoc._id, insertedDoc);
        
        // Update indexes
        if (this.options.autoIndex) {
            this._updateIndexes(insertedDoc, 'insert');
        }
        
        // Update stats
        this.manager.stats.totalOperations++;
        this.manager.stats.documentCount++;
        this.manager.stats.lastOperation = 'insert';
        
        // Update collection metadata
        const metadata = this.manager.collectionMetadata.get(this.name);
        metadata.documentCount++;
        metadata.lastModified = new Date();
        
        this.emit('documentInserted', { document: insertedDoc });
        
        // Persist to storage if not in lazy mode
        if (!this.database.lazyWrite) {
            await this._persistDocument(insertedDoc);
        }
        
        return insertedDoc;
    }
    
    /**
     * Find documents with MongoDB-style queries
     * @param {Object} query - Query filter
     * @param {Object} options - Query options
     * @returns {Array} Matching documents
     */
    find(query = {}, options = {}) {
        return this.manager.queryEngine.find(this.name, query, options);
    }
    
    /**
     * Find one document
     * @param {Object} query - Query filter
     * @param {Object} options - Query options
     * @returns {Object|null} First matching document
     */
    findOne(query = {}, options = {}) {
        const results = this.find(query, { ...options, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }
    
    /**
     * Update documents
     * @param {Object} query - Query filter
     * @param {Object} update - Update operations
     * @param {Object} options - Update options
     * @returns {Object} Update result
     */
    async update(query, update, options = {}) {
        const documents = this.find(query);
        let modifiedCount = 0;
        const modifiedDocuments = [];
        
        for (const doc of documents) {
            const updatedDoc = this._applyUpdate(doc, update);
            if (updatedDoc !== doc) {
                updatedDoc._updatedAt = new Date();
                this.documents.set(doc._id, updatedDoc);
                modifiedDocuments.push(updatedDoc);
                modifiedCount++;
                
                // Update indexes
                if (this.options.autoIndex) {
                    this._updateIndexes(updatedDoc, 'update', doc);
                }
                
                // Persist if not in lazy mode
                if (!this.database.lazyWrite) {
                    await this._persistDocument(updatedDoc);
                }
            }
            
            if (options.limit && modifiedCount >= options.limit) {
                break;
            }
        }
        
        // Update stats
        this.manager.stats.totalOperations++;
        this.manager.stats.lastOperation = 'update';
        
        this.emit('documentsUpdated', { count: modifiedCount, documents: modifiedDocuments });
        
        return {
            matchedCount: documents.length,
            modifiedCount,
            modifiedDocuments: options.returnModified ? modifiedDocuments : undefined
        };
    }
    
    /**
     * Delete documents
     * @param {Object} query - Query filter
     * @param {Object} options - Delete options
     * @returns {Object} Delete result
     */
    async delete(query = {}, options = {}) {
        const documents = this.find(query);
        let deletedCount = 0;
        const deletedDocuments = [];
        
        for (const doc of documents) {
            this.documents.delete(doc._id);
            deletedDocuments.push(doc);
            deletedCount++;
            
            // Update indexes
            if (this.options.autoIndex) {
                this._updateIndexes(doc, 'delete');
            }
            
            // Remove from storage if not in lazy mode
            if (!this.database.lazyWrite) {
                await this._removeFromStorage(doc._id);
            }
            
            if (options.limit && deletedCount >= options.limit) {
                break;
            }
        }
        
        // Update stats
        this.manager.stats.totalOperations++;
        this.manager.stats.documentCount -= deletedCount;
        this.manager.stats.lastOperation = 'delete';
        
        // Update collection metadata
        const metadata = this.manager.collectionMetadata.get(this.name);
        metadata.documentCount -= deletedCount;
        metadata.lastModified = new Date();
        
        this.emit('documentsDeleted', { count: deletedCount, documents: deletedDocuments });
        
        return {
            deletedCount,
            deletedDocuments: options.returnDeleted ? deletedDocuments : undefined
        };
    }
    
    /**
     * Count documents
     * @param {Object} query - Query filter
     * @returns {number} Document count
     */
    count(query = {}) {
        return this.find(query).length;
    }
    
    /**
     * Create an index
     * @param {Object} keys - Index specification
     * @param {Object} options - Index options
     */
    createIndex(keys, options = {}) {
        const indexName = options.name || this._generateIndexName(keys);
        
        if (this.indexes.has(indexName)) {
            throw new Error(`Index '${indexName}' already exists`);
        }
        
        const index = new Map();
        
        // Build index from existing documents
        for (const doc of this.documents.values()) {
            const indexKey = this._extractIndexKey(doc, keys);
            if (indexKey !== undefined) {
                if (!index.has(indexKey)) {
                    index.set(indexKey, new Set());
                }
                index.get(indexKey).add(doc._id);
            }
        }
        
        this.indexes.set(indexName, {
            keys,
            options,
            index,
            created: new Date()
        });
        
        this.emit('indexCreated', { name: indexName, keys });
    }
    
    /**
     * Drop an index
     * @param {string} indexName - Index name
     */
    dropIndex(indexName) {
        if (!this.indexes.has(indexName)) {
            throw new Error(`Index '${indexName}' does not exist`);
        }
        
        this.indexes.delete(indexName);
        this.emit('indexDropped', { name: indexName });
    }
    
    /**
     * Drop the entire collection
     */
    async drop() {
        this.documents.clear();
        this.indexes.clear();
        
        // Remove from storage
        await this._removeCollectionFromStorage();
        
        this.emit('collectionDropped', { name: this.name });
    }
    
    /**
     * Generate a new document ID
     * @private
     */
    _generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Apply update operations to a document
     * @private
     */
    _applyUpdate(doc, update) {
        const newDoc = { ...doc };
        
        for (const [operator, operations] of Object.entries(update)) {
            switch (operator) {
                case '$set':
                    Object.assign(newDoc, operations);
                    break;
                case '$unset':
                    for (const field of Object.keys(operations)) {
                        delete newDoc[field];
                    }
                    break;
                case '$inc':
                    for (const [field, value] of Object.entries(operations)) {
                        newDoc[field] = (newDoc[field] || 0) + value;
                    }
                    break;
                case '$push':
                    for (const [field, value] of Object.entries(operations)) {
                        if (!Array.isArray(newDoc[field])) {
                            newDoc[field] = [];
                        }
                        newDoc[field].push(value);
                    }
                    break;
                case '$pull':
                    for (const [field, value] of Object.entries(operations)) {
                        if (Array.isArray(newDoc[field])) {
                            newDoc[field] = newDoc[field].filter(item => item !== value);
                        }
                    }
                    break;
                default:
                    // Direct field assignment (no operator)
                    if (!operator.startsWith('$')) {
                        newDoc[operator] = operations;
                    }
            }
        }
        
        return newDoc;
    }
    
    /**
     * Update indexes for a document operation
     * @private
     */
    _updateIndexes(doc, operation, oldDoc = null) {
        for (const [indexName, indexData] of this.indexes) {
            const { keys, index } = indexData;
            
            if (operation === 'insert') {
                const indexKey = this._extractIndexKey(doc, keys);
                if (indexKey !== undefined) {
                    if (!index.has(indexKey)) {
                        index.set(indexKey, new Set());
                    }
                    index.get(indexKey).add(doc._id);
                }
            } else if (operation === 'update' && oldDoc) {
                // Remove old index entry
                const oldIndexKey = this._extractIndexKey(oldDoc, keys);
                if (oldIndexKey !== undefined && index.has(oldIndexKey)) {
                    index.get(oldIndexKey).delete(doc._id);
                    if (index.get(oldIndexKey).size === 0) {
                        index.delete(oldIndexKey);
                    }
                }
                
                // Add new index entry
                const newIndexKey = this._extractIndexKey(doc, keys);
                if (newIndexKey !== undefined) {
                    if (!index.has(newIndexKey)) {
                        index.set(newIndexKey, new Set());
                    }
                    index.get(newIndexKey).add(doc._id);
                }
            } else if (operation === 'delete') {
                const indexKey = this._extractIndexKey(doc, keys);
                if (indexKey !== undefined && index.has(indexKey)) {
                    index.get(indexKey).delete(doc._id);
                    if (index.get(indexKey).size === 0) {
                        index.delete(indexKey);
                    }
                }
            }
        }
    }
    
    /**
     * Extract index key from document
     * @private
     */
    _extractIndexKey(doc, keys) {
        if (typeof keys === 'string') {
            return doc[keys];
        } else if (typeof keys === 'object') {
            const keyParts = [];
            for (const field of Object.keys(keys)) {
                keyParts.push(doc[field]);
            }
            return keyParts.join('|');
        }
        return undefined;
    }
    
    /**
     * Generate index name
     * @private
     */
    _generateIndexName(keys) {
        if (typeof keys === 'string') {
            return `${keys}_1`;
        } else if (typeof keys === 'object') {
            return Object.keys(keys).map(k => `${k}_${keys[k]}`).join('_');
        }
        return 'index_' + Date.now();
    }
    
    /**
     * Validate document against schema
     * @private
     */
    _validateSchema(doc) {
        if (!this.schema) return true;
        // Schema validation logic would go here
        return true;
    }
    
    /**
     * Persist document to storage
     * @private
     */
    async _persistDocument(doc) {
        // Integration with database storage
        if (this.database && this.database.storage) {
            await this.database.storage.saveDocument(this.name, doc);
        }
    }
    
    /**
     * Remove document from storage
     * @private
     */
    async _removeFromStorage(docId) {
        if (this.database && this.database.storage) {
            await this.database.storage.removeDocument(this.name, docId);
        }
    }
    
    /**
     * Remove entire collection from storage
     * @private
     */
    async _removeCollectionFromStorage() {
        if (this.database && this.database.storage) {
            await this.database.storage.removeCollection(this.name);
        }
    }
}

export default CollectionManager;
export { Collection };
