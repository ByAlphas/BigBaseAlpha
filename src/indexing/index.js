import { promises as fs, existsSync } from 'fs';
import { join } from 'path';

/**
 * Index Manager for BigBaseAlpha
 * Handles indexing for fast data retrieval
 */
export class IndexManager {
  constructor(config) {
    this.config = config;
    this.enabled = config.indexing !== false;
    this.basePath = config.path;
    this.indexes = new Map(); // Collection -> Field -> Index
    this.indexPath = join(this.basePath, 'indexes');
  }

  async init() {
    if (!this.enabled) {
      return;
    }

    // Create indexes directory
    if (!existsSync(this.indexPath)) {
      await fs.mkdir(this.indexPath, { recursive: true });
    }

    // Load existing indexes
    await this._loadIndexes();
  }

  /**
   * Create indexes for a collection based on schema
   */
  async createIndexes(collectionName, schema) {
    if (!this.enabled || !schema) {
      return;
    }

    const collectionIndexes = new Map();
    
    // Create indexes for specified fields
    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      if (fieldConfig.index || fieldConfig.unique) {
        const indexType = fieldConfig.unique ? 'unique' : 'standard';
        const index = new FieldIndex(fieldName, indexType);
        collectionIndexes.set(fieldName, index);
        
        await this._saveIndex(collectionName, fieldName, index);
      }
    }

    // Always create an index for _id field
    const idIndex = new FieldIndex('_id', 'unique');
    collectionIndexes.set('_id', idIndex);
    await this._saveIndex(collectionName, '_id', idIndex);

