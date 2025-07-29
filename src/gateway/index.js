import { EventEmitter } from 'events';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import crypto from 'crypto';

/**
 * BigBaseAlpha API Gateway & Microservices Engine
 * Advanced API gateway with load balancing, authentication, rate limiting
 */
export class APIGateway extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.gatewayPort || 3001,
      httpsPort: config.httpsPort || 3443,
      enableHTTPS: config.enableHTTPS || false,
      enableLoadBalancing: config.enableLoadBalancing !== false,
      enableRateLimiting: config.enableRateLimiting !== false,
      enableCaching: config.enableCaching !== false,
      enableAuth: config.enableAuth !== false,
      defaultRateLimit: config.defaultRateLimit || 100, // per minute
      cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
      healthCheckInterval: config.healthCheckInterval || 30000,
      requestTimeout: config.requestTimeout || 30000,
      ...config
    };

    this.database = null;
    
    // HTTP servers
    this.httpServer = null;
    this.httpsServer = null;
    
    // Service registry
    this.services = new Map();
    this.routes = new Map();
    this.middlewares = [];
    
    // Load balancing
    this.loadBalancers = new Map();
    
    // Rate limiting
    this.rateLimits = new Map();
    
    // Caching
    this.cache = new Map();
    
    // Authentication
    this.authTokens = new Map();
    this.apiKeys = new Map();
    
    // Health monitoring
    this.healthChecks = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cachedResponses: 0,
      rateLimitedRequests: 0,
      startTime: null
    };

    this.isInitialized = false;
  }

  /**
   * Initialize API Gateway
   */
  async init() {
    try {
      this.stats.startTime = new Date();
      
      // Create HTTP server
      this.httpServer = http.createServer((req, res) => {
        this._handleRequest(req, res);
      });

      // Create HTTPS server if enabled
      if (this.config.enableHTTPS) {
        // Note: In production, load SSL certificates
        this.httpsServer = https.createServer({
          // key: fs.readFileSync('private-key.pem'),
          // cert: fs.readFileSync('certificate.pem')
        }, (req, res) => {
          this._handleRequest(req, res);
        });
      }

      // Initialize built-in services
      this._initializeBuiltInServices();
      
      // Start health checks
      this._startHealthChecks();
      
      // Start servers
      await this._startServers();
      
      this.isInitialized = true;
      console.log(`✅ API Gateway initialized on port ${this.config.port}`);
      this.emit('initialized');

    } catch (error) {
      throw new Error(`Failed to initialize API Gateway: ${error.message}`);
    }
  }

  /**
   * Set database instance
   */
  setDatabase(database) {
    this.database = database;
  }

  /**
   * Register microservice
   */
  registerService(name, config) {
    const serviceId = this._generateId();
    
    const service = {
      id: serviceId,
      name,
      config: {
        url: config.url,
        healthCheck: config.healthCheck || `${config.url}/health`,
        version: config.version || '1.0.0',
        timeout: config.timeout || this.config.requestTimeout,
        retries: config.retries || 3,
        weight: config.weight || 1,
        ...config
      },
      status: 'unknown',
      lastHealthCheck: null,
      registeredAt: new Date(),
      stats: {
        requests: 0,
        errors: 0,
        averageResponseTime: 0
      }
    };

    this.services.set(serviceId, service);
    
    // Create load balancer if multiple instances
    if (!this.loadBalancers.has(name)) {
      this.loadBalancers.set(name, {
        algorithm: 'round-robin',
        services: [],
        currentIndex: 0
      });
    }
    
    this.loadBalancers.get(name).services.push(serviceId);
    
    console.log(`🔗 Service registered: ${name} (${serviceId})`);
    this.emit('serviceRegistered', { name, serviceId, service });
    
    return serviceId;
  }

  /**
   * Register API route
   */
  registerRoute(path, config) {
    const route = {
      path,
      method: config.method || 'GET',
      service: config.service,
      target: config.target,
      middleware: config.middleware || [],
      rateLimit: config.rateLimit || this.config.defaultRateLimit,
      auth: config.auth || false,
      cache: config.cache || false,
      timeout: config.timeout || this.config.requestTimeout,
      createdAt: new Date()
    };

    const routeKey = `${route.method}:${path}`;
    this.routes.set(routeKey, route);
    
    console.log(`📍 Route registered: ${route.method} ${path} → ${config.service || config.target}`);
    return routeKey;
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Handle incoming request
   */
  async _handleRequest(req, res) {
    const startTime = Date.now();
    const requestId = this._generateId();
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('X-Request-ID', requestId);
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    this.stats.totalRequests++;

    try {
      // Find matching route
      const route = this._findRoute(req.method, req.url);
      if (!route) {
        return this._sendError(res, 404, 'Route not found');
      }

      // Apply middlewares
      for (const middleware of this.middlewares.concat(route.middleware)) {
        const result = await middleware(req, res);
        if (result === false) return; // Middleware blocked the request
      }

      // Check authentication
      if (route.auth && !await this._checkAuth(req)) {
        return this._sendError(res, 401, 'Authentication required');
      }

      // Check rate limiting
      if (this.config.enableRateLimiting && !this._checkRateLimit(req, route)) {
        this.stats.rateLimitedRequests++;
        return this._sendError(res, 429, 'Rate limit exceeded');
      }

      // Check cache
      if (this.config.enableCaching && route.cache && req.method === 'GET') {
        const cached = this._getFromCache(req.url);
        if (cached) {
          this.stats.cachedResponses++;
          res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
          res.end(JSON.stringify(cached));
          return;
        }
      }

      // Proxy to target service
      const response = await this._proxyRequest(req, route);
      
      // Cache response if enabled
      if (this.config.enableCaching && route.cache && req.method === 'GET' && response.statusCode === 200) {
        this._saveToCache(req.url, response.data);
      }

      // Send response
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);

      this.stats.successfulRequests++;
      this._updateResponseTime(Date.now() - startTime);

    } catch (error) {
      console.error(`Gateway request error (${requestId}):`, error);
      this.stats.failedRequests++;
      this._sendError(res, 500, 'Internal gateway error');
    }
  }

  /**
   * Find matching route
   */
  _findRoute(method, url) {
    const urlObj = new URL(url, 'http://localhost');
    const pathname = urlObj.pathname;
    
    // Exact match first
    const exactKey = `${method}:${pathname}`;
    if (this.routes.has(exactKey)) {
      return this.routes.get(exactKey);
    }

    // Pattern matching
    for (const [routeKey, route] of this.routes) {
      const [routeMethod, routePath] = routeKey.split(':');
      if (routeMethod === method && this._matchPath(routePath, pathname)) {
        return route;
      }
    }

    return null;
  }

  /**
   * Match path patterns
   */
  _matchPath(pattern, path) {
    // Convert pattern to regex (simple implementation)
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/:\w+/g, '[^/]+');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Proxy request to target service
   */
  async _proxyRequest(req, route) {
    return new Promise((resolve, reject) => {
      let targetUrl;
      
      if (route.service) {
        // Load balance to service
        const serviceId = this._selectService(route.service);
        if (!serviceId) {
          return reject(new Error('No healthy service available'));
        }
        
        const service = this.services.get(serviceId);
        targetUrl = service.config.url;
      } else {
        targetUrl = route.target;
      }

      const url = new URL(req.url, targetUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: req.method,
        headers: { ...req.headers },
        timeout: route.timeout
      };

      // Remove host header to avoid conflicts
      delete options.headers.host;

      const protocol = url.protocol === 'https:' ? https : http;
      const proxyReq = protocol.request(options, (proxyRes) => {
        let body = '';
        
        proxyRes.on('data', chunk => {
          body += chunk;
        });
        
        proxyRes.on('end', () => {
          resolve({
            statusCode: proxyRes.statusCode,
            headers: proxyRes.headers,
            body,
            data: this._tryParseJSON(body)
          });
        });
      });

      proxyReq.on('error', reject);
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        reject(new Error('Request timeout'));
      });

      // Forward request body
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          proxyReq.write(body);
          proxyReq.end();
        });
      } else {
        proxyReq.end();
      }
    });
  }

  /**
   * Select service using load balancing
   */
  _selectService(serviceName) {
    const balancer = this.loadBalancers.get(serviceName);
    if (!balancer || balancer.services.length === 0) {
      return null;
    }

    // Round-robin algorithm
    const serviceId = balancer.services[balancer.currentIndex];
    balancer.currentIndex = (balancer.currentIndex + 1) % balancer.services.length;
    
    // Check if service is healthy
    const service = this.services.get(serviceId);
    if (!service || service.status !== 'healthy') {
      // Try next service
      const nextIndex = balancer.currentIndex;
      for (let i = 0; i < balancer.services.length; i++) {
        const nextServiceId = balancer.services[(nextIndex + i) % balancer.services.length];
        const nextService = this.services.get(nextServiceId);
        if (nextService && nextService.status === 'healthy') {
          return nextServiceId;
        }
      }
      return null; // No healthy services
    }

    return serviceId;
  }

  /**
   * Check authentication
   */
  async _checkAuth(req) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return this.authTokens.has(token);
    }

    if (apiKey) {
      return this.apiKeys.has(apiKey);
    }

    return false;
  }

  /**
   * Check rate limiting
   */
  _checkRateLimit(req, route) {
    const clientId = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const key = `${clientId}:${route.path}`;
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000; // 1-minute window

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 0, windowStart });
    }

    const limit = this.rateLimits.get(key);
    
    // Reset if new window
    if (limit.windowStart !== windowStart) {
      limit.count = 0;
      limit.windowStart = windowStart;
    }

    limit.count++;
    return limit.count <= route.rateLimit;
  }

  /**
   * Cache operations
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  _saveToCache(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.config.cacheTimeout
    });
  }

  /**
   * Initialize built-in services
   */
  _initializeBuiltInServices() {
    // Register database service routes
    this.registerRoute('/api/database/*', {
      method: 'GET',
      target: 'http://localhost:3000',
      auth: false,
      cache: true,
      rateLimit: 200
    });

    this.registerRoute('/api/database/*', {
      method: 'POST',
      target: 'http://localhost:3000',
      auth: true,
      rateLimit: 100
    });

    // Health check route
    this.registerRoute('/health', {
      method: 'GET',
      target: 'internal',
      auth: false,
      cache: false
    });

    // Gateway stats route
    this.registerRoute('/gateway/stats', {
      method: 'GET',
      target: 'internal',
      auth: true,
      cache: false
    });
  }

  /**
   * Start health checks
   */
  _startHealthChecks() {
    setInterval(() => {
      this._performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all services
   */
  async _performHealthChecks() {
    for (const [serviceId, service] of this.services) {
      try {
        const response = await this._makeHealthCheckRequest(service.config.healthCheck);
        service.status = response.statusCode === 200 ? 'healthy' : 'unhealthy';
      } catch (error) {
        service.status = 'unhealthy';
      }
      service.lastHealthCheck = new Date();
    }
  }

  /**
   * Make health check request
   */
  _makeHealthCheckRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, resolve);
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });
    });
  }

  /**
   * Start HTTP/HTTPS servers
   */
  async _startServers() {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.port, (err) => {
        if (err) reject(err);
        else {
          console.log(`🚀 API Gateway HTTP server running on port ${this.config.port}`);
          
          if (this.config.enableHTTPS && this.httpsServer) {
            this.httpsServer.listen(this.config.httpsPort, (err) => {
              if (err) reject(err);
              else {
                console.log(`🔒 API Gateway HTTPS server running on port ${this.config.httpsPort}`);
                resolve();
              }
            });
          } else {
            resolve();
          }
        }
      });
    });
  }

  /**
   * Send error response
   */
  _sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: message,
      statusCode,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Update response time statistics
   */
  _updateResponseTime(responseTime) {
    const currentAvg = this.stats.averageResponseTime;
    const totalRequests = this.stats.totalRequests;
    this.stats.averageResponseTime = (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Try to parse JSON
   */
  _tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Generate API key
   */
  generateAPIKey(name, permissions = []) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    this.apiKeys.set(apiKey, {
      name,
      permissions,
      createdAt: new Date(),
      lastUsed: null
    });
    return apiKey;
  }

  /**
   * Generate auth token
   */
  generateAuthToken(userId, expiresIn = 3600000) {
    const token = crypto.randomBytes(32).toString('base64');
    this.authTokens.set(token, {
      userId,
      expiresAt: Date.now() + expiresIn,
      createdAt: new Date()
    });
    return token;
  }

  /**
   * Get gateway statistics
   */
  getStats() {
    return {
      ...this.stats,
      services: {
        total: this.services.size,
        healthy: Array.from(this.services.values()).filter(s => s.status === 'healthy').length,
        unhealthy: Array.from(this.services.values()).filter(s => s.status === 'unhealthy').length
      },
      routes: {
        total: this.routes.size
      },
      cache: {
        size: this.cache.size,
        hitRate: this.stats.cachedResponses / Math.max(this.stats.totalRequests, 1) * 100
      },
      loadBalancers: {
        total: this.loadBalancers.size
      }
    };
  }

  /**
   * Get registered services
   */
  getServices() {
    return Array.from(this.services.values());
  }

  /**
   * Get registered routes
   */
  getRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `gateway_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Close API Gateway
   */
  async close() {
    if (this.httpServer) {
      this.httpServer.close();
    }
    if (this.httpsServer) {
      this.httpsServer.close();
    }
    console.log('✅ API Gateway closed');
  }

  /**
   * Shutdown API Gateway
   */
  async shutdown() {
    console.log('🔄 Shutting down API Gateway...');
    
    // Close servers
    if (this.httpServer) {
      this.httpServer.close();
    }
    if (this.httpsServer) {
      this.httpsServer.close();
    }
    
    // Clear data structures
    this.services.clear();
    this.routes.clear();
    this.apiKeys.clear();
    this.rateLimits.clear();
    this.cache.clear();
    this.loadBalancers.clear();
    
    console.log('✅ API Gateway shutdown complete');
  }
}

export default APIGateway;
