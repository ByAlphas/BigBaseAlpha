/**
 * BigBaseAlpha Query Engine
 * MongoDB-style query processing and filtering
 */
class QueryEngine {
    constructor(collectionManager) {
        this.collectionManager = collectionManager;
        
        // Supported operators
        this.operators = {
            // Comparison operators
            '$eq': (field, value) => field === value,
            '$ne': (field, value) => field !== value,
            '$gt': (field, value) => field > value,
            '$gte': (field, value) => field >= value,
            '$lt': (field, value) => field < value,
            '$lte': (field, value) => field <= value,
            '$in': (field, value) => Array.isArray(value) && value.includes(field),
            '$nin': (field, value) => Array.isArray(value) && !value.includes(field),
            
            // Logical operators
            '$and': (conditions, doc) => conditions.every(cond => this._matchDocument(doc, cond)),
            '$or': (conditions, doc) => conditions.some(cond => this._matchDocument(doc, cond)),
            '$not': (condition, doc) => !this._matchDocument(doc, condition),
            '$nor': (conditions, doc) => !conditions.some(cond => this._matchDocument(doc, cond)),
            
            // Element operators
            '$exists': (field, value) => value ? field !== undefined : field === undefined,
            '$type': (field, value) => this._getType(field) === value,
            
            // String operators
            '$regex': (field, value) => {
                if (typeof field !== 'string') return false;
                const regex = new RegExp(value);
                return regex.test(field);
            },
            
            // Array operators
            '$all': (field, value) => {
                if (!Array.isArray(field) || !Array.isArray(value)) return false;
                return value.every(item => field.includes(item));
            },
            '$elemMatch': (field, value) => {
                if (!Array.isArray(field)) return false;
                return field.some(item => this._matchDocument(item, value));
            },
            '$size': (field, value) => Array.isArray(field) && field.length === value
        };
    }
    
    /**
     * Find documents matching query
     * @param {string} collectionName - Collection name
     * @param {Object} query - Query filter
     * @param {Object} options - Query options
     * @returns {Array} Matching documents
     */
    find(collectionName, query = {}, options = {}) {
        const collection = this.collectionManager.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' does not exist`);
        }
        
        let results = [];
        
        // Use index if available and beneficial
        const indexedResults = this._tryIndexLookup(collection, query);
        if (indexedResults) {
            results = indexedResults;
        } else {
            // Full collection scan
            for (const doc of collection.documents.values()) {
                if (this._matchDocument(doc, query)) {
                    results.push(doc);
                }
            }
        }
        
        // Apply sorting
        if (options.sort) {
            results = this._sortResults(results, options.sort);
        }
        
        // Apply skip
        if (options.skip && options.skip > 0) {
            results = results.slice(options.skip);
        }
        
        // Apply limit
        if (options.limit && options.limit > 0) {
            results = results.slice(0, options.limit);
        }
        
        // Apply projection
        if (options.projection) {
            results = results.map(doc => this._projectDocument(doc, options.projection));
        }
        