    this.indexes.set(collectionName, collectionIndexes);
  }

  /**
   * Add document to relevant indexes
   */
  async addToIndex(collectionName, document) {
    if (!this.enabled) {
      return;
    }

    const collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes) {
      return;
    }

    for (const [fieldName, index] of collectionIndexes) {
      const fieldValue = this._getFieldValue(document, fieldName);
      if (fieldValue !== undefined) {
        index.add(fieldValue, document._id);
        await this._saveIndex(collectionName, fieldName, index);
      }
    }
  }

  /**
   * Remove document from indexes
   */
  async removeFromIndex(collectionName, document) {
    if (!this.enabled) {
      return;
    }

    const collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes) {
      return;
    }

    for (const [fieldName, index] of collectionIndexes) {
      const fieldValue = this._getFieldValue(document, fieldName);
      if (fieldValue !== undefined) {
        index.remove(fieldValue, document._id);
        await this._saveIndex(collectionName, fieldName, index);
      }
    }
  }

  /**
   * Update indexes when document is modified
   */
  async updateIndex(collectionName, oldDocument, newDocument) {
    if (!this.enabled) {
      return;
    }

    // Remove old values and add new values
    await this.removeFromIndex(collectionName, oldDocument);
    await this.addToIndex(collectionName, newDocument);
  }

  /**
   * Query using indexes
   */
  async query(collectionName, whereClause) {
    if (!this.enabled) {
      return [];
    }

    const collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes) {
      return [];
    }

    // Find the best index to use
    const indexQuery = this._planIndexQuery(whereClause, collectionIndexes);
    if (!indexQuery) {
      return [];
    }

    const { fieldName, operation, value } = indexQuery;
    const index = collectionIndexes.get(fieldName);
    
    if (!index) {
      return [];
    }

    return this._executeIndexQuery(index, operation, value);
  }

  /**
   * Get index statistics
   */
  getIndexStats(collectionName) {
    if (!this.enabled) {
      return {};
    }

    const collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes) {
      return {};
    }

    const stats = {};
    for (const [fieldName, index] of collectionIndexes) {
      stats[fieldName] = {
        type: index.type,
        size: index.size(),
        uniqueValues: index.getUniqueValueCount()
      };
    }

    return stats;
  }

  /**
   * Rebuild all indexes for a collection
   */
  async rebuildIndexes(collectionName, documents) {
    if (!this.enabled) {
      return;
    }

    const collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes) {
      return;
    }

    // Clear existing indexes
    for (const [fieldName, index] of collectionIndexes) {
      index.clear();
    }

    // Rebuild with all documents
    for (const document of documents) {
      await this.addToIndex(collectionName, document);
    }
  }

  /**
   * Create a custom index
   */
  async createCustomIndex(collectionName, fieldName, indexType = 'standard') {
    if (!this.enabled) {
      return;
    }

    let collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes) {
      collectionIndexes = new Map();
      this.indexes.set(collectionName, collectionIndexes);
    }

    const index = new FieldIndex(fieldName, indexType);
    collectionIndexes.set(fieldName, index);
    
    await this._saveIndex(collectionName, fieldName, index);
    return index;
  }

  /**
   * Drop an index
   */
  async dropIndex(collectionName, fieldName) {
    if (!this.enabled) {
      return;
    }

    const collectionIndexes = this.indexes.get(collectionName);
    if (!collectionIndexes || !collectionIndexes.has(fieldName)) {
      return false;
    }

    collectionIndexes.delete(fieldName);
    
    // Remove index file
    const indexFilePath = this._getIndexFilePath(collectionName, fieldName);
    if (existsSync(indexFilePath)) {
      await fs.unlink(indexFilePath);
    }

    return true;
  }

  async close() {
    if (!this.enabled) {
      return;
    }

    // Save all indexes before closing
    for (const [collectionName, collectionIndexes] of this.indexes) {
      for (const [fieldName, index] of collectionIndexes) {
        await this._saveIndex(collectionName, fieldName, index);
      }
    }

    this.indexes.clear();
  }

  // Private methods

  async _loadIndexes() {
    if (!existsSync(this.indexPath)) {
      return;
    }

    try {
      const collections = await fs.readdir(this.indexPath, { withFileTypes: true });
      
      for (const collection of collections) {
        if (!collection.isDirectory()) continue;
        
        const collectionName = collection.name;
        const collectionIndexes = new Map();
        
        const collectionIndexPath = join(this.indexPath, collectionName);
        const indexFiles = await fs.readdir(collectionIndexPath);
        
        for (const indexFile of indexFiles) {
          if (!indexFile.endsWith('.idx')) continue;
          
          const fieldName = indexFile.replace('.idx', '');
          const index = await this._loadIndex(collectionName, fieldName);
          
          if (index) {
            collectionIndexes.set(fieldName, index);
          }
        }
        
        this.indexes.set(collectionName, collectionIndexes);
      }
    } catch (error) {
      console.error('Error loading indexes:', error);
    }
  }

  async _loadIndex(collectionName, fieldName) {
    const indexFilePath = this._getIndexFilePath(collectionName, fieldName);
    
    if (!existsSync(indexFilePath)) {
      return null;
    }

    try {
      const indexData = await fs.readFile(indexFilePath, 'utf8');
      const parsed = JSON.parse(indexData);
      
      const index = new FieldIndex(fieldName, parsed.type);
      index.fromJSON(parsed);
      
      return index;
    } catch (error) {
      console.error(`Error loading index ${collectionName}.${fieldName}:`, error);
      return null;
    }
  }

  async _saveIndex(collectionName, fieldName, index) {
    const collectionIndexPath = join(this.indexPath, collectionName);
    
    if (!existsSync(collectionIndexPath)) {
      await fs.mkdir(collectionIndexPath, { recursive: true });
    }

    const indexFilePath = this._getIndexFilePath(collectionName, fieldName);
    const indexData = JSON.stringify(index.toJSON(), null, 2);
    
    await fs.writeFile(indexFilePath, indexData);
  }

  _getIndexFilePath(collectionName, fieldName) {
    return join(this.indexPath, collectionName, `${fieldName}.idx`);
  }

  _getFieldValue(document, fieldPath) {
    // Support nested field paths like 'user.profile.name'
    const parts = fieldPath.split('.');
    let value = document;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  _planIndexQuery(whereClause, indexes) {
    // Find the best index for the query
    for (const [fieldName, condition] of Object.entries(whereClause)) {
      if (indexes.has(fieldName)) {
        if (typeof condition === 'object' && condition !== null) {
          // Handle operators
          for (const [operator, value] of Object.entries(condition)) {
            return {
              fieldName,
              operation: operator,
              value
            };
          }
        } else {
          // Direct equality
          return {
            fieldName,
            operation: '$eq',
            value: condition
          };
        }
      }
    }
    
    return null;
  }

  _executeIndexQuery(index, operation, value) {
    switch (operation) {
      case '$eq':
        return index.find(value);
      case '$gt':
        return index.findRange(value, null, false, true);
      case '$gte':
        return index.findRange(value, null, true, true);
      case '$lt':
        return index.findRange(null, value, true, false);
      case '$lte':
        return index.findRange(null, value, true, true);
      case '$in':
        if (Array.isArray(value)) {
          const results = [];
          for (const v of value) {
            results.push(...index.find(v));
          }
          return [...new Set(results)]; // Remove duplicates
        }
        return [];
      default:
        return [];
    }
  }
}

