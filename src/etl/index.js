import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

/**
 * ETL & Data Pipeline Engine for BigBaseAlpha
 * Handles data extraction, transformation, and loading operations
 */
export class ETLEngine extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.basePath = config.path || './bigbase_data';
    this.pipelinesPath = join(this.basePath, 'pipelines');
    this.tempPath = join(this.basePath, 'temp');
    
    // Pipeline management
    this.pipelines = new Map();
    this.activePipelines = new Map();
    this.scheduledJobs = new Map();
    this.jobHistory = [];
    
    // Statistics
    this.stats = {
      totalPipelines: 0,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalRowsProcessed: 0,
      totalDataProcessed: 0
    };
    
    // Data transformation functions
    this.transformers = new Map();
    this.validators = new Map();
    this.extractors = new Map();
    this.loaders = new Map();
    
    this._initializeBuiltInComponents();
  }

  /**
   * Initialize the ETL engine
   */
  async init() {
    try {
      // Create necessary directories
      await this._ensureDirectories();
      
      // Load existing pipelines
      await this._loadPipelines();
      
      // Register built-in components
      this._registerBuiltInComponents();
      
      // Start scheduler
      this._startScheduler();
      
      console.log('✅ ETL Engine initialized');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ ETL Engine initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new data pipeline
   */
  async createPipeline(config) {
    const pipeline = {
      id: config.id || this._generateId(),
      name: config.name,
      description: config.description || '',
      source: config.source,
      destination: config.destination,
      transformations: config.transformations || [],
      validations: config.validations || [],
      schedule: config.schedule || null,
      enabled: config.enabled !== false,
      created: new Date(),
      lastRun: null,
      stats: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        totalRowsProcessed: 0,
        averageRunTime: 0
      }
    };

    this.pipelines.set(pipeline.id, pipeline);
    
    // Save pipeline configuration
    await this._savePipeline(pipeline);
    
    // Schedule if needed
    if (pipeline.schedule && pipeline.enabled) {
      this._schedulePipeline(pipeline);
    }

    this.stats.totalPipelines++;
    this.emit('pipelineCreated', pipeline);
    
    return pipeline;
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(pipelineId, options = {}) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    if (this.activePipelines.has(pipelineId)) {
      throw new Error(`Pipeline '${pipelineId}' is already running`);
    }

    const execution = {
      id: this._generateId(),
      pipelineId,
      startTime: new Date(),
      endTime: null,
      status: 'running',
      rowsProcessed: 0,
      errors: [],
      warnings: [],
      progress: 0
    };

    this.activePipelines.set(pipelineId, execution);
    this.emit('pipelineStarted', execution);

    try {
      // Extract data
      console.log(`📤 Extracting data from: ${pipeline.source.type}`);
      const extractedData = await this._extractData(pipeline.source);
      
      // Transform data
      console.log(`🔄 Transforming data with ${pipeline.transformations.length} transformations`);
      const transformedData = await this._transformData(extractedData, pipeline.transformations);
      
      // Validate data
      if (pipeline.validations.length > 0) {
        console.log(`✅ Validating data with ${pipeline.validations.length} validators`);
        await this._validateData(transformedData, pipeline.validations);
      }
      
      // Load data
      console.log(`📥 Loading data to: ${pipeline.destination.type}`);
      await this._loadData(transformedData, pipeline.destination);

      // Update execution status
      execution.endTime = new Date();
      execution.status = 'completed';
      execution.rowsProcessed = transformedData.length;
      
      // Update pipeline stats
      pipeline.stats.totalRuns++;
      pipeline.stats.successfulRuns++;
      pipeline.stats.totalRowsProcessed += execution.rowsProcessed;
      pipeline.stats.averageRunTime = this._calculateAverageRunTime(pipeline);
      pipeline.lastRun = execution.endTime;

      // Update global stats
      this.stats.totalJobs++;
      this.stats.successfulJobs++;
      this.stats.totalRowsProcessed += execution.rowsProcessed;

      console.log(`✅ Pipeline '${pipeline.name}' completed successfully`);
      console.log(`   Processed ${execution.rowsProcessed} rows in ${execution.endTime - execution.startTime}ms`);

    } catch (error) {
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      });

      pipeline.stats.totalRuns++;
      pipeline.stats.failedRuns++;
      
      this.stats.totalJobs++;
      this.stats.failedJobs++;

      console.error(`❌ Pipeline '${pipeline.name}' failed:`, error.message);
      this.emit('pipelineError', { execution, error });

    } finally {
      this.activePipelines.delete(pipelineId);
      this.jobHistory.unshift(execution);
      
      // Keep only last 100 executions
      if (this.jobHistory.length > 100) {
        this.jobHistory = this.jobHistory.slice(0, 100);
      }
      
      this.emit('pipelineCompleted', execution);
      await this._savePipeline(pipeline);
    }

    return execution;
  }

  /**
   * Extract data from various sources
   */
  async _extractData(source) {
    const extractor = this.extractors.get(source.type);
    if (!extractor) {
      throw new Error(`No extractor found for source type: ${source.type}`);
    }

    return await extractor(source);
  }

  /**
   * Transform data using configured transformations
   */
  async _transformData(data, transformations) {
    let result = [...data];

    for (const transformation of transformations) {
      const transformer = this.transformers.get(transformation.type);
      if (!transformer) {
        console.warn(`Warning: Transformer '${transformation.type}' not found, skipping`);
        continue;
      }

      result = await transformer(result, transformation.config || {});
    }

    return result;
  }

  /**
   * Validate data using configured validators
   */
  async _validateData(data, validations) {
    for (const validation of validations) {
      const validator = this.validators.get(validation.type);
      if (!validator) {
        console.warn(`Warning: Validator '${validation.type}' not found, skipping`);
        continue;
      }

      const isValid = await validator(data, validation.config || {});
      if (!isValid) {
        throw new Error(`Data validation failed: ${validation.type}`);
      }
    }
  }

  /**
   * Load data to various destinations
   */
  async _loadData(data, destination) {
    const loader = this.loaders.get(destination.type);
    if (!loader) {
      throw new Error(`No loader found for destination type: ${destination.type}`);
    }

    return await loader(data, destination);
  }

  /**
   * Register built-in ETL components
   */
  _registerBuiltInComponents() {
    // Extractors
    this.extractors.set('csv', this._extractFromCSV.bind(this));
    this.extractors.set('json', this._extractFromJSON.bind(this));
    this.extractors.set('collection', this._extractFromCollection.bind(this));
    this.extractors.set('api', this._extractFromAPI.bind(this));

    // Transformers
    this.transformers.set('map', this._transformMap.bind(this));
    this.transformers.set('filter', this._transformFilter.bind(this));
    this.transformers.set('aggregate', this._transformAggregate.bind(this));
    this.transformers.set('join', this._transformJoin.bind(this));
    this.transformers.set('normalize', this._transformNormalize.bind(this));

    // Validators
    this.validators.set('schema', this._validateSchema.bind(this));
    this.validators.set('uniqueness', this._validateUniqueness.bind(this));
    this.validators.set('completeness', this._validateCompleteness.bind(this));

    // Loaders
    this.loaders.set('csv', this._loadToCSV.bind(this));
    this.loaders.set('json', this._loadToJSON.bind(this));
    this.loaders.set('collection', this._loadToCollection.bind(this));
    this.loaders.set('api', this._loadToAPI.bind(this));
  }

  /**
   * Built-in Extractors
   */
  async _extractFromCSV(source) {
    const data = [];
    const filePath = source.path;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return data;
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        data.push(row);
      }
      
    } catch (error) {
      throw new Error(`Failed to extract CSV data from ${filePath}: ${error.message}`);
    }
    
    return data;
  }

  async _extractFromJSON(source) {
    try {
      const content = await fs.readFile(source.path, 'utf8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new Error(`Failed to extract JSON data: ${error.message}`);
    }
  }

  async _extractFromCollection(source) {
    if (!this.database) {
      throw new Error('Database instance not available for collection extraction');
    }

    try {
      const query = source.query || {};
      return await this.database.find(source.collection, query, source.options || {});
    } catch (error) {
      throw new Error(`Failed to extract from collection: ${error.message}`);
    }
  }

  async _extractFromAPI(source) {
    // API extraction would require HTTP client implementation
    throw new Error('API extraction not implemented yet');
  }

  /**
   * Built-in Transformers
   */
  async _transformMap(data, config) {
    const { mapping } = config;
    return data.map(row => {
      const newRow = {};
      for (const [newField, oldField] of Object.entries(mapping)) {
        newRow[newField] = row[oldField];
      }
      return newRow;
    });
  }

  async _transformFilter(data, config) {
    const { condition } = config;
    return data.filter(row => {
      try {
        // Simple condition evaluation (can be enhanced)
        return eval(condition.replace(/\{\{(\w+)\}\}/g, 'row.$1'));
      } catch {
        return false;
      }
    });
  }

  async _transformAggregate(data, config) {
    const { groupBy, aggregations } = config;
    const groups = {};
    
    // Group data
    data.forEach(row => {
      const key = Array.isArray(groupBy) ? 
        groupBy.map(field => row[field]).join('|') : 
        row[groupBy];
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    
    // Apply aggregations
    const result = [];
    for (const [key, rows] of Object.entries(groups)) {
      const aggregated = {};
      
      if (Array.isArray(groupBy)) {
        groupBy.forEach((field, index) => {
          aggregated[field] = key.split('|')[index];
        });
      } else {
        aggregated[groupBy] = key;
      }
      
      for (const [field, operation] of Object.entries(aggregations)) {
        switch (operation) {
          case 'sum':
            aggregated[field] = rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
            break;
          case 'avg':
            aggregated[field] = rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) / rows.length;
            break;
          case 'count':
            aggregated[field] = rows.length;
            break;
          case 'min':
            aggregated[field] = Math.min(...rows.map(row => Number(row[field]) || 0));
            break;
          case 'max':
            aggregated[field] = Math.max(...rows.map(row => Number(row[field]) || 0));
            break;
        }
      }
      
      result.push(aggregated);
    }
    
    return result;
  }

  async _transformJoin(data, config) {
    // Join transformation implementation
    // This would require additional data source for joining
    return data;
  }

  async _transformNormalize(data, config) {
    const { fields } = config;
    
    return data.map(row => {
      const normalized = { ...row };
      
      fields.forEach(field => {
        if (normalized[field]) {
          // Simple normalization - trim, lowercase
          normalized[field] = String(normalized[field]).trim().toLowerCase();
        }
      });
      
      return normalized;
    });
  }

  /**
   * Built-in Validators
   */
  async _validateSchema(data, config) {
    const { schema } = config;
    
    for (const row of data) {
      for (const [field, rules] of Object.entries(schema)) {
        if (rules.required && !(field in row)) {
          return false;
        }
        
        if (field in row && rules.type && typeof row[field] !== rules.type) {
          return false;
        }
      }
    }
    
    return true;
  }

  async _validateUniqueness(data, config) {
    const { fields } = config;
    const seen = new Set();
    
    for (const row of data) {
      const key = fields.map(field => row[field]).join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
    }
    
    return true;
  }

  async _validateCompleteness(data, config) {
    const { threshold = 0.9, requiredFields } = config;
    
    for (const field of requiredFields) {
      const filledRows = data.filter(row => row[field] && row[field] !== '').length;
      const completeness = filledRows / data.length;
      
      if (completeness < threshold) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Built-in Loaders
   */
  async _loadToCSV(data, destination) {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    await fs.writeFile(destination.path, csvContent, 'utf8');
  }

  async _loadToJSON(data, destination) {
    await fs.writeFile(destination.path, JSON.stringify(data, null, 2), 'utf8');
  }

  async _loadToCollection(data, destination) {
    if (!this.database) {
      throw new Error('Database instance not available for collection loading');
    }

    for (const row of data) {
      await this.database.insert(destination.collection, row);
    }
  }

  async _loadToAPI(data, destination) {
    // API loading would require HTTP client implementation
    throw new Error('API loading not implemented yet');
  }

  /**
   * Pipeline scheduling
   */
  _schedulePipeline(pipeline) {
    if (this.scheduledJobs.has(pipeline.id)) {
      clearInterval(this.scheduledJobs.get(pipeline.id));
    }

    const interval = this._parseSchedule(pipeline.schedule);
    if (interval) {
      const job = setInterval(async () => {
        try {
          await this.executePipeline(pipeline.id);
        } catch (error) {
          console.error(`Scheduled pipeline '${pipeline.name}' failed:`, error.message);
        }
      }, interval);

      this.scheduledJobs.set(pipeline.id, job);
    }
  }

  _parseSchedule(schedule) {
    const schedules = {
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };

    return schedules[schedule] || null;
  }

  /**
   * Utility methods
   */
  getPipelines() {
    return Array.from(this.pipelines.values());
  }

  getPipeline(id) {
    return this.pipelines.get(id);
  }

  getActivePipelines() {
    return Array.from(this.activePipelines.values());
  }

  getJobHistory(limit = 50) {
    return this.jobHistory.slice(0, limit);
  }

  getStats() {
    return {
      ...this.stats,
      activePipelines: this.activePipelines.size,
      scheduledPipelines: this.scheduledJobs.size,
      totalPipelinesConfigured: this.pipelines.size
    };
  }

  /**
   * Set database instance for collection operations
   */
  setDatabase(database) {
    this.database = database;
  }

  /**
   * Cleanup and close
   */
  async close() {
    // Clear all scheduled jobs
    for (const job of this.scheduledJobs.values()) {
      clearInterval(job);
    }
    this.scheduledJobs.clear();

    // Cancel active pipelines
    this.activePipelines.clear();

    console.log('✅ ETL Engine closed');
  }

  // Private helper methods
  _generateId() {
    return `etl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _ensureDirectories() {
    try {
      await fs.mkdir(this.pipelinesPath, { recursive: true });
      await fs.mkdir(this.tempPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async _loadPipelines() {
    try {
      const files = await fs.readdir(this.pipelinesPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(join(this.pipelinesPath, file), 'utf8');
            const pipeline = JSON.parse(content);
            this.pipelines.set(pipeline.id, pipeline);
            
            if (pipeline.schedule && pipeline.enabled) {
              this._schedulePipeline(pipeline);
            }
          } catch (error) {
            console.warn(`Failed to load pipeline from ${file}:`, error.message);
          }
        }
      }
      
      this.stats.totalPipelines = this.pipelines.size;
      
    } catch (error) {
      // Directory doesn't exist or is empty
    }
  }

  async _savePipeline(pipeline) {
    const filePath = join(this.pipelinesPath, `${pipeline.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(pipeline, null, 2), 'utf8');
  }

  _calculateAverageRunTime(pipeline) {
    // This would calculate based on job history
    return 0; // Placeholder
  }

  _startScheduler() {
    // Scheduler is already handled by individual pipeline scheduling
    console.log('📅 ETL Scheduler started');
  }

  _initializeBuiltInComponents() {
    // Initialize component registries
    this.transformers.clear();
    this.validators.clear();
    this.extractors.clear();
    this.loaders.clear();
  }

  /**
   * Shutdown ETL Engine
   */
  async shutdown() {
    console.log('🔄 Shutting down ETL Engine...');
    
    // Stop all active pipelines
    for (const [id, pipeline] of this.activePipelines) {
      try {
        await this.stopPipeline(id);
      } catch (error) {
        console.error(`Error stopping pipeline ${id}:`, error.message);
      }
    }
    
    // Clear scheduled jobs
    for (const [id, job] of this.scheduledJobs) {
      if (job.timer) {
        clearInterval(job.timer);
      }
    }
    
    // Clear data structures
    this.pipelines.clear();
    this.activePipelines.clear();
    this.scheduledJobs.clear();
    this.transformers.clear();
    this.validators.clear();
    this.extractors.clear();
    this.loaders.clear();
    
    console.log('✅ ETL Engine shutdown complete');
  }
}

export default ETLEngine;
