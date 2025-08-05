/**
 * BigBaseAlpha - Event Sourcing & CQRS Engine
 * Enterprise-grade event sourcing with Command Query Responsibility Segregation
 * Provides complete audit trail, eventual consistency, and horizontal scalability
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class EventSourcingEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      eventStorePath: options.eventStorePath || './bigbase_data/events',
      snapshotPath: options.snapshotPath || './bigbase_data/snapshots',
      projectionPath: options.projectionPath || './bigbase_data/projections',
      snapshotFrequency: options.snapshotFrequency || 100, // Every 100 events
      maxEventAge: options.maxEventAge || 30 * 24 * 60 * 60 * 1000, // 30 days
      enableProjections: options.enableProjections !== false,
      enableSnapshots: options.enableSnapshots !== false,
      batchSize: options.batchSize || 1000,
      compressionLevel: options.compressionLevel || 6
    };
    
    // Event Store
    this.eventStore = new Map(); // streamId -> events[]
    this.eventIndex = new Map(); // eventId -> event
    this.streamVersions = new Map(); // streamId -> version
    
    // Command Handlers
    this.commandHandlers = new Map();
    this.eventHandlers = new Map();
    
    // Projections (Read Models)
    this.projections = new Map();
    this.projectionHandlers = new Map();
    
    // Snapshots
    this.snapshots = new Map(); // streamId -> snapshot
    
    // Sagas (Process Managers)
    this.sagas = new Map();
    this.sagaHandlers = new Map();
    
    // Statistics
    this.stats = {
      totalEvents: 0,
      totalCommands: 0,
      totalSnapshots: 0,
      totalProjections: 0,
      commandsPerSecond: 0,
      eventsPerSecond: 0,
      avgProcessingTime: 0,
      errorCount: 0,
      lastEventTime: Date.now(),
      uptime: Date.now()
    };
    
    this.initialized = false;
    this.isRunning = false;
  }

  /**
   * Initialize Event Sourcing Engine
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Create directories
      await this._ensureDirectories();
      
      // Load existing events
      await this._loadEventStore();
      
      // Load snapshots
      if (this.config.enableSnapshots) {
        await this._loadSnapshots();
      }
      
      // Load projections
      if (this.config.enableProjections) {
        await this._loadProjections();
      }
      
      // Register default command handlers
      this._registerDefaultHandlers();
      
      // Start background processes
      this._startBackgroundProcesses();
      
      this.initialized = true;
      this.isRunning = true;
      
      this.emit('initialized', {
        eventCount: this.stats.totalEvents,
        snapshotCount: this.stats.totalSnapshots,
        projectionCount: this.stats.totalProjections
      });
      
      console.log('✅ Event Sourcing Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Event Sourcing Engine:', error);
      throw error;
    }
  }

  /**
   * COMMAND SIDE - Execute Command
   */
  async executeCommand(command) {
    if (!this.initialized) {
      throw new Error('Event Sourcing Engine not initialized');
    }

    const commandId = crypto.randomUUID();
    const timestamp = Date.now();
    
    try {
      this.stats.totalCommands++;
      
      // Validate command
      this._validateCommand(command);
      
      // Get command handler
      const handler = this.commandHandlers.get(command.type);
      if (!handler) {
        throw new Error(`No handler found for command type: ${command.type}`);
      }
      
      // Load aggregate state
      const aggregateState = await this._loadAggregateState(
        command.aggregateId || command.streamId
      );
      
      // Execute command and get events
      const events = await handler(command, aggregateState);
      
      // Store events
      const storedEvents = await this._storeEvents(
        command.aggregateId || command.streamId,
        events,
        commandId
      );
      
      // Update projections
      if (this.config.enableProjections) {
        await this._updateProjections(storedEvents);
      }
      
      // Process sagas
      await this._processSagas(storedEvents);
      
      // Create snapshot if needed
      if (this.config.enableSnapshots) {
        await this._createSnapshotIfNeeded(command.aggregateId || command.streamId);
      }
      
      // Update statistics
      this._updateCommandStats(timestamp);
      
      this.emit('commandExecuted', {
        commandId,
        command,
        events: storedEvents,
        timestamp
      });
      
      return {
        success: true,
        commandId,
        events: storedEvents,
        version: this.streamVersions.get(command.aggregateId || command.streamId)
      };
      
    } catch (error) {
      this.stats.errorCount++;
      
      this.emit('commandFailed', {
        commandId,
        command,
        error: error.message,
        timestamp
      });
      
      throw error;
    }
  }

  /**
   * QUERY SIDE - Query Projection
   */
  async queryProjection(projectionName, query = {}) {
    if (!this.initialized) {
      throw new Error('Event Sourcing Engine not initialized');
    }

    try {
      const projection = this.projections.get(projectionName);
      if (!projection) {
        throw new Error(`Projection not found: ${projectionName}`);
      }
      
      // Apply query filters
      let result = projection.data;
      
      if (query.filter) {
        result = this._applyFilter(result, query.filter);
      }
      
      if (query.sort) {
        result = this._applySort(result, query.sort);
      }
      
      if (query.limit || query.offset) {
        result = this._applyPagination(result, query.limit, query.offset);
      }
      
      return {
        data: result,
        projection: projectionName,
        lastUpdated: projection.lastUpdated,
        version: projection.version,
        totalCount: Array.isArray(projection.data) ? projection.data.length : 1
      };
      
    } catch (error) {
      this.emit('queryFailed', {
        projectionName,
        query,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Get Event Stream
   */
  async getEventStream(streamId, fromVersion = 0, toVersion = null) {
    const events = this.eventStore.get(streamId) || [];
    
    let filteredEvents = events.filter(event => event.version > fromVersion);
    
    if (toVersion !== null) {
      filteredEvents = filteredEvents.filter(event => event.version <= toVersion);
    }
    
    return {
      streamId,
      events: filteredEvents,
      currentVersion: this.streamVersions.get(streamId) || 0,
      eventCount: filteredEvents.length
    };
  }

  /**
   * Replay Events
   */
  async replayEvents(streamId, fromVersion = 0) {
    const events = this.eventStore.get(streamId) || [];
    const replayEvents = events.filter(event => event.version >= fromVersion);
    
    let state = {};
    
    // Load snapshot if available
    if (this.config.enableSnapshots && fromVersion > 0) {
      const snapshot = await this._findSnapshot(streamId, fromVersion);
      if (snapshot) {
        state = snapshot.data;
        const filteredEvents = replayEvents.filter(event => event.version > snapshot.version);
        replayEvents.splice(0, replayEvents.length, ...filteredEvents);
      }
    }
    
    // Apply events
    for (const event of replayEvents) {
      state = await this._applyEvent(state, event);
    }
    
    return {
      streamId,
      state,
      version: this.streamVersions.get(streamId) || 0,
      eventsReplayed: replayEvents.length
    };
  }

  /**
   * Register Command Handler
   */
  registerCommandHandler(commandType, handler) {
    this.commandHandlers.set(commandType, handler);
    console.log(`📝 Registered command handler: ${commandType}`);
  }

  /**
   * Register Event Handler
   */
  registerEventHandler(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
    console.log(`📨 Registered event handler: ${eventType}`);
  }

  /**
   * Register Projection
   */
  registerProjection(name, initialState, handlers) {
    this.projections.set(name, {
      name,
      data: initialState,
      handlers,
      version: 0,
      lastUpdated: Date.now(),
      eventCount: 0
    });
    
    this.projectionHandlers.set(name, handlers);
    this.stats.totalProjections++;
    
    console.log(`📊 Registered projection: ${name}`);
  }

  /**
   * Register Saga
   */
  registerSaga(name, handlers) {
    this.sagas.set(name, {
      name,
      handlers,
      instances: new Map(), // sagaId -> state
      eventCount: 0
    });
    
    this.sagaHandlers.set(name, handlers);
    console.log(`🔄 Registered saga: ${name}`);
  }

  /**
   * Get Statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.stats.uptime;
    
    return {
      ...this.stats,
      uptime,
      streams: this.eventStore.size,
      projections: this.projections.size,
      sagas: this.sagas.size,
      commandHandlers: this.commandHandlers.size,
      eventHandlers: Array.from(this.eventHandlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
      averageEventsPerStream: this.eventStore.size > 0 ? this.stats.totalEvents / this.eventStore.size : 0,
      memoryUsage: {
        eventStore: this._calculateMemoryUsage(this.eventStore),
        projections: this._calculateMemoryUsage(this.projections),
        snapshots: this._calculateMemoryUsage(this.snapshots)
      }
    };
  }

  /**
   * Private Methods
   */
  async _ensureDirectories() {
    for (const dir of [this.config.eventStorePath, this.config.snapshotPath, this.config.projectionPath]) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _loadEventStore() {
    try {
      const files = await fs.readdir(this.config.eventStorePath);
      
      for (const file of files) {
        if (file.endsWith('.events.json')) {
          const streamId = file.replace('.events.json', '');
          const filePath = path.join(this.config.eventStorePath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const events = JSON.parse(content);
          
          this.eventStore.set(streamId, events);
          this.streamVersions.set(streamId, events.length > 0 ? Math.max(...events.map(e => e.version)) : 0);
          this.stats.totalEvents += events.length;
          
          // Index events
          events.forEach(event => {
            this.eventIndex.set(event.eventId, event);
          });
        }
      }
      
      console.log(`📚 Loaded ${this.stats.totalEvents} events from ${this.eventStore.size} streams`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async _loadSnapshots() {
    try {
      const files = await fs.readdir(this.config.snapshotPath);
      
      for (const file of files) {
        if (file.endsWith('.snapshot.json')) {
          const streamId = file.replace('.snapshot.json', '');
          const filePath = path.join(this.config.snapshotPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const snapshot = JSON.parse(content);
          
          this.snapshots.set(streamId, snapshot);
          this.stats.totalSnapshots++;
        }
      }
      
      console.log(`📸 Loaded ${this.stats.totalSnapshots} snapshots`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async _loadProjections() {
    try {
      const files = await fs.readdir(this.config.projectionPath);
      
      for (const file of files) {
        if (file.endsWith('.projection.json')) {
          const projectionName = file.replace('.projection.json', '');
          const filePath = path.join(this.config.projectionPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const projectionData = JSON.parse(content);
          
          if (this.projections.has(projectionName)) {
            const projection = this.projections.get(projectionName);
            projection.data = projectionData.data;
            projection.version = projectionData.version;
            projection.lastUpdated = projectionData.lastUpdated;
            projection.eventCount = projectionData.eventCount || 0;
          }
        }
      }
      
      console.log(`📊 Loaded ${this.projections.size} projections`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  _validateCommand(command) {
    if (!command || typeof command !== 'object') {
      throw new Error('Command must be an object');
    }
    
    if (!command.type) {
      throw new Error('Command must have a type');
    }
    
    if (!command.aggregateId && !command.streamId) {
      throw new Error('Command must have aggregateId or streamId');
    }
  }

  async _loadAggregateState(streamId) {
    // Try to load from snapshot first
    if (this.config.enableSnapshots) {
      const snapshot = this.snapshots.get(streamId);
      if (snapshot) {
        const events = this.eventStore.get(streamId) || [];
        const newEvents = events.filter(event => event.version > snapshot.version);
        
        let state = { ...snapshot.data };
        for (const event of newEvents) {
          state = await this._applyEvent(state, event);
        }
        
        return state;
      }
    }
    
    // Replay from events
    const events = this.eventStore.get(streamId) || [];
    let state = {};
    
    for (const event of events) {
      state = await this._applyEvent(state, event);
    }
    
    return state;
  }

  async _storeEvents(streamId, events, commandId) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    
    const currentVersion = this.streamVersions.get(streamId) || 0;
    const storedEvents = [];
    
    for (let i = 0; i < events.length; i++) {
      const event = {
        eventId: crypto.randomUUID(),
        streamId,
        version: currentVersion + i + 1,
        eventType: events[i].type,
        data: events[i].data || events[i],
        metadata: {
          ...events[i].metadata,
          commandId,
          timestamp: Date.now(),
          causationId: events[i].causationId,
          correlationId: events[i].correlationId
        }
      };
      
      storedEvents.push(event);
      this.eventIndex.set(event.eventId, event);
    }
    
    // Add to event store
    if (!this.eventStore.has(streamId)) {
      this.eventStore.set(streamId, []);
    }
    
    this.eventStore.get(streamId).push(...storedEvents);
    this.streamVersions.set(streamId, currentVersion + events.length);
    this.stats.totalEvents += events.length;
    this.stats.lastEventTime = Date.now();
    
    // Persist to disk
    await this._persistEventStream(streamId);
    
    // Emit events
    for (const event of storedEvents) {
      this.emit('eventStored', event);
      
      // Process event handlers
      const handlers = this.eventHandlers.get(event.eventType) || [];
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Event handler error for ${event.eventType}:`, error);
        }
      }
    }
    
    return storedEvents;
  }

  async _updateProjections(events) {
    for (const [projectionName, projection] of this.projections) {
      const handlers = this.projectionHandlers.get(projectionName);
      if (!handlers) continue;
      
      for (const event of events) {
        const handler = handlers[event.eventType];
        if (handler) {
          try {
            projection.data = await handler(projection.data, event);
            projection.version = event.version;
            projection.lastUpdated = Date.now();
            projection.eventCount++;
          } catch (error) {
            console.error(`Projection error for ${projectionName}:`, error);
          }
        }
      }
      
      // Persist projection
      await this._persistProjection(projectionName, projection);
    }
  }

  async _processSagas(events) {
    for (const [sagaName, saga] of this.sagas) {
      const handlers = this.sagaHandlers.get(sagaName);
      if (!handlers) continue;
      
      for (const event of events) {
        const handler = handlers[event.eventType];
        if (handler) {
          try {
            // Get or create saga instance
            const sagaId = event.metadata.correlationId || event.streamId;
            let sagaState = saga.instances.get(sagaId) || {};
            
            // Process event
            const result = await handler(sagaState, event);
            
            if (result) {
              if (result.state) {
                saga.instances.set(sagaId, result.state);
              }
              
              if (result.commands) {
                for (const command of result.commands) {
                  await this.executeCommand(command);
                }
              }
              
              if (result.completed) {
                saga.instances.delete(sagaId);
              }
            }
            
            saga.eventCount++;
            
          } catch (error) {
            console.error(`Saga error for ${sagaName}:`, error);
          }
        }
      }
    }
  }

  async _createSnapshotIfNeeded(streamId) {
    const events = this.eventStore.get(streamId) || [];
    const currentVersion = this.streamVersions.get(streamId) || 0;
    
    const lastSnapshot = this.snapshots.get(streamId);
    const lastSnapshotVersion = lastSnapshot ? lastSnapshot.version : 0;
    
    if (currentVersion - lastSnapshotVersion >= this.config.snapshotFrequency) {
      const state = await this._loadAggregateState(streamId);
      
      const snapshot = {
        streamId,
        version: currentVersion,
        data: state,
        timestamp: Date.now()
      };
      
      this.snapshots.set(streamId, snapshot);
      await this._persistSnapshot(streamId, snapshot);
      
      this.emit('snapshotCreated', snapshot);
    }
  }

  async _applyEvent(state, event) {
    // Default event application - can be overridden
    return {
      ...state,
      lastEventType: event.eventType,
      lastEventTime: event.metadata.timestamp,
      version: event.version
    };
  }

  _applyFilter(data, filter) {
    if (!Array.isArray(data)) return data;
    
    return data.filter(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  _applySort(data, sort) {
    if (!Array.isArray(data)) return data;
    
    return [...data].sort((a, b) => {
      for (const [key, direction] of Object.entries(sort)) {
        const aVal = a[key];
        const bVal = b[key];
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  _applyPagination(data, limit, offset = 0) {
    if (!Array.isArray(data)) return data;
    
    return data.slice(offset, offset + (limit || data.length));
  }

  async _persistEventStream(streamId) {
    const events = this.eventStore.get(streamId) || [];
    const filePath = path.join(this.config.eventStorePath, `${streamId}.events.json`);
    await fs.writeFile(filePath, JSON.stringify(events, null, 2));
  }

  async _persistSnapshot(streamId, snapshot) {
    const filePath = path.join(this.config.snapshotPath, `${streamId}.snapshot.json`);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2));
  }

  async _persistProjection(name, projection) {
    const filePath = path.join(this.config.projectionPath, `${name}.projection.json`);
    const data = {
      name,
      data: projection.data,
      version: projection.version,
      lastUpdated: projection.lastUpdated,
      eventCount: projection.eventCount
    };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async _findSnapshot(streamId, beforeVersion) {
    const snapshot = this.snapshots.get(streamId);
    return snapshot && snapshot.version < beforeVersion ? snapshot : null;
  }

  _calculateMemoryUsage(obj) {
    return JSON.stringify(obj).length * 2; // Rough estimate
  }

  _updateCommandStats(startTime) {
    const duration = Date.now() - startTime;
    this.stats.avgProcessingTime = (this.stats.avgProcessingTime + duration) / 2;
    
    // Calculate operations per second
    const now = Date.now();
    const timeWindow = 1000; // 1 second
    this.stats.commandsPerSecond = this.stats.totalCommands / ((now - this.stats.uptime) / 1000);
    this.stats.eventsPerSecond = this.stats.totalEvents / ((now - this.stats.uptime) / 1000);
  }

  _registerDefaultHandlers() {
    // Register default CRUD command handlers
    this.registerCommandHandler('CreateEntity', async (command, state) => {
      return [{
        type: 'EntityCreated',
        data: {
          entityId: command.aggregateId,
          entityType: command.entityType,
          data: command.data,
          createdAt: Date.now()
        }
      }];
    });

    this.registerCommandHandler('UpdateEntity', async (command, state) => {
      return [{
        type: 'EntityUpdated',
        data: {
          entityId: command.aggregateId,
          changes: command.changes,
          updatedAt: Date.now()
        }
      }];
    });

    this.registerCommandHandler('DeleteEntity', async (command, state) => {
      return [{
        type: 'EntityDeleted',
        data: {
          entityId: command.aggregateId,
          deletedAt: Date.now()
        }
      }];
    });

    console.log('📝 Default command handlers registered');
  }

  _startBackgroundProcesses() {
    // Event cleanup process
    setInterval(() => {
      this._cleanupOldEvents();
    }, 60000); // Every minute

    // Statistics update
    setInterval(() => {
      this.emit('statisticsUpdated', this.getStatistics());
    }, 5000); // Every 5 seconds

    console.log('🔄 Background processes started');
  }

  async _cleanupOldEvents() {
    const cutoffTime = Date.now() - this.config.maxEventAge;
    let cleanedEvents = 0;

    for (const [streamId, events] of this.eventStore) {
      const filteredEvents = events.filter(event => 
        event.metadata.timestamp > cutoffTime
      );
      
      if (filteredEvents.length !== events.length) {
        cleanedEvents += events.length - filteredEvents.length;
        this.eventStore.set(streamId, filteredEvents);
        await this._persistEventStream(streamId);
      }
    }

    if (cleanedEvents > 0) {
      console.log(`🧹 Cleaned up ${cleanedEvents} old events`);
      this.emit('eventsCleanedUp', { count: cleanedEvents });
    }
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    this.isRunning = false;
    
    // Persist all data
    for (const streamId of this.eventStore.keys()) {
      await this._persistEventStream(streamId);
    }
    
    for (const [name, projection] of this.projections) {
      await this._persistProjection(name, projection);
    }
    
    console.log('🛑 Event Sourcing Engine shutdown complete');
    this.emit('shutdown');
  }
}

// Helper Classes

export class Command {
  constructor(type, aggregateId, data, metadata = {}) {
    this.type = type;
    this.aggregateId = aggregateId;
    this.data = data;
    this.metadata = {
      ...metadata,
      commandId: crypto.randomUUID(),
      timestamp: Date.now()
    };
  }
}

export class Event {
  constructor(type, data, metadata = {}) {
    this.type = type;
    this.data = data;
    this.metadata = metadata;
  }
}

export class Aggregate {
  constructor(id) {
    this.id = id;
    this.version = 0;
    this.uncommittedEvents = [];
  }

  applyEvent(event) {
    // Override in subclasses
    this.version++;
  }

  addEvent(event) {
    this.uncommittedEvents.push(event);
    this.applyEvent(event);
  }

  getUncommittedEvents() {
    return [...this.uncommittedEvents];
  }

  clearUncommittedEvents() {
    this.uncommittedEvents = [];
  }
}

// Add missing setDatabase method to EventSourcingEngine
EventSourcingEngine.prototype.setDatabase = function(database) {
  this.database = database;
  console.log('🔗 Event Sourcing Engine linked to database');
};

export default EventSourcingEngine;
