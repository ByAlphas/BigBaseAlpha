import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Redis-like Cache Layer for BigBaseAlpha
 * High-performance in-memory caching with Redis-compatible operations
 */
export class RedisLikeCache extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Logger setup (fallback to default if not provided)
    this.logger = config.logger || {
      info: (...args) => console.log('[INFO] [REDIS]', ...args),
      warn: (...args) => console.warn('[WARN] [REDIS]', ...args),
      error: (...args) => console.error('[ERROR] [REDIS]', ...args),
      success: (...args) => console.log('[SUCCESS] [REDIS]', ...args),
      debug: (...args) => console.log('[DEBUG] [REDIS]', ...args),
      process: (...args) => console.log('[PROCESS] [REDIS]', ...args)
    };
    
    this.config = {
      enabled: config.redis?.enabled !== false,
      maxMemory: config.redis?.maxMemory || '256MB',
      evictionPolicy: config.redis?.evictionPolicy || 'lru', // lru, lfu, random, volatile-lru
      persistence: config.redis?.persistence !== false,
      persistenceFile: config.redis?.persistenceFile || 'redis-cache.json',
      snapshotInterval: config.redis?.snapshotInterval || 300000, // 5 minutes
      maxKeys: config.redis?.maxKeys || 1000000,
      defaultTTL: config.redis?.defaultTTL || null,
      keyPrefix: config.redis?.keyPrefix || 'bb:',
      ...(config.redis || {})
    };

    this.database = null;
    this.isInitialized = false;
    
    // In-memory storage
    this.store = new Map();
    this.expires = new Map(); // TTL tracking
    this.accessLog = new Map(); // LRU tracking
    this.accessCount = new Map(); // LFU tracking
    
    // Data structures for Redis-like types
    this.lists = new Map();
    this.sets = new Map();
    this.hashes = new Map();
    this.sortedSets = new Map();
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expires: 0,
      operations: 0,
      memoryUsage: 0,
      keyCount: 0,
      lastSnapshot: null,
      uptime: Date.now()
    };

    // Background tasks
    this.expirationTimer = null;
    this.snapshotTimer = null;
    this.memoryCheckTimer = null;

    // Commands registry (Redis-like) - will be initialized in init()
    this.commands = new Map();
  }

  async init() {
    if (this.isInitialized) return;

      this.logger.process('Initializing Redis-like Cache Layer...');    if (!this.config.enabled) {
      console.log('[WARN] Redis-like cache is disabled in configuration');
      return;
    }

    try {
      // Initialize commands first
      this._initializeCommands();
      
      // Load persistent data if enabled
      if (this.config.persistence) {
        await this._loadPersistentData();
      }

      // Start background tasks
      this._startExpirationTask();
      this._startSnapshotTask();
      this._startMemoryMonitoring();

      this.isInitialized = true;
      this.stats.uptime = Date.now();

      console.log(`[SUCCESS] Redis-like Cache Layer initialized`);
      console.log(`   - Max Memory: ${this.config.maxMemory}`);
      console.log(`   - Eviction Policy: ${this.config.evictionPolicy}`);
      console.log(`   - Persistence: ${this.config.persistence ? 'Enabled' : 'Disabled'}`);

      this.emit('cacheInitialized', {
        maxMemory: this.config.maxMemory,
        evictionPolicy: this.config.evictionPolicy,
        persistence: this.config.persistence
      });

    } catch (error) {
      console.error('[ERROR] Failed to initialize Redis-like Cache:', error.message);
      throw error;
    }
  }

  setDatabase(database) {
    this.database = database;
  }

  _initializeCommands() {
    // String commands
    this.commands.set('GET', (...args) => this.get(...args));
    this.commands.set('SET', (...args) => this.set(...args));
    this.commands.set('DEL', (...args) => this.del(...args));
    this.commands.set('EXISTS', (...args) => this.exists(...args));
    this.commands.set('EXPIRE', (...args) => this.expire(...args));
    this.commands.set('TTL', (...args) => this.ttl(...args));
    this.commands.set('INCR', (...args) => this.incr(...args));
    this.commands.set('DECR', (...args) => this.decr(...args));
    this.commands.set('INCRBY', (...args) => this.incrby(...args));
    this.commands.set('DECRBY', (...args) => this.decrby(...args));
    this.commands.set('APPEND', (...args) => this.append(...args));
    this.commands.set('STRLEN', (...args) => this.strlen(...args));

    // List commands
    this.commands.set('LPUSH', (...args) => this.lpush(...args));
    this.commands.set('RPUSH', (...args) => this.rpush(...args));
    this.commands.set('LPOP', (...args) => this.lpop(...args));
    this.commands.set('RPOP', (...args) => this.rpop(...args));
    this.commands.set('LLEN', (...args) => this.llen(...args));
    this.commands.set('LRANGE', (...args) => this.lrange(...args));
    this.commands.set('LINDEX', (...args) => this.lindex(...args));
    this.commands.set('LSET', (...args) => this.lset(...args));

    // Set commands
    this.commands.set('SADD', (...args) => this.sadd(...args));
    this.commands.set('SREM', (...args) => this.srem(...args));
    this.commands.set('SMEMBERS', (...args) => this.smembers(...args));
    this.commands.set('SISMEMBER', (...args) => this.sismember(...args));
    this.commands.set('SCARD', (...args) => this.scard(...args));
    this.commands.set('SUNION', (...args) => this.sunion(...args));
    this.commands.set('SINTER', (...args) => this.sinter(...args));

    // Hash commands
    this.commands.set('HSET', (...args) => this.hset(...args));
    this.commands.set('HGET', (...args) => this.hget(...args));
    this.commands.set('HDEL', (...args) => this.hdel(...args));
    this.commands.set('HGETALL', (...args) => this.hgetall(...args));
    this.commands.set('HKEYS', (...args) => this.hkeys(...args));
    this.commands.set('HVALS', (...args) => this.hvals(...args));
    this.commands.set('HEXISTS', (...args) => this.hexists(...args));
    this.commands.set('HLEN', (...args) => this.hlen(...args));

    // Sorted Set commands
    this.commands.set('ZADD', (...args) => this.zadd(...args));
    this.commands.set('ZREM', (...args) => this.zrem(...args));
    this.commands.set('ZRANGE', (...args) => this.zrange(...args));
    this.commands.set('ZRANK', (...args) => this.zrank(...args));
    this.commands.set('ZSCORE', (...args) => this.zscore(...args));
    this.commands.set('ZCARD', (...args) => this.zcard(...args));

    // Utility commands
    this.commands.set('KEYS', (...args) => this.keys(...args));
    this.commands.set('FLUSHALL', (...args) => this.flushall(...args));
    this.commands.set('INFO', (...args) => this.info(...args));
    this.commands.set('PING', (...args) => this.ping(...args));
    this.commands.set('SAVE', (...args) => this.save(...args));
  }

  // =============================================================================
  // STRING COMMANDS
  // =============================================================================

  async get(key) {
    this._updateStats('operation');
    
    if (this._isExpired(key)) {
      this._expireKey(key);
      this._updateStats('miss');
      return null;
    }

    if (this.store.has(key)) {
      this._updateAccess(key);
      this._updateStats('hit');
      return this.store.get(key);
    }

    this._updateStats('miss');
    return null;
  }

  async set(key, value, options = {}) {
    this._updateStats('operation');
    
    const { ttl, nx, xx } = options;

    // NX: Only set if key doesn't exist
    if (nx && this.store.has(key)) {
      return 0;
    }

    // XX: Only set if key exists
    if (xx && !this.store.has(key)) {
      return 0;
    }

    // Check memory limits before setting
    if (this._shouldEvict()) {
      this._evictKeys();
    }

    this.store.set(key, value);
    this._updateAccess(key);

    // Set TTL if provided
    if (ttl || this.config.defaultTTL) {
      this.expires.set(key, Date.now() + (ttl || this.config.defaultTTL));
    }

    this._updateStats('keyCount');
    this.emit('keySet', { key, value, ttl });
    
    return 1;
  }

  async del(...keys) {
    this._updateStats('operation');
    let deleted = 0;

    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        this.expires.delete(key);
        this.accessLog.delete(key);
        this.accessCount.delete(key);
        this._cleanupDataStructures(key);
        deleted++;
      }
    }

    this._updateStats('keyCount');
    this.emit('keysDeleted', { keys, deleted });
    
    return deleted;
  }

  async exists(...keys) {
    this._updateStats('operation');
    let count = 0;

    for (const key of keys) {
      if (!this._isExpired(key) && this.store.has(key)) {
        count++;
      }
    }

    return count;
  }

  async expire(key, seconds) {
    this._updateStats('operation');
    
    if (!this.store.has(key)) {
      return 0;
    }

    this.expires.set(key, Date.now() + (seconds * 1000));
    return 1;
  }

  async ttl(key) {
    this._updateStats('operation');
    
    if (!this.store.has(key)) {
      return -2; // Key doesn't exist
    }

    if (!this.expires.has(key)) {
      return -1; // Key exists but no TTL
    }

    const expireTime = this.expires.get(key);
    const remaining = Math.ceil((expireTime - Date.now()) / 1000);
    
    return remaining > 0 ? remaining : -2;
  }

  async incr(key) {
    return this.incrby(key, 1);
  }

  async decr(key) {
    return this.decrby(key, 1);
  }

  async incrby(key, increment) {
    this._updateStats('operation');
    
    const current = this.store.get(key);
    const value = current ? parseInt(current) : 0;
    
    if (isNaN(value)) {
      throw new Error('Value is not an integer');
    }

    const newValue = value + increment;
    await this.set(key, newValue.toString());
    
    return newValue;
  }

  async decrby(key, decrement) {
    return this.incrby(key, -decrement);
  }

  async append(key, value) {
    this._updateStats('operation');
    
    const current = this.store.get(key) || '';
    const newValue = current + value;
    
    await this.set(key, newValue);
    return newValue.length;
  }

  async strlen(key) {
    this._updateStats('operation');
    
    const value = await this.get(key);
    return value ? value.length : 0;
  }

  // =============================================================================
  // LIST COMMANDS
  // =============================================================================

  async lpush(key, ...elements) {
    this._updateStats('operation');
    
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }

    const list = this.lists.get(key);
    list.unshift(...elements);
    
    this._updateAccess(key);
    return list.length;
  }

  async rpush(key, ...elements) {
    this._updateStats('operation');
    
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }

    const list = this.lists.get(key);
    list.push(...elements);
    
    this._updateAccess(key);
    return list.length;
  }

  async lpop(key) {
    this._updateStats('operation');
    
    const list = this.lists.get(key);
    if (!list || list.length === 0) {
      return null;
    }

    this._updateAccess(key);
    return list.shift();
  }

  async rpop(key) {
    this._updateStats('operation');
    
    const list = this.lists.get(key);
    if (!list || list.length === 0) {
      return null;
    }

    this._updateAccess(key);
    return list.pop();
  }

  async llen(key) {
    this._updateStats('operation');
    
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  async lrange(key, start, stop) {
    this._updateStats('operation');
    
    const list = this.lists.get(key);
    if (!list) return [];

    this._updateAccess(key);
    
    // Handle negative indices
    const len = list.length;
    start = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    stop = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
    
    return list.slice(start, stop + 1);
  }

  async lindex(key, index) {
    this._updateStats('operation');
    
    const list = this.lists.get(key);
    if (!list) return null;

    this._updateAccess(key);
    
    const len = list.length;
    const actualIndex = index < 0 ? len + index : index;
    
    return actualIndex >= 0 && actualIndex < len ? list[actualIndex] : null;
  }

  async lset(key, index, element) {
    this._updateStats('operation');
    
    const list = this.lists.get(key);
    if (!list) {
      throw new Error('No such key');
    }

    const len = list.length;
    const actualIndex = index < 0 ? len + index : index;
    
    if (actualIndex < 0 || actualIndex >= len) {
      throw new Error('Index out of range');
    }

    list[actualIndex] = element;
    this._updateAccess(key);
    
    return 'OK';
  }

  // =============================================================================
  // SET COMMANDS
  // =============================================================================

  async sadd(key, ...members) {
    this._updateStats('operation');
    
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }

    const set = this.sets.get(key);
    let added = 0;

    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }

    this._updateAccess(key);
    return added;
  }

  async srem(key, ...members) {
    this._updateStats('operation');
    
    const set = this.sets.get(key);
    if (!set) return 0;

    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }

    this._updateAccess(key);
    return removed;
  }

  async smembers(key) {
    this._updateStats('operation');
    
    const set = this.sets.get(key);
    if (!set) return [];

    this._updateAccess(key);
    return Array.from(set);
  }

  async sismember(key, member) {
    this._updateStats('operation');
    
    const set = this.sets.get(key);
    if (!set) return 0;

    this._updateAccess(key);
    return set.has(member) ? 1 : 0;
  }

  async scard(key) {
    this._updateStats('operation');
    
    const set = this.sets.get(key);
    return set ? set.size : 0;
  }

  async sunion(...keys) {
    this._updateStats('operation');
    
    const result = new Set();
    
    for (const key of keys) {
      const set = this.sets.get(key);
      if (set) {
        this._updateAccess(key);
        for (const member of set) {
          result.add(member);
        }
      }
    }

    return Array.from(result);
  }

  async sinter(...keys) {
    this._updateStats('operation');
    
    if (keys.length === 0) return [];

    let result = this.sets.get(keys[0]);
    if (!result) return [];

    result = new Set(result);

    for (let i = 1; i < keys.length; i++) {
      const set = this.sets.get(keys[i]);
      if (!set) return [];

      this._updateAccess(keys[i]);
      
      const intersection = new Set();
      for (const member of result) {
        if (set.has(member)) {
          intersection.add(member);
        }
      }
      result = intersection;
    }

    this._updateAccess(keys[0]);
    return Array.from(result);
  }

  // =============================================================================
  // HASH COMMANDS
  // =============================================================================

  async hset(key, field, value) {
    this._updateStats('operation');
    
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }

    const hash = this.hashes.get(key);
    const isNew = !hash.has(field);
    
    hash.set(field, value);
    this._updateAccess(key);
    
    return isNew ? 1 : 0;
  }

  async hget(key, field) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    if (!hash) return null;

    this._updateAccess(key);
    return hash.get(field) || null;
  }

  async hdel(key, ...fields) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) {
        deleted++;
      }
    }

    this._updateAccess(key);
    return deleted;
  }

  async hgetall(key) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    if (!hash) return {};

    this._updateAccess(key);
    
    const result = {};
    for (const [field, value] of hash) {
      result[field] = value;
    }
    
    return result;
  }

  async hkeys(key) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    if (!hash) return [];

    this._updateAccess(key);
    return Array.from(hash.keys());
  }

  async hvals(key) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    if (!hash) return [];

    this._updateAccess(key);
    return Array.from(hash.values());
  }

  async hexists(key, field) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    this._updateAccess(key);
    return hash.has(field) ? 1 : 0;
  }

  async hlen(key) {
    this._updateStats('operation');
    
    const hash = this.hashes.get(key);
    return hash ? hash.size : 0;
  }

  // =============================================================================
  // SORTED SET COMMANDS (Simplified)
  // =============================================================================

  async zadd(key, score, member) {
    this._updateStats('operation');
    
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }

    const zset = this.sortedSets.get(key);
    const isNew = !zset.has(member);
    
    zset.set(member, score);
    this._updateAccess(key);
    
    return isNew ? 1 : 0;
  }

  async zrem(key, ...members) {
    this._updateStats('operation');
    
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;

    let removed = 0;
    for (const member of members) {
      if (zset.delete(member)) {
        removed++;
      }
    }

    this._updateAccess(key);
    return removed;
  }

  async zrange(key, start, stop) {
    this._updateStats('operation');
    
    const zset = this.sortedSets.get(key);
    if (!zset) return [];

    this._updateAccess(key);
    
    // Sort by score
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const members = sorted.map(entry => entry[0]);
    
    // Handle range
    const len = members.length;
    start = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    stop = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
    
    return members.slice(start, stop + 1);
  }

  async zscore(key, member) {
    this._updateStats('operation');
    
    const zset = this.sortedSets.get(key);
    if (!zset) return null;

    this._updateAccess(key);
    return zset.get(member) || null;
  }

  async zcard(key) {
    this._updateStats('operation');
    
    const zset = this.sortedSets.get(key);
    return zset ? zset.size : 0;
  }

  async zrank(key, member) {
    this._updateStats('operation');
    
    const zset = this.sortedSets.get(key);
    if (!zset) return null;

    this._updateAccess(key);
    
    // Sort by score to get rank
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const index = sorted.findIndex(entry => entry[0] === member);
    
    return index >= 0 ? index : null;
  }

  // =============================================================================
  // UTILITY COMMANDS
  // =============================================================================

  async keys(pattern = '*') {
    this._updateStats('operation');
    
    const allKeys = Array.from(this.store.keys());
    
    if (pattern === '*') {
      return allKeys;
    }

    // Simple pattern matching (*, ?)
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
    );

    return allKeys.filter(key => regex.test(key));
  }

  async flushall() {
    this._updateStats('operation');
    
    this.store.clear();
    this.expires.clear();
    this.accessLog.clear();
    this.accessCount.clear();
    this.lists.clear();
    this.sets.clear();
    this.hashes.clear();
    this.sortedSets.clear();
    
    this.stats.keyCount = 0;
    this.emit('flushed');
    
    return 'OK';
  }

  async ping(message = 'PONG') {
    this._updateStats('operation');
    return message;
  }

  async info(section = 'all') {
    this._updateStats('operation');
    
    const uptime = Math.floor((Date.now() - this.stats.uptime) / 1000);
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    const info = {
      server: {
        version: '1.0.0',
        uptime_in_seconds: uptime,
        uptime_in_days: Math.floor(uptime / 86400)
      },
      memory: {
        used_memory: this.stats.memoryUsage,
        max_memory: this.config.maxMemory,
        eviction_policy: this.config.evictionPolicy
      },
      stats: {
        total_operations: this.stats.operations,
        keyspace_hits: this.stats.hits,
        keyspace_misses: this.stats.misses,
        hit_rate: `${hitRate}%`,
        evicted_keys: this.stats.evictions,
        expired_keys: this.stats.expires,
        current_keys: this.stats.keyCount
      },
      keyspace: {
        keys: this.store.size,
        lists: this.lists.size,
        sets: this.sets.size,
        hashes: this.hashes.size,
        sorted_sets: this.sortedSets.size
      }
    };

    if (section === 'all') {
      return info;
    }

    return info[section] || {};
  }

  async save() {
    this._updateStats('operation');
    
    if (!this.config.persistence) {
      return 'Persistence is disabled';
    }

    await this._saveSnapshot();
    return 'OK';
  }

  // =============================================================================
  // COMMAND EXECUTION
  // =============================================================================

  async executeCommand(command, ...args) {
    const cmd = command.toUpperCase();
    
    if (!this.commands.has(cmd)) {
      throw new Error(`Unknown command: ${command}`);
    }

    try {
      const result = await this.commands.get(cmd)(...args);
      
      this.emit('commandExecuted', {
        command: cmd,
        args,
        result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      this.emit('commandError', {
        command: cmd,
        args,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  _isExpired(key) {
    if (!this.expires.has(key)) {
      return false;
    }

    return Date.now() > this.expires.get(key);
  }

  _expireKey(key) {
    this.store.delete(key);
    this.expires.delete(key);
    this.accessLog.delete(key);
    this.accessCount.delete(key);
    this._cleanupDataStructures(key);
    
    this.stats.expires++;
    this.emit('keyExpired', { key });
  }

  _cleanupDataStructures(key) {
    this.lists.delete(key);
    this.sets.delete(key);
    this.hashes.delete(key);
    this.sortedSets.delete(key);
  }

  _updateAccess(key) {
    this.accessLog.set(key, Date.now());
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
  }

  _updateStats(type) {
    switch (type) {
      case 'hit':
        this.stats.hits++;
        break;
      case 'miss':
        this.stats.misses++;
        break;
      case 'operation':
        this.stats.operations++;
        break;
      case 'keyCount':
        this.stats.keyCount = this.store.size;
        break;
    }
  }

  _shouldEvict() {
    const maxMemoryBytes = this._parseMemorySize(this.config.maxMemory);
    const currentMemory = this._estimateMemoryUsage();
    
    return currentMemory > maxMemoryBytes || this.store.size > this.config.maxKeys;
  }

  _evictKeys() {
    const toEvict = Math.max(1, Math.floor(this.store.size * 0.1)); // Evict 10%
    let evicted = 0;

    const keys = Array.from(this.store.keys());

    switch (this.config.evictionPolicy) {
      case 'lru':
        this._evictLRU(toEvict);
        break;
      case 'lfu':
        this._evictLFU(toEvict);
        break;
      case 'random':
        this._evictRandom(toEvict);
        break;
      case 'volatile-lru':
        this._evictVolatileLRU(toEvict);
        break;
      default:
        this._evictLRU(toEvict);
    }
  }

  _evictLRU(count) {
    const sortedByAccess = Array.from(this.accessLog.entries())
      .sort((a, b) => a[1] - b[1]);

    for (let i = 0; i < Math.min(count, sortedByAccess.length); i++) {
      const key = sortedByAccess[i][0];
      this.del(key);
      this.stats.evictions++;
    }
  }

  _evictLFU(count) {
    const sortedByCount = Array.from(this.accessCount.entries())
      .sort((a, b) => a[1] - b[1]);

    for (let i = 0; i < Math.min(count, sortedByCount.length); i++) {
      const key = sortedByCount[i][0];
      this.del(key);
      this.stats.evictions++;
    }
  }

  _evictRandom(count) {
    const keys = Array.from(this.store.keys());
    
    for (let i = 0; i < Math.min(count, keys.length); i++) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      const key = keys[randomIndex];
      this.del(key);
      this.stats.evictions++;
    }
  }

  _evictVolatileLRU(count) {
    const volatileKeys = Array.from(this.expires.keys());
    const sortedByAccess = volatileKeys
      .map(key => [key, this.accessLog.get(key) || 0])
      .sort((a, b) => a[1] - b[1]);

    for (let i = 0; i < Math.min(count, sortedByAccess.length); i++) {
      const key = sortedByAccess[i][0];
      this.del(key);
      this.stats.evictions++;
    }
  }

  _parseMemorySize(size) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = size.match(/^(\d+)(B|KB|MB|GB)$/i);
    
    if (!match) return 256 * 1024 * 1024; // Default 256MB
    
    const [, number, unit] = match;
    return parseInt(number) * units[unit.toUpperCase()];
  }

  _estimateMemoryUsage() {
    let size = 0;
    
    // Estimate string storage
    for (const [key, value] of this.store) {
      size += key.length * 2; // UTF-16
      size += typeof value === 'string' ? value.length * 2 : 8;
    }

    // Estimate data structures
    size += this.lists.size * 100; // Rough estimate
    size += this.sets.size * 100;
    size += this.hashes.size * 100;
    size += this.sortedSets.size * 100;

    this.stats.memoryUsage = size;
    return size;
  }

  _startExpirationTask() {
    this.expirationTimer = setInterval(() => {
      const expiredKeys = [];
      
      for (const [key, expireTime] of this.expires) {
        if (Date.now() > expireTime) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        this._expireKey(key);
      }
    }, 10000); // Check every 10 seconds
  }

  _startSnapshotTask() {
    if (!this.config.persistence || !this.config.snapshotInterval) return;

    this.snapshotTimer = setInterval(async () => {
      try {
        await this._saveSnapshot();
      } catch (error) {
        console.error('[ERROR] Failed to save snapshot:', error.message);
      }
    }, this.config.snapshotInterval);
  }

  _startMemoryMonitoring() {
    this.memoryCheckTimer = setInterval(() => {
      this._estimateMemoryUsage();
      
      if (this._shouldEvict()) {
        this._evictKeys();
      }
    }, 30000); // Check every 30 seconds
  }

  async _saveSnapshot() {
    if (!this.config.persistence) return;

    const snapshot = {
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        store: Object.fromEntries(this.store),
        expires: Object.fromEntries(this.expires),
        lists: Object.fromEntries(
          Array.from(this.lists.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        sets: Object.fromEntries(
          Array.from(this.sets.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        hashes: Object.fromEntries(
          Array.from(this.hashes.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
        ),
        sortedSets: Object.fromEntries(
          Array.from(this.sortedSets.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
        )
      },
      stats: this.stats
    };

    await fs.writeFile(this.config.persistenceFile, JSON.stringify(snapshot, null, 2));
    this.stats.lastSnapshot = Date.now();
    
    console.log(`[STORAGE] Cache snapshot saved: ${this.config.persistenceFile}`);
  }

  async _loadPersistentData() {
    try {
      if (!await fs.access(this.config.persistenceFile).then(() => true).catch(() => false)) {
        this.logger.info('No existing cache snapshot found');
        return;
      }

      const data = await fs.readFile(this.config.persistenceFile, 'utf8');
      const snapshot = JSON.parse(data);

      if (snapshot.data) {
        // Restore store
        this.store = new Map(Object.entries(snapshot.data.store || {}));
        this.expires = new Map(Object.entries(snapshot.data.expires || {}).map(([k, v]) => [k, Number(v)]));
        
        // Restore data structures
        this.lists = new Map(Object.entries(snapshot.data.lists || {}));
        this.sets = new Map(Object.entries(snapshot.data.sets || {}).map(([k, v]) => [k, new Set(v)]));
        this.hashes = new Map(Object.entries(snapshot.data.hashes || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));
        this.sortedSets = new Map(Object.entries(snapshot.data.sortedSets || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));

        // Update stats
        if (snapshot.stats) {
          this.stats = { ...this.stats, ...snapshot.stats };
        }

        console.log(`📂 Loaded cache snapshot: ${this.store.size} keys restored`);
      }
    } catch (error) {
      console.warn('[WARN] Failed to load cache snapshot:', error.message);
    }
  }

  // Public API methods
  getStats() {
    const uptime = Math.floor((Date.now() - this.stats.uptime) / 1000);
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      uptime,
      hitRate: parseFloat(hitRate),
      memoryUsage: this._estimateMemoryUsage(),
      keyspaceInfo: {
        keys: this.store.size,
        lists: this.lists.size,
        sets: this.sets.size,
        hashes: this.hashes.size,
        sortedSets: this.sortedSets.size
      },
      config: {
        maxMemory: this.config.maxMemory,
        evictionPolicy: this.config.evictionPolicy,
        persistence: this.config.persistence
      }
    };
  }

  async shutdown() {
    console.log('[PROCESS] Shutting down Redis-like Cache...');
    
    // Clear timers
    if (this.expirationTimer) clearInterval(this.expirationTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.memoryCheckTimer) clearInterval(this.memoryCheckTimer);

    // Save final snapshot
    if (this.config.persistence) {
      try {
        await this._saveSnapshot();
      } catch (error) {
        console.error('[ERROR] Failed to save final snapshot:', error.message);
      }
    }

    // Clear all data
    this.store.clear();
    this.expires.clear();
    this.accessLog.clear();
    this.accessCount.clear();
    this.lists.clear();
    this.sets.clear();
    this.hashes.clear();
    this.sortedSets.clear();
    
    this.logger.success('Redis-like Cache shutdown complete');
  }
}

export default RedisLikeCache;
