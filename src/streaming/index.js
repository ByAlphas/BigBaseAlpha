import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import crypto from 'crypto';

/**
 * BigBaseAlpha Real-time Data Streaming Engine
 * WebSocket-based real-time data streaming with event-driven architecture
 */
export class StreamingEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Logger setup (fallback to default if not provided)
    this.logger = config.logger || {
      info: (...args) => console.log('[INFO] [STREAMING]', ...args),
      warn: (...args) => console.warn('[WARN] [STREAMING]', ...args),
      error: (...args) => console.error('[ERROR] [STREAMING]', ...args),
      success: (...args) => console.log('[SUCCESS] [STREAMING]', ...args),
      debug: (...args) => console.log('[DEBUG] [STREAMING]', ...args)
    };
    
    this.config = {
      port: config.streamingPort || 8080,
      maxConnections: config.maxConnections || 1000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      bufferSize: config.bufferSize || 1000,
      enableCompression: config.enableCompression !== false,
      enableAuth: config.enableAuth || false,
      rateLimitPerSecond: config.rateLimitPerSecond || 100,
      ...config
    };

    // WebSocket server
    this.wss = null;
    this.database = null;
    this._shouldStart = false;
    
    // Connection management
    this.connections = new Map();
    this.channels = new Map();
    this.subscriptions = new Map();
    
    // Event streams
    this.eventBuffer = [];
    this.dataStreams = new Map();
    this.realtimeQueries = new Map();
    
    // Rate limiting
    this.rateLimits = new Map();
    
    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      dataTransferred: 0,
      eventsStreamed: 0,
      startTime: null
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the streaming engine
   */
  async init() {
    try {
      this.stats.startTime = new Date();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({
        port: this.config.port,
        perMessageDeflate: this.config.enableCompression
      });

      // Setup WebSocket event handlers
      this.wss.on('connection', (ws, request) => {
        this._handleConnection(ws, request);
      });

      // Start background tasks
      this._startHeartbeat();
      this._startStatsCollection();
      this._startEventProcessor();

      this.isInitialized = true;
      this.logger.success(`Streaming Engine initialized on port ${this.config.port}`);
      this.emit('initialized');

    } catch (error) {
      throw new Error(`Failed to initialize Streaming Engine: ${error.message}`);
    }
  }

  /**
   * Set database instance
   */
  setDatabase(database) {
    this.database = database;
    
    // Subscribe to database events
    if (this.database) {
      this.database.on('insert', (data) => this._broadcastEvent('insert', data));
      this.database.on('update', (data) => this._broadcastEvent('update', data));
      this.database.on('delete', (data) => this._broadcastEvent('delete', data));
      this.database.on('collection:created', (data) => this._broadcastEvent('collection:created', data));
    }
  }

  /**
   * Handle new WebSocket connection
   */
  _handleConnection(ws, request) {
    const connectionId = this._generateId();
    const clientIP = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    
    // Create connection object
    const connection = {
      id: connectionId,
      ws,
      ip: clientIP,
      connectedAt: new Date(),
      authenticated: false,
      subscriptions: new Set(),
      rateLimitCount: 0,
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    console.log(`[WEBSOCKET] New WebSocket connection: ${connectionId} from ${clientIP}`);

    // Setup message handler
    ws.on('message', (data) => {
      this._handleMessage(connectionId, data);
    });

    // Setup close handler
    ws.on('close', () => {
      this._handleDisconnection(connectionId);
    });

    // Setup error handler
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error);
      this._handleDisconnection(connectionId);
    });

    // Send welcome message
    this._sendToConnection(connectionId, {
      type: 'welcome',
      connectionId,
      timestamp: new Date().toISOString(),
      features: ['realtime-data', 'live-queries', 'event-streaming']
    });

    this.emit('connection', { connectionId, clientIP });
  }

  /**
   * Handle WebSocket message
   */
  _handleMessage(connectionId, data) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // Rate limiting
      if (!this._checkRateLimit(connectionId)) {
        this._sendToConnection(connectionId, {
          type: 'error',
          message: 'Rate limit exceeded'
        });
        return;
      }

      connection.lastActivity = new Date();
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'auth':
          this._handleAuth(connectionId, message);
          break;
          
        case 'subscribe':
          this._handleSubscribe(connectionId, message);
          break;
          
        case 'unsubscribe':
          this._handleUnsubscribe(connectionId, message);
          break;
          
        case 'query':
          this._handleLiveQuery(connectionId, message);
          break;
          
        case 'ping':
          this._sendToConnection(connectionId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
          
        default:
          this._sendToConnection(connectionId, {
            type: 'error',
            message: `Unknown message type: ${message.type}`
          });
      }

    } catch (error) {
      console.error(`Message handling error for ${connectionId}:`, error);
      this._sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  /**
   * Handle authentication
   */
  _handleAuth(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    const { token } = message;
    // Add your authentication logic here
    if (token === 'valid-token') {
      connection.authenticated = true;
      this._sendToConnection(connectionId, {
        type: 'auth',
        status: 'success'
      });
    } else {
      this._sendToConnection(connectionId, {
        type: 'auth',
        status: 'failed'
      });
    }
  }

  async init() {
    if (!this._shouldStart) {
      // Streaming engine is disabled by default
      return;
    }
    try {
      this.stats.startTime = new Date();
      // Create WebSocket server
      this.wss = new WebSocketServer({
        port: this.config.port,
        perMessageDeflate: this.config.enableCompression
      });
      // Setup WebSocket event handlers
      this.wss.on('connection', (ws, request) => {
        this._handleConnection(ws, request);
      });
      // Start background tasks
      this._startHeartbeat();
      this._startStatsCollection();
      this._startEventProcessor();
      this.isInitialized = true;
      console.log(`[SUCCESS] Streaming Engine initialized on port ${this.config.port}`);
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize Streaming Engine:', error);
      throw error;
    }
  }

  // Explicitly start streaming server
  async startStreaming() {
    this._shouldStart = true;
    await this.init();
  }

  /**
   * Handle subscription to data channels
   */
  _handleSubscribe(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (this.config.enableAuth && !connection.authenticated) {
      this._sendToConnection(connectionId, {
        type: 'error',
        message: 'Authentication required'
      });
      return;
    }

    const { channel, filter } = message;
    
    // Add to subscriptions
    connection.subscriptions.add(channel);
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel).add(connectionId);

    // Store filter if provided
    if (filter) {
      connection.filters = connection.filters || {};
      connection.filters[channel] = filter;
    }

    this._sendToConnection(connectionId, {
      type: 'subscribed',
      channel,
      message: `Subscribed to ${channel}`
    });

    console.log(`📡 Connection ${connectionId} subscribed to ${channel}`);
  }

  /**
   * Handle unsubscription
   */
  _handleUnsubscribe(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { channel } = message;
    
    connection.subscriptions.delete(channel);
    
    if (this.subscriptions.has(channel)) {
      this.subscriptions.get(channel).delete(connectionId);
    }

    this._sendToConnection(connectionId, {
      type: 'unsubscribed',
      channel,
      message: `Unsubscribed from ${channel}`
    });
  }

  /**
   * Handle live query setup
   */
  async _handleLiveQuery(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!this.database) {
      this._sendToConnection(connectionId, {
        type: 'error',
        message: 'Database not available'
      });
      return;
    }

    try {
      const { queryId, collection, query, options } = message;
      
      // Execute initial query
      const results = await this.database.find(collection, query, options);
      
      // Store live query
      this.realtimeQueries.set(queryId, {
        connectionId,
        collection,
        query,
        options,
        lastResults: results,
        createdAt: new Date()
      });

      // Send initial results
      this._sendToConnection(connectionId, {
        type: 'query_results',
        queryId,
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this._sendToConnection(connectionId, {
        type: 'query_error',
        message: error.message
      });
    }
  }

  /**
   * Broadcast event to subscribed connections
   */
  _broadcastEvent(eventType, data) {
    const event = {
      type: 'data_event',
      eventType,
      data,
      timestamp: new Date().toISOString()
    };

    // Add to event buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.config.bufferSize) {
      this.eventBuffer.shift();
    }

    // Broadcast to relevant subscriptions
    const channelName = `${data.collection || 'system'}:${eventType}`;
    this._broadcastToChannel(channelName, event);
    this._broadcastToChannel('all', event);

    this.stats.eventsStreamed++;
  }

  /**
   * Broadcast message to specific channel
   */
  _broadcastToChannel(channel, message) {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        // Apply filters if any
        if (this._passesFilter(connection, channel, message)) {
          this._sendToConnection(connectionId, message);
        }
      }
    }
  }

  /**
   * Check if message passes connection filters
   */
  _passesFilter(connection, channel, message) {
    if (!connection.filters || !connection.filters[channel]) {
      return true;
    }

    const filter = connection.filters[channel];
    // Implement filter logic based on your needs
    // Example: filter by collection, event type, etc.
    
    return true; // Simplified for now
  }

  /**
   * Send message to specific connection
   */
  _sendToConnection(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        const data = JSON.stringify(message);
        connection.ws.send(data);
        this.stats.dataTransferred += data.length;
      } catch (error) {
        console.error(`Failed to send message to ${connectionId}:`, error);
        this._handleDisconnection(connectionId);
      }
    }
  }

  /**
   * Handle connection disconnection
   */
  _handleDisconnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from all subscriptions
    for (const channel of connection.subscriptions) {
      if (this.subscriptions.has(channel)) {
        this.subscriptions.get(channel).delete(connectionId);
      }
    }

    // Remove live queries
    for (const [queryId, queryInfo] of this.realtimeQueries) {
      if (queryInfo.connectionId === connectionId) {
        this.realtimeQueries.delete(queryId);
      }
    }

    this.connections.delete(connectionId);
    this.stats.activeConnections--;

    console.log(`🔌 WebSocket disconnected: ${connectionId}`);
    this.emit('disconnection', { connectionId });
  }

  /**
   * Rate limiting check
   */
  _checkRateLimit(connectionId) {
    const now = Date.now();
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const windowStart = Math.floor(now / 1000);
    const key = `${connectionId}:${windowStart}`;
    
    const current = this.rateLimits.get(key) || 0;
    if (current >= this.config.rateLimitPerSecond) {
      return false;
    }
    
    this.rateLimits.set(key, current + 1);
    
    // Clean up old rate limit entries
    setTimeout(() => {
      this.rateLimits.delete(key);
    }, 2000);
    
    return true;
  }

  /**
   * Start heartbeat system
   */
  _startHeartbeat() {
    setInterval(() => {
      const now = new Date();
      for (const [connectionId, connection] of this.connections) {
        // Check for stale connections
        const timeSinceActivity = now - connection.lastActivity;
        if (timeSinceActivity > this.config.heartbeatInterval * 2) {
          console.log(`🔌 Closing stale connection: ${connectionId}`);
          connection.ws.close();
          continue;
        }

        // Send heartbeat
        if (connection.ws.readyState === WebSocket.OPEN) {
          this._sendToConnection(connectionId, {
            type: 'heartbeat',
            timestamp: now.toISOString()
          });
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Start statistics collection
   */
  _startStatsCollection() {
    let lastMessageCount = 0;
    
    setInterval(() => {
      const currentMessages = this.stats.eventsStreamed;
      this.stats.messagesPerSecond = currentMessages - lastMessageCount;
      lastMessageCount = currentMessages;
    }, 1000);
  }

  /**
   * Start event processor for live queries
   */
  _startEventProcessor() {
    setInterval(async () => {
      if (!this.database) return;

      // Process live queries
      for (const [queryId, queryInfo] of this.realtimeQueries) {
        try {
          const newResults = await this.database.find(
            queryInfo.collection,
            queryInfo.query,
            queryInfo.options
          );

          // Check if results changed
          if (JSON.stringify(newResults) !== JSON.stringify(queryInfo.lastResults)) {
            queryInfo.lastResults = newResults;
            
            this._sendToConnection(queryInfo.connectionId, {
              type: 'query_update',
              queryId,
              results: newResults,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          this._sendToConnection(queryInfo.connectionId, {
            type: 'query_error',
            queryId,
            message: error.message
          });
        }
      }
    }, 1000); // Check every second
  }

  /**
   * Create data stream
   */
  createStream(name, source, options = {}) {
    const stream = {
      id: this._generateId(),
      name,
      source,
      options,
      active: true,
      subscribers: new Set(),
      stats: {
        messagesProcessed: 0,
        lastMessage: null,
        createdAt: new Date()
      }
    };

    this.dataStreams.set(stream.id, stream);
    return stream;
  }

  /**
   * Get streaming statistics
   */
  getStats() {
    return {
      ...this.stats,
      connections: {
        total: this.stats.totalConnections,
        active: this.stats.activeConnections,
        byChannel: Array.from(this.subscriptions.entries()).map(([channel, subs]) => ({
          channel,
          subscribers: subs.size
        }))
      },
      streams: {
        total: this.dataStreams.size,
        active: Array.from(this.dataStreams.values()).filter(s => s.active).length
      },
      queries: {
        live: this.realtimeQueries.size
      },
      performance: {
        messagesPerSecond: this.stats.messagesPerSecond,
        dataTransferred: this.stats.dataTransferred,
        uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
      }
    };
  }

  /**
   * Get active connections
   */
  getConnections() {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      ip: conn.ip,
      connectedAt: conn.connectedAt,
      authenticated: conn.authenticated,
      subscriptions: Array.from(conn.subscriptions),
      lastActivity: conn.lastActivity
    }));
  }

  /**
   * Close streaming engine
   */
  async close() {
    if (this.wss) {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.ws.close();
      }

      // Close server
      this.wss.close();
      this.logger.success('Streaming Engine closed');
    }
  }

  /**
   * Shutdown streaming engine
   */
  async shutdown() {
    console.log('[SHUTDOWN] Shutting down Streaming Engine...');
    
    // Close all connections
    for (const [id, connection] of this.connections) {
      if (connection.ws && connection.ws.readyState === 1) {
        connection.ws.close();
      }
    }
    
    // Clear data structures
    this.connections.clear();
    this.channels.clear();
    this.subscriptions.clear();
    this.dataStreams.clear();
    this.realtimeQueries.clear();
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    this.logger.success('Streaming Engine shutdown complete');
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `stream_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}

export default StreamingEngine;
