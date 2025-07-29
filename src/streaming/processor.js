/**
 * Stream Processing Engine for BigBaseAlpha  
 * Real-time data stream processing with windowing, aggregation, and transformations
 */

import { EventEmitter } from 'events';

export class StreamProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxStreams: options.maxStreams || 100,
      bufferSize: options.bufferSize || 10000,
      windowSize: options.windowSize || 5000, // 5 seconds
      checkInterval: options.checkInterval || 1000,
      enablePersistence: options.enablePersistence || true,
      watermarkDelay: options.watermarkDelay || 2000,
      parallelism: options.parallelism || 4,
      ...options
    };

    // Stream registry
    this.streams = new Map();
    this.processors = new Map();
    this.windows = new Map();
    this.watermarks = new Map();
    this.triggers = new Map();
    
    // State management
    this.state = new Map();
    this.checkpoints = new Map();
    
    // Metrics and monitoring
    this.metrics = {
      streamsCreated: 0,
      eventsProcessed: 0,
      windowsProcessed: 0,
      errorsOccurred: 0,
      avgProcessingTime: 0,
      throughput: 0,
      startTime: Date.now()
    };
    
    this.performanceHistory = [];
    this.isRunning = false;
    
    this.startPerformanceMonitoring();
  }

  /**
   * Create a new data stream
   */
  createStream(streamId, config = {}) {
    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }

    const stream = {
      id: streamId,
      config: {
        type: config.type || 'unbounded',
        format: config.format || 'json',
        schema: config.schema || null,
        partitions: config.partitions || 1,
        replication: config.replication || 1,
        retention: config.retention || 3600000, // 1 hour
        compression: config.compression || false,
        ...config
      },
      buffer: [],
      partitionBuffers: new Map(),
      processors: [],
      windows: [],
      state: new Map(),
      metrics: {
        eventsReceived: 0,
        eventsProcessed: 0,
        bytesProcessed: 0,
        lastEventTime: null,
        processingTime: 0
      },
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    // Initialize partitions
    for (let i = 0; i < stream.config.partitions; i++) {
      stream.partitionBuffers.set(i, []);
    }

    this.streams.set(streamId, stream);
    this.metrics.streamsCreated++;
    
    this.emit('streamCreated', { streamId, config: stream.config });
    return stream;
  }

  /**
   * Add processor to stream
   */
  addProcessor(streamId, processorConfig) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const processor = {
      id: processorConfig.id || `processor_${Date.now()}`,
      type: processorConfig.type, // 'map', 'filter', 'reduce', 'window', 'join'
      function: processorConfig.function,
      config: processorConfig.config || {},
      state: new Map(),
      metrics: {
        eventsProcessed: 0,
        processingTime: 0,
        errorsOccurred: 0
      },
      createdAt: Date.now()
    };

    stream.processors.push(processor);
    this.processors.set(processor.id, processor);
    
    this.emit('processorAdded', { streamId, processor });
    return processor;
  }

  /**
   * Create windowed stream
   */
  createWindow(streamId, windowConfig) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const window = {
      id: windowConfig.id || `window_${Date.now()}`,
      type: windowConfig.type, // 'tumbling', 'sliding', 'session'
      size: windowConfig.size || this.options.windowSize,
      slide: windowConfig.slide || windowConfig.size,
      sessionTimeout: windowConfig.sessionTimeout || 300000, // 5 minutes
      trigger: windowConfig.trigger || 'time',
      eviction: windowConfig.eviction || 'time',
      aggregation: windowConfig.aggregation || null,
      buffer: [],
      state: new Map(),
      lastTrigger: Date.now(),
      metrics: {
        windowsProcessed: 0,
        eventsAggregated: 0,
        avgWindowSize: 0
      },
      createdAt: Date.now()
    };

    stream.windows.push(window);
    this.windows.set(window.id, window);
    
    this.emit('windowCreated', { streamId, window });
    return window;
  }

  /**
   * Publish event to stream
   */
  async publish(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const startTime = Date.now();
    
    try {
      // Validate event against schema if defined
      if (stream.config.schema) {
        this.validateEvent(event, stream.config.schema);
      }

      // Add metadata to event
      const enrichedEvent = {
        ...event,
        _metadata: {
          streamId,
          timestamp: event.timestamp || Date.now(),
          eventId: event.eventId || `${streamId}_${Date.now()}_${Math.random()}`,
          partition: this.getPartition(event, stream.config.partitions),
          size: JSON.stringify(event).length
        }
      };

      // Add to stream buffer
      stream.buffer.push(enrichedEvent);
      
      // Add to partition buffer
      const partition = enrichedEvent._metadata.partition;
      stream.partitionBuffers.get(partition).push(enrichedEvent);

      // Update metrics
      stream.metrics.eventsReceived++;
      stream.metrics.bytesProcessed += enrichedEvent._metadata.size;
      stream.metrics.lastEventTime = enrichedEvent._metadata.timestamp;
      stream.lastActivity = Date.now();
      
      this.metrics.eventsProcessed++;

      // Process event through processors
      await this.processEvent(streamId, enrichedEvent);

      // Process through windows
      await this.processWindows(streamId, enrichedEvent);

      // Maintain buffer size
      if (stream.buffer.length > this.options.bufferSize) {
        stream.buffer.shift();
      }

      // Clean partition buffers
      stream.partitionBuffers.forEach((buffer, partitionId) => {
        if (buffer.length > this.options.bufferSize / stream.config.partitions) {
          buffer.shift();
        }
      });

      const processingTime = Date.now() - startTime;
      stream.metrics.processingTime += processingTime;
      
      this.updatePerformanceMetrics(processingTime);
      this.emit('eventPublished', { streamId, event: enrichedEvent, processingTime });
      
      return enrichedEvent._metadata.eventId;
    } catch (error) {
      this.metrics.errorsOccurred++;
      this.emit('publishError', { streamId, event, error });
      throw error;
    }
  }

  /**
   * Process event through stream processors
   */
  async processEvent(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.processors.length) return;

    let processedEvent = event;

    for (const processor of stream.processors) {
      try {
        const startTime = Date.now();
        
        switch (processor.type) {
          case 'map':
            processedEvent = await this.processMap(processor, processedEvent);
            break;
          case 'filter':
            const include = await this.processFilter(processor, processedEvent);
            if (!include) return; // Event filtered out
            break;
          case 'reduce':
            await this.processReduce(processor, processedEvent);
            break;
          case 'flatMap':
            const results = await this.processFlatMap(processor, processedEvent);
            for (const result of results) {
              this.emit('eventProcessed', { streamId, processor: processor.id, event: result });
            }
            return;
          default:
            console.warn(`Unknown processor type: ${processor.type}`);
        }

        const processingTime = Date.now() - startTime;
        processor.metrics.processingTime += processingTime;
        processor.metrics.eventsProcessed++;
        
      } catch (error) {
        processor.metrics.errorsOccurred++;
        this.emit('processingError', { streamId, processor: processor.id, event, error });
      }
    }

    this.emit('eventProcessed', { streamId, event: processedEvent });
  }

  /**
   * Process map transformation
   */
  async processMap(processor, event) {
    if (typeof processor.function === 'function') {
      return await processor.function(event);
    }
    return event;
  }

  /**
   * Process filter operation
   */
  async processFilter(processor, event) {
    if (typeof processor.function === 'function') {
      return await processor.function(event);
    }
    return true;
  }

  /**
   * Process reduce operation
   */
  async processReduce(processor, event) {
    const key = processor.config.keySelector ? processor.config.keySelector(event) : 'default';
    const currentValue = processor.state.get(key) || processor.config.initialValue;
    
    let newValue;
    if (typeof processor.function === 'function') {
      newValue = await processor.function(currentValue, event);
    } else {
      newValue = currentValue;
    }
    
    processor.state.set(key, newValue);
    
    this.emit('reduceResult', { 
      processor: processor.id, 
      key, 
      value: newValue, 
      event 
    });
  }

  /**
   * Process flatMap transformation
   */
  async processFlatMap(processor, event) {
    if (typeof processor.function === 'function') {
      return await processor.function(event);
    }
    return [event];
  }

  /**
   * Process windowed operations
   */
  async processWindows(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.windows.length) return;

    for (const window of stream.windows) {
      try {
        await this.processWindow(window, event);
      } catch (error) {
        this.emit('windowError', { streamId, window: window.id, event, error });
      }
    }
  }

  /**
   * Process single window
   */
  async processWindow(window, event) {
    const eventTime = event._metadata.timestamp;
    const currentTime = Date.now();

    // Add event to window buffer
    window.buffer.push({
      ...event,
      _windowMetadata: {
        arrivalTime: currentTime,
        eventTime: eventTime
      }
    });

    // Check if window should be triggered
    let shouldTrigger = false;
    
    switch (window.trigger) {
      case 'time':
        shouldTrigger = currentTime - window.lastTrigger >= window.size;
        break;
      case 'count':
        shouldTrigger = window.buffer.length >= window.size;
        break;
      case 'watermark':
        const watermark = this.getWatermark(event._metadata.streamId);
        shouldTrigger = watermark > window.lastTrigger + window.size;
        break;
    }

    if (shouldTrigger) {
      await this.triggerWindow(window);
    }

    // Evict old events based on eviction policy
    this.evictWindowEvents(window, currentTime);
  }

  /**
   * Trigger window computation
   */
  async triggerWindow(window) {
    if (window.buffer.length === 0) return;

    const startTime = Date.now();
    
    try {
      let result;
      
      if (window.aggregation) {
        result = await this.computeAggregation(window);
      } else {
        result = {
          windowId: window.id,
          events: [...window.buffer],
          count: window.buffer.length,
          timestamp: Date.now()
        };
      }

      window.metrics.windowsProcessed++;
      window.metrics.eventsAggregated += window.buffer.length;
      window.metrics.avgWindowSize = 
        (window.metrics.avgWindowSize + window.buffer.length) / 2;
      
      window.lastTrigger = Date.now();
      this.metrics.windowsProcessed++;

      this.emit('windowTriggered', {
        window: window.id,
        result,
        processingTime: Date.now() - startTime
      });

      // Clear or slide window buffer
      if (window.type === 'tumbling') {
        window.buffer = [];
      } else if (window.type === 'sliding') {
        const slideCount = Math.floor(window.buffer.length * window.slide / window.size);
        window.buffer.splice(0, slideCount);
      }

    } catch (error) {
      this.emit('windowError', { window: window.id, error });
    }
  }

  /**
   * Compute window aggregation
   */
  async computeAggregation(window) {
    const events = window.buffer;
    const aggregation = window.aggregation;
    
    switch (aggregation.type) {
      case 'sum':
        const sum = events.reduce((acc, event) => {
          return acc + this.getFieldValue(event, aggregation.field);
        }, 0);
        return { type: 'sum', field: aggregation.field, value: sum, count: events.length };
        
      case 'avg':
        const total = events.reduce((acc, event) => {
          return acc + this.getFieldValue(event, aggregation.field);
        }, 0);
        return { type: 'avg', field: aggregation.field, value: total / events.length, count: events.length };
        
      case 'min':
        const min = Math.min(...events.map(event => this.getFieldValue(event, aggregation.field)));
        return { type: 'min', field: aggregation.field, value: min, count: events.length };
        
      case 'max':
        const max = Math.max(...events.map(event => this.getFieldValue(event, aggregation.field)));
        return { type: 'max', field: aggregation.field, value: max, count: events.length };
        
      case 'count':
        return { type: 'count', value: events.length };
        
      case 'custom':
        if (typeof aggregation.function === 'function') {
          return await aggregation.function(events);
        }
        return { type: 'custom', value: events.length };
        
      default:
        throw new Error(`Unknown aggregation type: ${aggregation.type}`);
    }
  }

  /**
   * Get field value from event using dot notation
   */
  getFieldValue(event, fieldPath) {
    return fieldPath.split('.').reduce((obj, field) => obj?.[field], event) || 0;
  }

  /**
   * Evict old events from window
   */
  evictWindowEvents(window, currentTime) {
    if (window.eviction === 'time') {
      window.buffer = window.buffer.filter(event => {
        return currentTime - event._windowMetadata.arrivalTime < window.size;
      });
    } else if (window.eviction === 'count' && window.buffer.length > window.size) {
      window.buffer = window.buffer.slice(-window.size);
    }
  }

  /**
   * Get partition for event
   */
  getPartition(event, partitionCount) {
    if (event.partitionKey) {
      return this.hash(event.partitionKey) % partitionCount;
    }
    return Math.floor(Math.random() * partitionCount);
  }

  /**
   * Simple hash function
   */
  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Validate event against schema
   */
  validateEvent(event, schema) {
    // Simple schema validation (can be enhanced)
    for (const [field, type] of Object.entries(schema)) {
      if (schema.required && schema.required.includes(field) && !(field in event)) {
        throw new Error(`Required field missing: ${field}`);
      }
      
      if (field in event && typeof event[field] !== type) {
        throw new Error(`Field ${field} should be of type ${type}`);
      }
    }
  }

  /**
   * Get watermark for stream
   */
  getWatermark(streamId) {
    return this.watermarks.get(streamId) || 0;
  }

  /**
   * Update watermark for stream
   */
  updateWatermark(streamId, timestamp) {
    const currentWatermark = this.getWatermark(streamId);
    if (timestamp > currentWatermark) {
      this.watermarks.set(streamId, timestamp - this.options.watermarkDelay);
      this.emit('watermarkUpdated', { streamId, watermark: timestamp });
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      const now = Date.now();
      const timeWindow = 60000; // 1 minute
      
      // Calculate throughput
      const recentEvents = this.performanceHistory.filter(
        entry => now - entry.timestamp < timeWindow
      );
      
      this.metrics.throughput = recentEvents.length / (timeWindow / 1000);
      
      // Update average processing time
      if (recentEvents.length > 0) {
        this.metrics.avgProcessingTime = recentEvents.reduce(
          (sum, entry) => sum + entry.processingTime, 0
        ) / recentEvents.length;
      }

      // Clean old performance data
      this.performanceHistory = this.performanceHistory.filter(
        entry => now - entry.timestamp < timeWindow * 10
      );

      this.emit('performanceUpdate', this.getPerformanceMetrics());
    }, this.options.checkInterval);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(processingTime) {
    this.performanceHistory.push({
      timestamp: Date.now(),
      processingTime
    });
  }

  /**
   * Get stream by ID
   */
  getStream(streamId) {
    return this.streams.get(streamId);
  }

  /**
   * List all streams
   */
  listStreams() {
    return Array.from(this.streams.values());
  }

  /**
   * Delete stream
   */
  deleteStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return false;

    // Clean up processors
    for (const processor of stream.processors) {
      this.processors.delete(processor.id);
    }

    // Clean up windows
    for (const window of stream.windows) {
      this.windows.delete(window.id);
    }

    // Clean up checkpoints
    this.watermarks.delete(streamId);

    this.streams.delete(streamId);
    this.emit('streamDeleted', { streamId });
    
    return true;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    
    return {
      ...this.metrics,
      uptime,
      activeStreams: this.streams.size,
      activeProcessors: this.processors.size,
      activeWindows: this.windows.size,
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    };
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      streams: this.streams.size,
      processors: this.processors.size,
      windows: this.windows.size,
      metrics: this.getPerformanceMetrics(),
      uptime: Date.now() - this.metrics.startTime
    };
  }

  /**
   * Start the stream processing engine
   */
  start() {
    this.isRunning = true;
    this.emit('engineStarted');
  }

  /**
   * Stop the stream processing engine
   */
  async stop() {
    this.isRunning = false;
    this.emit('engineStopped');
  }

  /**
   * Get analytics for streams
   */
  getStreamAnalytics(timeRange = 3600000) {
    const since = Date.now() - timeRange;
    const analytics = {
      totalStreams: this.streams.size,
      activeStreams: 0,
      totalEvents: 0,
      totalProcessors: 0,
      totalWindows: 0,
      avgThroughput: 0,
      avgLatency: this.metrics.avgProcessingTime,
      errorRate: 0,
      topStreams: [],
      streamDetails: []
    };

    for (const [streamId, stream] of this.streams) {
      if (stream.lastActivity >= since) {
        analytics.activeStreams++;
      }
      
      analytics.totalEvents += stream.metrics.eventsReceived;
      analytics.totalProcessors += stream.processors.length;
      analytics.totalWindows += stream.windows.length;
      
      analytics.streamDetails.push({
        id: streamId,
        eventsReceived: stream.metrics.eventsReceived,
        eventsProcessed: stream.metrics.eventsProcessed,
        bytesProcessed: stream.metrics.bytesProcessed,
        processors: stream.processors.length,
        windows: stream.windows.length,
        lastActivity: stream.lastActivity,
        avgProcessingTime: stream.metrics.processingTime / Math.max(stream.metrics.eventsReceived, 1)
      });
    }

    // Sort streams by activity
    analytics.topStreams = analytics.streamDetails
      .sort((a, b) => b.eventsReceived - a.eventsReceived)
      .slice(0, 10);

    analytics.avgThroughput = this.metrics.throughput;
    analytics.errorRate = this.metrics.errorsOccurred / Math.max(this.metrics.eventsProcessed, 1);

    return analytics;
  }

  /**
   * Create a continuous query
   */
  createContinuousQuery(queryId, config) {
    const query = {
      id: queryId,
      streamId: config.streamId,
      condition: config.condition,
      transform: config.transform,
      windowSize: config.windowSize || 5000,
      outputStream: config.outputStream,
      active: true,
      metrics: {
        eventsMatched: 0,
        eventsEmitted: 0,
        lastExecution: null
      },
      createdAt: Date.now()
    };

    // Add as a special processor
    this.addProcessor(config.streamId, {
      id: queryId,
      type: 'continuous_query',
      function: async (event) => {
        if (query.condition(event)) {
          query.metrics.eventsMatched++;
          const transformedEvent = query.transform ? query.transform(event) : event;
          
          if (query.outputStream) {
            await this.publish(query.outputStream, transformedEvent);
          }
          
          query.metrics.eventsEmitted++;
          query.metrics.lastExecution = Date.now();
          
          this.emit('continuousQueryResult', { queryId, event: transformedEvent });
          return transformedEvent;
        }
        return event;
      },
      config: { queryConfig: query }
    });

    return query;
  }

  /**
   * Stream join operation
   */
  createStreamJoin(leftStreamId, rightStreamId, joinConfig) {
    const joinId = `join_${leftStreamId}_${rightStreamId}_${Date.now()}`;
    
    const joinProcessor = {
      id: joinId,
      type: 'join',
      leftStreamId,
      rightStreamId,
      config: {
        type: joinConfig.type || 'inner', // inner, left, right, full
        condition: joinConfig.condition,
        window: joinConfig.window || 10000, // 10 seconds
        outputStream: joinConfig.outputStream
      },
      state: {
        leftBuffer: [],
        rightBuffer: []
      },
      metrics: {
        leftEvents: 0,
        rightEvents: 0,
        joinedEvents: 0
      }
    };

    // Add join processor to both streams
    this.addProcessor(leftStreamId, {
      id: `${joinId}_left`,
      type: 'join_left',
      function: async (event) => {
        joinProcessor.state.leftBuffer.push({
          ...event,
          _joinTimestamp: Date.now()
        });
        joinProcessor.metrics.leftEvents++;
        
        // Clean old events
        const cutoff = Date.now() - joinProcessor.config.window;
        joinProcessor.state.leftBuffer = joinProcessor.state.leftBuffer.filter(
          e => e._joinTimestamp > cutoff
        );
        
        await this.performJoin(joinProcessor);
        return event;
      }
    });

    this.addProcessor(rightStreamId, {
      id: `${joinId}_right`,
      type: 'join_right',
      function: async (event) => {
        joinProcessor.state.rightBuffer.push({
          ...event,
          _joinTimestamp: Date.now()
        });
        joinProcessor.metrics.rightEvents++;
        
        // Clean old events
        const cutoff = Date.now() - joinProcessor.config.window;
        joinProcessor.state.rightBuffer = joinProcessor.state.rightBuffer.filter(
          e => e._joinTimestamp > cutoff
        );
        
        await this.performJoin(joinProcessor);
        return event;
      }
    });

    return joinProcessor;
  }

  /**
   * Perform join operation
   */
  async performJoin(joinProcessor) {
    const { leftBuffer, rightBuffer } = joinProcessor.state;
    const { condition, type, outputStream } = joinProcessor.config;

    for (const leftEvent of leftBuffer) {
      for (const rightEvent of rightBuffer) {
        if (condition(leftEvent, rightEvent)) {
          const joinedEvent = {
            _joinType: type,
            _joinTimestamp: Date.now(),
            left: leftEvent,
            right: rightEvent,
            ...leftEvent,
            ...rightEvent
          };

          if (outputStream) {
            await this.publish(outputStream, joinedEvent);
          }

          joinProcessor.metrics.joinedEvents++;
          this.emit('streamJoined', { 
            joinId: joinProcessor.id, 
            event: joinedEvent 
          });
        }
      }
    }
  }
}

export default StreamProcessor;