        return results;
    }
    
    /**
     * Check if document matches query
     * @private
     */
    _matchDocument(doc, query) {
        if (!query || Object.keys(query).length === 0) {
            return true; // Empty query matches all
        }
        
        for (const [field, condition] of Object.entries(query)) {
            if (!this._matchField(doc, field, condition)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check if field matches condition
     * @private
     */
    _matchField(doc, field, condition) {
        // Handle logical operators at root level
        if (field.startsWith('$')) {
            const operator = this.operators[field];
            if (!operator) {
                throw new Error(`Unsupported operator: ${field}`);
            }
            
            if (['$and', '$or', '$nor'].includes(field)) {
                return operator(condition, doc);
            } else if (field === '$not') {
                return operator(condition, doc);
            }
        }
        
        const fieldValue = this._getFieldValue(doc, field);
        
        // Direct value comparison
        if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
            return this.operators['$eq'](fieldValue, condition);
        }
        
        // Operator-based conditions
        for (const [operator, operatorValue] of Object.entries(condition)) {
            const operatorFn = this.operators[operator];
            if (!operatorFn) {
                throw new Error(`Unsupported operator: ${operator}`);
            }
            
            if (!operatorFn(fieldValue, operatorValue)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get field value from document (supports nested fields)
     * @private
     */
    _getFieldValue(doc, field) {
        if (field.includes('.')) {
            // Handle nested fields
            const parts = field.split('.');
            let value = doc;
            
            for (const part of parts) {
                if (value === null || value === undefined) {
                    return undefined;
                }
                value = value[part];
            }
            
            return value;
        }
        
        return doc[field];
    }
    
    /**
     * Try to use indexes for query optimization
     * @private
     */
    _tryIndexLookup(collection, query) {
        // Simple implementation for single-field indexes
        for (const [indexName, indexData] of collection.indexes) {
            const { keys, index } = indexData;
            
            // Check if query can use this index
            if (typeof keys === 'string' && query[keys] !== undefined) {
                const queryValue = query[keys];
                
                // For exact matches
                if (typeof queryValue !== 'object' || queryValue === null) {
                    const documentIds = index.get(queryValue);
                    if (documentIds) {
                        return Array.from(documentIds).map(id => collection.documents.get(id));
                    }
                }
                
                // For range queries ($gt, $lt, etc.)
                if (typeof queryValue === 'object') {
                    const results = [];
                    
                    for (const [indexKey, documentIds] of index) {
                        let matches = true;
                        
                        for (const [operator, value] of Object.entries(queryValue)) {
                            const operatorFn = this.operators[operator];
                            if (operatorFn && !operatorFn(indexKey, value)) {
                                matches = false;
                                break;
                            }
                        }
                        
                        if (matches) {
                            for (const docId of documentIds) {
                                results.push(collection.documents.get(docId));
                            }
                        }
                    }
                    
                    return results;
                }
            }
        }
        
        return null; // No suitable index found
    }
    
    /**
     * Sort results
     * @private
     */
    _sortResults(results, sortSpec) {
        return results.sort((a, b) => {
            for (const [field, direction] of Object.entries(sortSpec)) {
                const aValue = this._getFieldValue(a, field);
                const bValue = this._getFieldValue(b, field);
                
                let comparison = 0;
                
                if (aValue < bValue) comparison = -1;
                else if (aValue > bValue) comparison = 1;
                
                if (comparison !== 0) {
                    return direction === -1 ? -comparison : comparison;
                }
            }
            
            return 0;
        });
    }
    
    /**
     * Project document fields
     * @private
     */
    _projectDocument(doc, projection) {
        const result = {};
        const isInclusive = Object.values(projection).some(val => val === 1);
        
        if (isInclusive) {
            // Include specified fields
            for (const [field, include] of Object.entries(projection)) {
                if (include === 1) {
                    result[field] = this._getFieldValue(doc, field);
                }
            }
            
            // Always include _id unless explicitly excluded
            if (projection._id !== 0) {
                result._id = doc._id;
            }
        } else {
            // Exclude specified fields
            Object.assign(result, doc);
            
            for (const [field, exclude] of Object.entries(projection)) {
                if (exclude === 0) {
                    delete result[field];
                }
            }
        }
        
        return result;
    }
    
    /**
     * Get JavaScript type of value
     * @private
     */
    _getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        if (value instanceof RegExp) return 'regex';
        return typeof value;
    }
    
    /**
     * Create query execution plan (for debugging/optimization)
     * @param {string} collectionName - Collection name
     * @param {Object} query - Query filter
     * @param {Object} options - Query options
     * @returns {Object} Execution plan
     */
    explain(collectionName, query = {}, options = {}) {
        const collection = this.collectionManager.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' does not exist`);
        }
        
        const plan = {
            query,
            options,
            collection: collectionName,
            totalDocuments: collection.documents.size,
            executionStats: {
                indexUsed: false,
                indexName: null,
                documentsExamined: 0,
                documentsReturned: 0,
                executionTimeMs: 0
            }
        };
        
        // Check for index usage
        const indexUsage = this._analyzeIndexUsage(collection, query);
        if (indexUsage.canUseIndex) {
            plan.executionStats.indexUsed = true;
            plan.executionStats.indexName = indexUsage.indexName;
            plan.executionStats.documentsExamined = indexUsage.estimatedDocuments;
        } else {
            plan.executionStats.documentsExamined = collection.documents.size;
        }
        
        return plan;
    }
    
    /**
     * Analyze potential index usage
     * @private
     */
    _analyzeIndexUsage(collection, query) {
        for (const [indexName, indexData] of collection.indexes) {
            const { keys } = indexData;
            
            if (typeof keys === 'string' && query[keys] !== undefined) {
                return {
                    canUseIndex: true,
                    indexName,
                    estimatedDocuments: Math.floor(collection.documents.size / 10) // Rough estimate
                };
            }
        }
        
        return { canUseIndex: false };
    }
}

export default QueryEngine;
