import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';

/**
 * BigBaseAlpha Auto-Generated REST API
 * Automatically generates REST endpoints for all collections
 * 
 * @copyright 2025 ByAlphas. All rights reserved.
 */
export class RESTAPIGenerator extends EventEmitter {
    constructor(database, authManager, options = {}) {
        super();
        
        this.database = database;
        this.authManager = authManager;
        this.options = {
            port: options.port || 3001,
            prefix: options.prefix || '/api/v1',
            enableSwagger: options.enableSwagger !== false,
            enableCors: options.enableCors !== false,
            rateLimiting: options.rateLimiting !== false,
            pagination: {
                defaultLimit: options.pagination?.defaultLimit || 20,
                maxLimit: options.pagination?.maxLimit || 100
            },
            ...options
        };
        
        this.app = express();
        this.server = null;
        this.routes = new Map();
        this.apiDocs = {
            openapi: '3.0.0',
            info: {
                title: 'BigBaseAlpha REST API',
                version: '1.5.0',
                description: 'Auto-generated REST API for BigBaseAlpha collections'
            },
            servers: [
                {
                    url: `http://localhost:${this.options.port}${this.options.prefix}`,
                    description: 'Development server'
                }
            ],
            paths: {},
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    },
                    apiKey: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key'
                    }
                }
            }
        };
        
        this._setupMiddleware();
        this._setupBaseRoutes();
    }
    
    /**
     * Setup Express middleware
     */
    _setupMiddleware() {
        // CORS
        if (this.options.enableCors) {
            this.app.use(cors({
                origin: this.options.cors?.origin || '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
            }));
        }
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`📡 ${req.method} ${req.path} - ${req.ip}`);
            next();
        });
        
        // Rate limiting (simple implementation)
        if (this.options.rateLimiting) {
            this.app.use(this._rateLimitMiddleware());
        }
    }
    
    /**
     * Setup base routes
     */
    _setupBaseRoutes() {
        const router = express.Router();
        
        // Health check
        router.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.5.0',
                uptime: process.uptime()
            });
        });
        
        // API documentation
        if (this.options.enableSwagger) {
            router.get('/docs', (req, res) => {
                res.json(this.apiDocs);
            });
            
            router.get('/docs/ui', (req, res) => {
                res.send(this._generateSwaggerUI());
            });
        }
        
        // List all collections
        router.get('/collections', 
            this.authManager.middleware(),
            this.authManager.requirePermission('read'),
            async (req, res) => {
                try {
                    const collections = await this.database.listCollections();
                    const collectionStats = await Promise.all(
                        collections.map(async (name) => {
                            const collection = this.database.collection(name);
                            const count = await collection.countDocuments();
                            return { name, count };
                        })
                    );
                    
                    res.json({
                        success: true,
                        collections: collectionStats,
                        total: collections.length
                    });
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // Authentication routes
        router.post('/auth/login', async (req, res) => {
            try {
                const result = await this.authManager.login(req.body, {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
                res.json(result);
            } catch (error) {
                res.status(401).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        router.post('/auth/logout', 
            this.authManager.middleware(),
            async (req, res) => {
                try {
                    const token = req.headers.authorization?.substring(7);
                    const result = await this.authManager.logout(token);
                    res.json(result);
                } catch (error) {
                    res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        router.post('/auth/refresh', async (req, res) => {
            try {
                const { refreshToken } = req.body;
                const result = await this.authManager.refreshToken(refreshToken);
                res.json(result);
            } catch (error) {
                res.status(401).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        router.get('/auth/me', 
            this.authManager.middleware(),
            async (req, res) => {
                res.json({
                    success: true,
                    user: req.user,
                    authType: req.authType
                });
            }
        );
        
        this.app.use(this.options.prefix, router);
    }
    
    /**
     * Generate CRUD routes for a collection
     */
    generateCollectionRoutes(collectionName) {
        const router = express.Router();
        const collection = this.database.collection(collectionName);
        
        // GET /collections/:name - List documents with pagination
        router.get('/', 
            this.authManager.middleware(),
            this.authManager.requirePermission('read'),
            async (req, res) => {
                try {
                    const {
                        page = 1,
                        limit = this.options.pagination.defaultLimit,
                        sort,
                        filter,
                        search
                    } = req.query;
                    
                    const pageNum = Math.max(1, parseInt(page));
                    const limitNum = Math.min(
                        Math.max(1, parseInt(limit)),
                        this.options.pagination.maxLimit
                    );
                    const skip = (pageNum - 1) * limitNum;
                    
                    // Build query
                    let query = {};
                    if (filter) {
                        try {
                            query = JSON.parse(filter);
                        } catch (e) {
                            return res.status(400).json({
                                success: false,
                                error: 'Invalid filter JSON'
                            });
                        }
                    }
                    
                    // Add search
                    if (search) {
                        query.$text = { $search: search };
                    }
                    
                    // Execute query
                    let queryBuilder = collection.find(query);
                    
                    // Apply sorting
                    if (sort) {
                        const sortObj = {};
                        sort.split(',').forEach(field => {
                            if (field.startsWith('-')) {
                                sortObj[field.substring(1)] = -1;
                            } else {
                                sortObj[field] = 1;
                            }
                        });
                        queryBuilder = queryBuilder.sort(sortObj);
                    }
                    
                    // Apply pagination
                    const documents = await queryBuilder.skip(skip).limit(limitNum).toArray();
                    const totalCount = await collection.countDocuments(query);
                    
                    res.json({
                        success: true,
                        data: documents,
                        pagination: {
                            page: pageNum,
                            limit: limitNum,
                            total: totalCount,
                            pages: Math.ceil(totalCount / limitNum),
                            hasNext: pageNum * limitNum < totalCount,
                            hasPrev: pageNum > 1
                        }
                    });
                    
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // GET /collections/:name/:id - Get single document
        router.get('/:id',
            this.authManager.middleware(),
            this.authManager.requirePermission('read'),
            async (req, res) => {
                try {
                    const document = await collection.findOne({ _id: req.params.id });
                    
                    if (!document) {
                        return res.status(404).json({
                            success: false,
                            error: 'Document not found'
                        });
                    }
                    
                    res.json({
                        success: true,
                        data: document
                    });
                    
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // POST /collections/:name - Create new document
        router.post('/',
            this.authManager.middleware(),
            this.authManager.requirePermission('write'),
            async (req, res) => {
                try {
                    const documentData = {
                        ...req.body,
                        _createdBy: req.user._id,
                        _createdAt: new Date(),
                        _updatedAt: new Date()
                    };
                    
                    const result = await collection.insertOne(documentData);
                    
                    res.status(201).json({
                        success: true,
                        data: result,
                        id: result._id
                    });
                    
                } catch (error) {
                    res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // PUT /collections/:name/:id - Update document
        router.put('/:id',
            this.authManager.middleware(),
            this.authManager.requirePermission('write'),
            async (req, res) => {
                try {
                    const updateData = {
                        ...req.body,
                        _updatedBy: req.user._id,
                        _updatedAt: new Date()
                    };
                    
                    // Remove immutable fields
                    delete updateData._id;
                    delete updateData._createdBy;
                    delete updateData._createdAt;
                    
                    const result = await collection.findOneAndUpdate(
                        { _id: req.params.id },
                        { $set: updateData },
                        { returnDocument: 'after' }
                    );
                    
                    if (!result) {
                        return res.status(404).json({
                            success: false,
                            error: 'Document not found'
                        });
                    }
                    
                    res.json({
                        success: true,
                        data: result
                    });
                    
                } catch (error) {
                    res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // PATCH /collections/:name/:id - Partial update
        router.patch('/:id',
            this.authManager.middleware(),
            this.authManager.requirePermission('write'),
            async (req, res) => {
                try {
                    const updateData = {
                        ...req.body,
                        _updatedBy: req.user._id,
                        _updatedAt: new Date()
                    };
                    
                    const result = await collection.findOneAndUpdate(
                        { _id: req.params.id },
                        { $set: updateData },
                        { returnDocument: 'after' }
                    );
                    
                    if (!result) {
                        return res.status(404).json({
                            success: false,
                            error: 'Document not found'
                        });
                    }
                    
                    res.json({
                        success: true,
                        data: result
                    });
                    
                } catch (error) {
                    res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // DELETE /collections/:name/:id - Delete document
        router.delete('/:id',
            this.authManager.middleware(),
            this.authManager.requirePermission('delete'),
            async (req, res) => {
                try {
                    const result = await collection.findOneAndDelete({ _id: req.params.id });
                    
                    if (!result) {
                        return res.status(404).json({
                            success: false,
                            error: 'Document not found'
                        });
                    }
                    
                    res.json({
                        success: true,
                        message: 'Document deleted successfully',
                        data: result
                    });
                    
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // POST /collections/:name/bulk - Bulk operations
        router.post('/bulk',
            this.authManager.middleware(),
            this.authManager.requirePermission('write'),
            async (req, res) => {
                try {
                    const { operation, documents, filter } = req.body;
                    
                    let result;
                    const timestamp = new Date();
                    
                    switch (operation) {
                        case 'insert':
                            const docsToInsert = documents.map(doc => ({
                                ...doc,
                                _createdBy: req.user._id,
                                _createdAt: timestamp,
                                _updatedAt: timestamp
                            }));
                            result = await collection.insertMany(docsToInsert);
                            break;
                            
                        case 'update':
                            result = await collection.updateMany(
                                filter || {},
                                {
                                    $set: {
                                        ...req.body.update,
                                        _updatedBy: req.user._id,
                                        _updatedAt: timestamp
                                    }
                                }
                            );
                            break;
                            
                        case 'delete':
                            result = await collection.deleteMany(filter || {});
                            break;
                            
                        default:
                            return res.status(400).json({
                                success: false,
                                error: 'Invalid bulk operation'
                            });
                    }
                    
                    res.json({
                        success: true,
                        operation,
                        result
                    });
                    
                } catch (error) {
                    res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        
        // Mount collection routes
        this.app.use(`${this.options.prefix}/collections/${collectionName}`, router);
        this.routes.set(collectionName, router);
        
        // Update API documentation
        this._updateApiDocs(collectionName);
        
        console.log(`🌐 REST API routes generated for collection: ${collectionName}`);
        this.emit('routesGenerated', { collection: collectionName });
    }
    
    /**
     * Auto-generate routes for all existing collections
     */
    async generateAllRoutes() {
        try {
            const collections = await this.database.listCollections();
            
            for (const collectionName of collections) {
                // Skip system collections
                if (!collectionName.startsWith('_')) {
                    this.generateCollectionRoutes(collectionName);
                }
            }
            
            console.log(`🚀 Auto-generated REST API for ${collections.length} collections`);
            this.emit('allRoutesGenerated', { count: collections.length });
            
        } catch (error) {
            console.error('Failed to generate routes:', error);
            throw error;
        }
    }
    
    /**
     * Start the API server
     */
    async start() {
        try {
            // Generate routes for existing collections
            await this.generateAllRoutes();
            
            // Start server
            this.server = this.app.listen(this.options.port, () => {
                console.log(`🌐 REST API server started on port ${this.options.port}`);
                console.log(`📖 API Documentation: http://localhost:${this.options.port}${this.options.prefix}/docs/ui`);
                console.log(`🔍 Health Check: http://localhost:${this.options.port}${this.options.prefix}/health`);
            });
            
            this.emit('serverStarted', { port: this.options.port });
            
            return this.server;
            
        } catch (error) {
            console.error('Failed to start API server:', error);
            throw error;
        }
    }
    
    /**
     * Stop the API server
     */
    async stop() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
            console.log('🛑 REST API server stopped');
            this.emit('serverStopped');
        }
    }
    
    /**
     * Rate limiting middleware
     */
    _rateLimitMiddleware() {
        const requests = new Map();
        
        return (req, res, next) => {
            const identifier = req.ip || 'unknown';
            const now = Date.now();
            const windowMs = 60 * 1000; // 1 minute
            const maxRequests = 100; // 100 requests per minute
            
            if (!requests.has(identifier)) {
                requests.set(identifier, []);
            }
            
            const userRequests = requests.get(identifier);
            
            // Clean old requests
            const validRequests = userRequests.filter(timestamp => 
                now - timestamp < windowMs
            );
            
            if (validRequests.length >= maxRequests) {
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
            
            validRequests.push(now);
            requests.set(identifier, validRequests);
            
            next();
        };
    }
    
    /**
     * Update OpenAPI documentation
     */
    _updateApiDocs(collectionName) {
        const basePath = `/collections/${collectionName}`;
        
        this.apiDocs.paths[basePath] = {
            get: {
                summary: `List ${collectionName} documents`,
                tags: [collectionName],
                security: [{ bearerAuth: [] }, { apiKey: [] }],
                parameters: [
                    {
                        name: 'page',
                        in: 'query',
                        schema: { type: 'integer', default: 1 }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', default: 20 }
                    },
                    {
                        name: 'filter',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'JSON filter object'
                    },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Comma-separated sort fields'
                    }
                ],
                responses: {
                    200: {
                        description: 'List of documents',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: { type: 'array' },
                                        pagination: { type: 'object' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            post: {
                summary: `Create ${collectionName} document`,
                tags: [collectionName],
                security: [{ bearerAuth: [] }, { apiKey: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Document created successfully'
                    }
                }
            }
        };
        
        this.apiDocs.paths[`${basePath}/{id}`] = {
            get: {
                summary: `Get ${collectionName} document by ID`,
                tags: [collectionName],
                security: [{ bearerAuth: [] }, { apiKey: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    }
                ],
                responses: {
                    200: { description: 'Document found' },
                    404: { description: 'Document not found' }
                }
            },
            put: {
                summary: `Update ${collectionName} document`,
                tags: [collectionName],
                security: [{ bearerAuth: [] }, { apiKey: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    }
                ],
                responses: {
                    200: { description: 'Document updated' }
                }
            },
            delete: {
                summary: `Delete ${collectionName} document`,
                tags: [collectionName],
                security: [{ bearerAuth: [] }, { apiKey: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    }
                ],
                responses: {
                    200: { description: 'Document deleted' }
                }
            }
        };
    }
    
    /**
     * Generate Swagger UI HTML
     */
    _generateSwaggerUI() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>BigBaseAlpha API Documentation</title>
            <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
        </head>
        <body>
            <div id="swagger-ui"></div>
            <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
            <script>
                SwaggerUIBundle({
                    url: '${this.options.prefix}/docs',
                    dom_id: '#swagger-ui',
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIBundle.presets.standalone
                    ]
                });
            </script>
        </body>
        </html>
        `;
    }
    
    /**
     * Get API statistics
     */
    getAPIStats() {
        return {
            routes: {
                total: this.routes.size,
                collections: Array.from(this.routes.keys())
            },
            server: {
                running: !!this.server,
                port: this.options.port
            },
            options: {
                prefix: this.options.prefix,
                enableSwagger: this.options.enableSwagger,
                enableCors: this.options.enableCors,
                rateLimiting: this.options.rateLimiting
            }
        };
    }
}

export default RESTAPIGenerator;
