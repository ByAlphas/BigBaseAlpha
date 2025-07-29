/**
 * Query Profiler for BigBaseAlpha
 * Monitors, analyzes and optimizes database query performance
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export class QueryProfiler {
  constructor(config = {}) {
    this.config = {
      path: config.path || './query_profiles',
      enabled: config.enabled !== false,
      slowQueryThreshold: config.slowQueryThreshold || 100, // ms
      maxProfiles: config.maxProfiles || 1000,
      retentionDays: config.retentionDays || 7,
      trackStackTrace: config.trackStackTrace !== false,
      ...config
    };

    this.profiles = [];
    this.currentQueries = new Map(); // Track ongoing queries
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      averageTime: 0,
      totalTime: 0,
      startTime: new Date()
    };
    
    this.isInitialized = false;
  }

  async init() {
    try {
      if (!this.config.enabled) {
        console.log('⚠️ Query Profiler disabled');
        return;
      }

      // Create profiles directory
      if (!existsSync(this.config.path)) {
        mkdirSync(this.config.path, { recursive: true });
      }

      // Load existing profiles
      await this._loadProfiles();
      
      // Start cleanup timer
      this._startCleanup();
      
      this.isInitialized = true;
      console.log('✅ Query Profiler initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Query Profiler: ${error.message}`);
    }
  }

  /**
   * Start profiling a query
   */
  startQuery(queryId, queryInfo) {
    if (!this.config.enabled || !this.isInitialized) return null;

    const profile = {
      id: queryId,
      collection: queryInfo.collection,
      operation: queryInfo.operation, // 'find', 'insert', 'update', 'delete', 'query'
      query: this._sanitizeQuery(queryInfo.query),
      options: queryInfo.options || {},
      startTime: Date.now(),
      startTimeISO: new Date().toISOString(),
      stackTrace: this.config.trackStackTrace ? this._getStackTrace() : null,
      status: 'running'
    };

    this.currentQueries.set(queryId, profile);
    return profile;
  }

  /**
   * End profiling a query
   */
  endQuery(queryId, result = null, error = null) {
    if (!this.config.enabled || !this.isInitialized) return;

    const profile = this.currentQueries.get(queryId);
    if (!profile) return;

    const endTime = Date.now();
    const duration = endTime - profile.startTime;

    // Complete the profile
    profile.endTime = endTime;
    profile.endTimeISO = new Date().toISOString();
    profile.duration = duration;
    profile.status = error ? 'error' : 'completed';
    
    if (error) {
      profile.error = {
        message: error.message,
        stack: error.stack
      };
    }

    if (result) {
      profile.result = {
        type: Array.isArray(result) ? 'array' : typeof result,
        count: Array.isArray(result) ? result.length : (result ? 1 : 0),
        size: this._estimateSize(result)
      };
    }

    // Add performance metrics
    profile.performance = this._analyzePerformance(profile);

    // Update stats
    this._updateStats(profile);

    // Store profile
    this.profiles.push(profile);
    this.currentQueries.delete(queryId);

    // Maintain profile limit
    if (this.profiles.length > this.config.maxProfiles) {
      this.profiles = this.profiles.slice(-this.config.maxProfiles);
    }

    // Save if it's a slow query or error
    if (duration >= this.config.slowQueryThreshold || error) {
      this._saveProfile(profile);
    }
  }

  /**
   * Get query statistics
   */
  getStats(options = {}) {
    const { 
      timeRange = null, // '1h', '24h', '7d'
      collection = null,
      operation = null 
    } = options;

    let filteredProfiles = [...this.profiles];

    // Apply time filter
    if (timeRange) {
      const cutoff = this._getTimeRangeCutoff(timeRange);
      filteredProfiles = filteredProfiles.filter(p => p.startTime >= cutoff);
    }

    // Apply collection filter
    if (collection) {
      filteredProfiles = filteredProfiles.filter(p => p.collection === collection);
    }

    // Apply operation filter
    if (operation) {
      filteredProfiles = filteredProfiles.filter(p => p.operation === operation);
    }

    return this._calculateStats(filteredProfiles);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(options = {}) {
    const {
      limit = 50,
      threshold = this.config.slowQueryThreshold,
      collection = null,
      timeRange = '24h'
    } = options;

    const cutoff = this._getTimeRangeCutoff(timeRange);
    
    let slowQueries = this.profiles
      .filter(p => 
        p.duration >= threshold &&
        p.startTime >= cutoff &&
        (!collection || p.collection === collection)
      )
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);

    return slowQueries.map(query => ({
      ...query,
      suggestions: this._getSuggestions(query)
    }));
  }

  /**
   * Get query patterns and insights
   */
  analyzePatterns(options = {}) {
    const { timeRange = '24h', collection = null } = options;
    const cutoff = this._getTimeRangeCutoff(timeRange);
    
    let profiles = this.profiles.filter(p => p.startTime >= cutoff);
    if (collection) {
      profiles = profiles.filter(p => p.collection === collection);
    }

    return {
      queryPatterns: this._analyzeQueryPatterns(profiles),
      performanceTrends: this._analyzePerformanceTrends(profiles),
      errorPatterns: this._analyzeErrorPatterns(profiles),
      recommendations: this._generateRecommendations(profiles)
    };
  }

  /**
   * Get real-time query metrics
   */
  getRealTimeMetrics() {
    const now = Date.now();
    const last5min = now - (5 * 60 * 1000);
    const recentQueries = this.profiles.filter(p => p.startTime >= last5min);

    return {
      currentActiveQueries: this.currentQueries.size,
      queriesLast5Min: recentQueries.length,
      avgResponseTime: recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length || 0,
      slowQueriesLast5Min: recentQueries.filter(q => q.duration >= this.config.slowQueryThreshold).length,
      errorsLast5Min: recentQueries.filter(q => q.status === 'error').length,
      topCollections: this._getTopCollections(recentQueries),
      topOperations: this._getTopOperations(recentQueries)
    };
  }

  /**
   * Export profile data
   */
  async exportProfiles(format = 'json', options = {}) {
    const { timeRange = '24h', collection = null } = options;
    const cutoff = this._getTimeRangeCutoff(timeRange);
    
    let profiles = this.profiles.filter(p => p.startTime >= cutoff);
    if (collection) {
      profiles = profiles.filter(p => p.collection === collection);
    }

    const exportData = {
      exportTime: new Date().toISOString(),
      timeRange,
      collection,
      totalProfiles: profiles.length,
      stats: this._calculateStats(profiles),
      profiles
    };

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return this._exportToCSV(profiles);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private methods
  _sanitizeQuery(query) {
    // Remove sensitive data from queries before logging
    if (!query) return null;
    
    const sanitized = JSON.parse(JSON.stringify(query));
    
    // Remove potential password fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    function sanitizeObject(obj) {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key of Object.keys(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[SANITIZED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  _getStackTrace() {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 8) : null; // Skip this function and caller
  }

  _estimateSize(data) {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  _analyzePerformance(profile) {
    const performance = {
      category: 'normal',
      score: 100
    };

    // Categorize based on duration
    if (profile.duration >= 1000) {
      performance.category = 'very-slow';
      performance.score = 10;
    } else if (profile.duration >= 500) {
      performance.category = 'slow';
      performance.score = 30;
    } else if (profile.duration >= 100) {
      performance.category = 'moderate';
      performance.score = 60;
    } else if (profile.duration >= 50) {
      performance.category = 'acceptable';
      performance.score = 80;
    }

    // Additional analysis
    if (profile.result?.count > 1000) {
      performance.score -= 20;
      performance.largeResultSet = true;
    }

    if (profile.operation === 'query' && !profile.options?.limit) {
      performance.score -= 15;
      performance.noLimit = true;
    }

    return performance;
  }

  _updateStats(profile) {
    this.stats.totalQueries++;
    this.stats.totalTime += profile.duration;
    this.stats.averageTime = this.stats.totalTime / this.stats.totalQueries;

    if (profile.duration >= this.config.slowQueryThreshold) {
      this.stats.slowQueries++;
    }
  }

  _getTimeRangeCutoff(timeRange) {
    const now = Date.now();
    const ranges = {
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    return now - (ranges[timeRange] || ranges['24h']);
  }

  _calculateStats(profiles) {
    if (profiles.length === 0) {
      return {
        totalQueries: 0,
        averageTime: 0,
        slowQueries: 0,
        errorQueries: 0,
        fastestQuery: null,
        slowestQuery: null
      };
    }

    const durations = profiles.map(p => p.duration);
    const slowQueries = profiles.filter(p => p.duration >= this.config.slowQueryThreshold);
    const errorQueries = profiles.filter(p => p.status === 'error');

    return {
      totalQueries: profiles.length,
      averageTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianTime: this._median(durations),
      slowQueries: slowQueries.length,
      errorQueries: errorQueries.length,
      fastestQuery: Math.min(...durations),
      slowestQuery: Math.max(...durations),
      operationsBreakdown: this._getOperationsBreakdown(profiles),
      collectionsBreakdown: this._getCollectionsBreakdown(profiles)
    };
  }

  _median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  _getOperationsBreakdown(profiles) {
    const breakdown = {};
    for (const profile of profiles) {
      breakdown[profile.operation] = (breakdown[profile.operation] || 0) + 1;
    }
    return breakdown;
  }

  _getCollectionsBreakdown(profiles) {
    const breakdown = {};
    for (const profile of profiles) {
      breakdown[profile.collection] = (breakdown[profile.collection] || 0) + 1;
    }
    return breakdown;
  }

  _getSuggestions(profile) {
    const suggestions = [];

    if (profile.duration >= 1000) {
      suggestions.push('Consider adding indexes for this query pattern');
    }

    if (profile.result?.count > 1000 && !profile.options?.limit) {
      suggestions.push('Add pagination with limit and offset');
    }

    if (profile.operation === 'query' && !profile.options?.select) {
      suggestions.push('Use field selection to reduce data transfer');
    }

    if (profile.query && typeof profile.query === 'object') {
      const queryKeys = Object.keys(profile.query);
      if (queryKeys.length > 3) {
        suggestions.push('Complex queries may benefit from compound indexes');
      }
    }

    return suggestions;
  }

  _analyzeQueryPatterns(profiles) {
    const patterns = {};
    
    for (const profile of profiles) {
      const pattern = this._extractQueryPattern(profile);
      if (!patterns[pattern]) {
        patterns[pattern] = {
          count: 0,
          avgDuration: 0,
          totalDuration: 0,
          example: profile
        };
      }
      
      patterns[pattern].count++;
      patterns[pattern].totalDuration += profile.duration;
      patterns[pattern].avgDuration = patterns[pattern].totalDuration / patterns[pattern].count;
    }

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10);
  }

  _extractQueryPattern(profile) {
    // Create a pattern signature for the query
    const parts = [
      profile.operation,
      profile.collection
    ];

    if (profile.query && typeof profile.query === 'object') {
      const queryStructure = Object.keys(profile.query).sort().join(',');
      parts.push(queryStructure);
    }

    return parts.join(':');
  }

  _analyzePerformanceTrends(profiles) {
    // Group by hour and calculate average performance
    const trends = {};
    
    for (const profile of profiles) {
      const hour = new Date(profile.startTime).getHours();
      if (!trends[hour]) {
        trends[hour] = { count: 0, totalDuration: 0 };
      }
      
      trends[hour].count++;
      trends[hour].totalDuration += profile.duration;
    }

    return Object.entries(trends).map(([hour, data]) => ({
      hour: parseInt(hour),
      averageDuration: data.totalDuration / data.count,
      queryCount: data.count
    }));
  }

  _analyzeErrorPatterns(profiles) {
    const errorProfiles = profiles.filter(p => p.status === 'error');
    const patterns = {};

    for (const profile of errorProfiles) {
      const errorType = profile.error?.message || 'Unknown';
      if (!patterns[errorType]) {
        patterns[errorType] = {
          count: 0,
          collections: new Set(),
          operations: new Set()
        };
      }
      
      patterns[errorType].count++;
      patterns[errorType].collections.add(profile.collection);
      patterns[errorType].operations.add(profile.operation);
    }

    return Object.entries(patterns).map(([error, data]) => ({
      error,
      count: data.count,
      collections: Array.from(data.collections),
      operations: Array.from(data.operations)
    }));
  }

  _generateRecommendations(profiles) {
    const recommendations = [];
    const stats = this._calculateStats(profiles);

    if (stats.slowQueries / stats.totalQueries > 0.1) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'High percentage of slow queries detected. Consider adding indexes.',
        metric: `${Math.round(stats.slowQueries / stats.totalQueries * 100)}% slow queries`
      });
    }

    if (stats.averageTime > 200) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Average query time is high. Review query patterns and indexing strategy.',
        metric: `${Math.round(stats.averageTime)}ms average`
      });
    }

    if (stats.errorQueries > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'Query errors detected. Review error patterns and add proper error handling.',
        metric: `${stats.errorQueries} failed queries`
      });
    }

    return recommendations;
  }

  _getTopCollections(profiles) {
    const collections = {};
    for (const profile of profiles) {
      collections[profile.collection] = (collections[profile.collection] || 0) + 1;
    }
    
    return Object.entries(collections)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }

  _getTopOperations(profiles) {
    const operations = {};
    for (const profile of profiles) {
      operations[profile.operation] = (operations[profile.operation] || 0) + 1;
    }
    
    return Object.entries(operations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }

  _exportToCSV(profiles) {
    const headers = [
      'Timestamp', 'Collection', 'Operation', 'Duration (ms)', 
      'Status', 'Result Count', 'Query Pattern'
    ];

    const rows = profiles.map(profile => [
      profile.startTimeISO,
      profile.collection,
      profile.operation,
      profile.duration,
      profile.status,
      profile.result?.count || 0,
      this._extractQueryPattern(profile)
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  async _loadProfiles() {
    try {
      const profilePath = join(this.config.path, 'query_profiles.json');
      if (existsSync(profilePath)) {
        const data = await fs.readFile(profilePath, 'utf8');
        const parsed = JSON.parse(data);
        this.profiles = parsed.profiles || [];
        this.stats = { ...this.stats, ...parsed.stats };
      }
    } catch (error) {
      console.warn('Could not load query profiles:', error.message);
    }
  }

  async _saveProfile(profile) {
    try {
      const filename = `slow_query_${Date.now()}.json`;
      const filepath = join(this.config.path, filename);
      await fs.writeFile(filepath, JSON.stringify(profile, null, 2));
    } catch (error) {
      console.error('Failed to save query profile:', error);
    }
  }

  _startCleanup() {
    // Clean up old profiles daily
    setInterval(() => {
      this._cleanupOldProfiles();
    }, 24 * 60 * 60 * 1000);
  }

  _cleanupOldProfiles() {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.profiles = this.profiles.filter(p => p.startTime >= cutoff);
  }

  async close() {
    if (this.isInitialized) {
      try {
        const exportData = {
          profiles: this.profiles,
          stats: this.stats,
          lastSaved: new Date().toISOString()
        };
        
        const profilePath = join(this.config.path, 'query_profiles.json');
        await fs.writeFile(profilePath, JSON.stringify(exportData, null, 2));
      } catch (error) {
        console.error('Failed to save profiles on close:', error);
      }
      
      this.isInitialized = false;
    }
  }
}
