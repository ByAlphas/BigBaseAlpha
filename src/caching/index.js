/**
 * Cache Manager for BigBaseAlpha
 * Handles intelligent caching and memory management
 */
export class CacheManager {
  constructor(config) {
    this.config = config;
    this.enabled = config.caching !== false;
    this.maxMemory = this._parseMemorySize(config.maxMemory || '512MB');
    this.maxItems = config.maxCacheItems || 10000;
    this.ttl = config.cacheTtl || 3600000; // 1 hour default TTL
    
    // Cache storage
    this.cache = new Map();
    this.accessTimes = new Map();
    this.expireTimes = new Map();
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      currentItems: 0
    };
    
    // LRU tracking
    this.accessOrder = [];
  }

  async init() {
    if (!this.enabled) {
      return;
    }

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Get item from cache
   */
  get(key) {
    if (!this.enabled) {
      return null;
    }

    // Check if item exists and is not expired
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    const expireTime = this.expireTimes.get(key);
    if (expireTime && Date.now() > expireTime) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    this._updateAccess(key);
    this.stats.hits++;
    
    return this.cache.get(key);
  }

  /**
   * Set item in cache
   */
  set(key, value, ttl = null) {
    if (!this.enabled) {
      return false;
    }

    const itemTtl = ttl || this.ttl;
    const expireTime = itemTtl > 0 ? Date.now() + itemTtl : null;
    
    // Calculate item size
    const itemSize = this._calculateSize(value);
    
    // Check if we need to evict items
    if (this._shouldEvict(itemSize)) {
      this._evictItems(itemSize);
    }

    // Remove existing item if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Add new item
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
    
    if (expireTime) {
      this.expireTimes.set(key, expireTime);
    }

    // Update statistics
    this.stats.currentSize += itemSize;
    this.stats.currentItems++;
    
    // Update access order
    this._updateAccess(key);
    
    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key) {
    if (!this.enabled || !this.cache.has(key)) {
      return false;
    }

    const value = this.cache.get(key);
    const itemSize = this._calculateSize(value);
    
    // Remove from all tracking structures
    this.cache.delete(key);
    this.accessTimes.delete(key);
    this.expireTimes.delete(key);
    
    // Remove from access order
    const orderIndex = this.accessOrder.indexOf(key);
    if (orderIndex !== -1) {
      this.accessOrder.splice(orderIndex, 1);
    }
    
    // Update statistics
    this.stats.currentSize -= itemSize;
    this.stats.currentItems--;
    
    return true;
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    if (!this.enabled) {
      return false;
    }

    if (!this.cache.has(key)) {
      return false;
    }

    // Check expiration
    const expireTime = this.expireTimes.get(key);
    if (expireTime && Date.now() > expireTime) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all items from cache
   */
  clear() {
    if (!this.enabled) {
      return;
    }

    this.cache.clear();
    this.accessTimes.clear();
    this.expireTimes.clear();
    this.accessOrder = [];
    
    this.stats.currentSize = 0;
    this.stats.currentItems = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 ? 
      (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: this._formatMemorySize(this.stats.currentSize),
      maxMemory: this._formatMemorySize(this.maxMemory),
      memoryUtilization: Math.round((this.stats.currentSize / this.maxMemory) * 10000) / 100
    };
  }

  /**
   * Get cached keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Cleanup expired items
   */
  cleanup() {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const expiredKeys = [];

    // Find expired items
    for (const [key, expireTime] of this.expireTimes) {
      if (now > expireTime) {
        expiredKeys.push(key);
      }
    }

    // Remove expired items
    for (const key of expiredKeys) {
      this.delete(key);
    }

    // Perform memory pressure cleanup if needed
    if (this.stats.currentSize > this.maxMemory * 0.8) {
      this._performMemoryCleanup();
    }
  }

  /**
   * Preload data into cache
   */
  async preload(dataProvider) {
    if (!this.enabled || typeof dataProvider !== 'function') {
      return;
    }

    try {
      const data = await dataProvider();
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.key && item.value) {
            this.set(item.key, item.value, item.ttl);
          }
        }
      } else if (typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          this.set(key, value);
        }
      }
    } catch (error) {
      console.error('Cache preload failed:', error);
    }
  }

  /**
   * Batch operations
   */
  mget(keys) {
    if (!this.enabled) {
      return {};
    }

    const results = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        results[key] = value;
      }
    }
    return results;
  }

  mset(items, ttl = null) {
    if (!this.enabled) {
      return false;
    }

    for (const [key, value] of Object.entries(items)) {
      this.set(key, value, ttl);
    }
    return true;
  }

  mdel(keys) {
    if (!this.enabled) {
      return 0;
    }

    let deleted = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clear();
  }

  // Private methods

  _updateAccess(key) {
    // Remove from current position
    const currentIndex = this.accessOrder.indexOf(key);
    if (currentIndex !== -1) {
      this.accessOrder.splice(currentIndex, 1);
    }
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
    this.accessTimes.set(key, Date.now());
  }

  _shouldEvict(newItemSize) {
    return (
      this.stats.currentItems >= this.maxItems ||
      this.stats.currentSize + newItemSize > this.maxMemory
    );
  }

  _evictItems(requiredSpace) {
    let freedSpace = 0;
    let itemsEvicted = 0;
    
    // Evict least recently used items
    while (
      (this.stats.currentSize + requiredSpace > this.maxMemory || 
       this.stats.currentItems >= this.maxItems) &&
      this.accessOrder.length > 0
    ) {
      const lruKey = this.accessOrder[0];
      const lruValue = this.cache.get(lruKey);
      const itemSize = this._calculateSize(lruValue);
      
      this.delete(lruKey);
      
      freedSpace += itemSize;
      itemsEvicted++;
      this.stats.evictions++;
    }
    
    return { freedSpace, itemsEvicted };
  }

  _performMemoryCleanup() {
    // More aggressive cleanup when memory pressure is high
    const targetSize = this.maxMemory * 0.7; // Target 70% of max memory
    
    while (this.stats.currentSize > targetSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.delete(lruKey);
      this.stats.evictions++;
    }
  }

  _calculateSize(value) {
    if (value === null || value === undefined) {
      return 8; // Approximate size for null/undefined
    }
    
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 characters
    }
    
    if (typeof value === 'number') {
      return 8; // 64-bit number
    }
    
    if (typeof value === 'boolean') {
      return 4; // Boolean
    }
    
    if (value instanceof Date) {
      return 24; // Date object
    }
    
    if (Buffer.isBuffer(value)) {
      return value.length;
    }
    
    // For objects and arrays, approximate by JSON size
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024; // Default size for non-serializable objects
    }
  }

  _parseMemorySize(sizeStr) {
    if (typeof sizeStr === 'number') {
      return sizeStr;
    }
    
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.toString().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
    if (!match) {
      return 512 * 1024 * 1024; // Default 512MB
    }
    
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    
    return Math.floor(value * (units[unit] || 1));
  }

  _formatMemorySize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 100) / 100}${units[unitIndex]}`;
  }
}

export default CacheManager;