/**
 * Field Index implementation
 */
class FieldIndex {
  constructor(fieldName, type = 'standard') {
    this.fieldName = fieldName;
    this.type = type; // 'standard', 'unique'
    this.data = new Map(); // value -> Set of document IDs
    this.sortedKeys = []; // For range queries
    this.sorted = false;
  }

  add(value, documentId) {
    const key = this._normalizeValue(value);
    
    if (this.type === 'unique' && this.data.has(key)) {
      const existingIds = this.data.get(key);
      if (existingIds.size > 0 && !existingIds.has(documentId)) {
        throw new Error(`Unique constraint violation: duplicate value '${value}' for field '${this.fieldName}'`);
      }
    }

    if (!this.data.has(key)) {
      this.data.set(key, new Set());
      this.sorted = false;
    }

    this.data.get(key).add(documentId);
  }

  remove(value, documentId) {
    const key = this._normalizeValue(value);
    
    if (this.data.has(key)) {
      const ids = this.data.get(key);
      ids.delete(documentId);
      
      if (ids.size === 0) {
        this.data.delete(key);
        this.sorted = false;
      }
    }
  }

  find(value) {
    const key = this._normalizeValue(value);
    const ids = this.data.get(key);
    return ids ? Array.from(ids) : [];
  }

  findRange(minValue, maxValue, includeMin = true, includeMax = true) {
    this._ensureSorted();
    
    const results = [];
    
    for (const key of this.sortedKeys) {
      const keyValue = this._denormalizeValue(key);
      
      // Check min bound
      if (minValue !== null) {
        if (includeMin ? keyValue < minValue : keyValue <= minValue) {
          continue;
        }
      }
      
      // Check max bound
      if (maxValue !== null) {
        if (includeMax ? keyValue > maxValue : keyValue >= maxValue) {
          break;
        }
      }
      
      const ids = this.data.get(key);
      if (ids) {
        results.push(...Array.from(ids));
      }
    }
    
    return results;
  }

  clear() {
    this.data.clear();
    this.sortedKeys = [];
    this.sorted = false;
  }

  size() {
    return this.data.size;
  }

  getUniqueValueCount() {
    return this.data.size;
  }

  toJSON() {
    const dataObj = {};
    for (const [key, ids] of this.data) {
      dataObj[key] = Array.from(ids);
    }
    
    return {
      fieldName: this.fieldName,
      type: this.type,
      data: dataObj
    };
  }

  fromJSON(json) {
    this.fieldName = json.fieldName;
    this.type = json.type;
    this.data.clear();
    
    for (const [key, ids] of Object.entries(json.data)) {
      this.data.set(key, new Set(ids));
    }
    
    this.sorted = false;
  }

  _normalizeValue(value) {
    if (value === null || value === undefined) {
      return '__NULL__';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number') {
      return `__NUM__${value}`;
    }
    
    if (typeof value === 'boolean') {
      return `__BOOL__${value}`;
    }
    
    if (value instanceof Date) {
      return `__DATE__${value.toISOString()}`;
    }
    
    // For complex objects, use JSON representation
    return `__OBJ__${JSON.stringify(value)}`;
  }

  _denormalizeValue(key) {
    if (key === '__NULL__') {
      return null;
    }
    
    if (key.startsWith('__NUM__')) {
      return parseFloat(key.substring(7));
    }
    
    if (key.startsWith('__BOOL__')) {
      return key.substring(8) === 'true';
    }
    
    if (key.startsWith('__DATE__')) {
      return new Date(key.substring(8));
    }
    
    if (key.startsWith('__OBJ__')) {
      return JSON.parse(key.substring(7));
    }
    
    return key;
  }

  _ensureSorted() {
    if (!this.sorted) {
      this.sortedKeys = Array.from(this.data.keys()).sort((a, b) => {
        const aVal = this._denormalizeValue(a);
        const bVal = this._denormalizeValue(b);
        
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
      this.sorted = true;
    }
  }
}

export default IndexManager;
