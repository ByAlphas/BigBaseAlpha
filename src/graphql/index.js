import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * GraphQL Engine for BigBaseAlpha
 * Provides GraphQL API layer with schema introspection, resolvers, and subscriptions
 */
export class GraphQLEngine extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      enabled: config.graphql?.enabled || false,
      port: config.graphql?.port || 4000,
      introspection: config.graphql?.introspection !== false,
      playground: config.graphql?.playground !== false,
      subscriptions: config.graphql?.subscriptions !== false,
      maxDepth: config.graphql?.maxDepth || 10,
      maxComplexity: config.graphql?.maxComplexity || 1000,
      ...config.graphql
    };

    this.database = null;
    this.isInitialized = false;
    
    // Schema and resolvers
    this.typeDefs = new Map();
    this.resolvers = new Map();
    this.schema = null;
    this.customResolvers = new Map();
    
    // Subscriptions
    this.subscriptions = new Map();
    this.subscriptionClients = new Set();
    
    // Query analysis
    this.queryCache = new Map();
    this.queryStats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      slowQueries: [],
      complexQueries: []
    };

    // Performance metrics
    this.metrics = {
      requestsPerSecond: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      subscriptionCount: 0,
      errors: 0
    };

    // Built-in types and resolvers
    this._initializeBuiltInTypes();
  }

  async init() {
    if (this.isInitialized) return;

    console.log('[STARTUP] Initializing GraphQL Engine...');

    if (!this.config.enabled) {
      console.log('[WARN] GraphQL is disabled in configuration');
      return;
    }

    try {
      // Initialize resolvers first (without dynamic schema)
      this._initializeResolvers();
      
      // Setup subscriptions if enabled
      if (this.config.subscriptions) {
        this._initializeSubscriptions();
      }

      this.isInitialized = true;
      console.log(`[SUCCESS] GraphQL Engine initialized on port ${this.config.port}`);

      this.emit('graphqlInitialized', {
        port: this.config.port,
        introspection: this.config.introspection,
        playground: this.config.playground,
        subscriptions: this.config.subscriptions
      });

    } catch (error) {
      console.error('[ERROR] Failed to initialize GraphQL Engine:', error.message);
      throw error;
    }
  }

  setDatabase(database) {
    this.database = database;
    
    // Build dynamic schema after database is set
    if (this.isInitialized && database) {
      this._buildDynamicSchema().catch(error => {
        console.warn('[WARN] Could not build dynamic schema:', error.message);
      });
    }
  }

  _initializeBuiltInTypes() {
    // Base scalar types
    this.typeDefs.set('scalars', `
      scalar Date
      scalar JSON
      scalar Upload
      
      enum SortOrder {
        ASC
        DESC
      }
      
      input FilterInput {
        field: String!
        operator: String!
        value: JSON
      }
      
      input SortInput {
        field: String!
        order: SortOrder = ASC
      }
      
      input PaginationInput {
        skip: Int = 0
        limit: Int = 10
      }
      
      type QueryInfo {
        executionTime: Int
        complexity: Int
        depth: Int
        cached: Boolean
      }
      
      type MutationResult {
        success: Boolean!
        message: String
        data: JSON
        errors: [String]
      }
    `);

    // Database introspection types
    this.typeDefs.set('introspection', `
      type Collection {
        name: String!
        documentCount: Int!
        fields: [FieldInfo!]!
        indexes: [IndexInfo!]!
        lastModified: Date
      }
      
      type FieldInfo {
        name: String!
        type: String!
        nullable: Boolean!
        frequency: Float!
        sampleValues: [JSON]
      }
      
      type IndexInfo {
        name: String!
        fields: [String!]!
        unique: Boolean!
        type: String!
      }
      
      type DatabaseStats {
        collections: Int!
        totalDocuments: Int!
        storageSize: String!
        indexes: Int!
      }
    `);
  }

  async _buildDynamicSchema() {
    if (!this.database) {
      console.log('[WARN] Database not set for GraphQL schema generation, using static schema');
      
      // Build basic Query type without collections
      this._buildQueryType([]);
      this._buildMutationType([]);
      
      if (this.config.subscriptions) {
        this._buildSubscriptionType([]);
      }
      
      return;
    }

    try {
      // Get all collections
      const collections = await this.database.getCollections();
      console.log(`📊 Building GraphQL schema for ${collections.length} collections`);

      // Build types for each collection
      for (const collection of collections) {
        await this._buildCollectionType(collection);
      }

      // Build root Query type
      this._buildQueryType(collections);
      
      // Build root Mutation type
      this._buildMutationType(collections);
      
      // Build Subscription type if enabled
      if (this.config.subscriptions) {
        this._buildSubscriptionType(collections);
      }

      console.log(`[SUCCESS] GraphQL schema built with ${this.typeDefs.size} type definitions`);

    } catch (error) {
      console.error('[ERROR] Failed to build GraphQL schema:', error.message);
      throw error;
    }
  }

  async _buildCollectionType(collectionName) {
    try {
      // Analyze collection structure
      const sampleDocuments = await this.database.find(collectionName, {}, { limit: 10 });
      const fields = this._analyzeDocumentStructure(sampleDocuments);

      // Build GraphQL type definition
      const typeName = this._capitalize(collectionName);
      const fieldDefs = fields.map(field => 
        `${field.name}: ${this._mapToGraphQLType(field.type)}${field.nullable ? '' : '!'}`
      ).join('\n  ');

      const typeDef = `
        type ${typeName} {
          _id: ID!
          ${fieldDefs}
          _createdAt: Date
          _updatedAt: Date
        }
        
        input ${typeName}Input {
          ${fieldDefs.replace(/!/g, '')}
        }
        
        input ${typeName}UpdateInput {
          ${fieldDefs.replace(/!/g, '')}
        }
        
        type ${typeName}Connection {
          edges: [${typeName}!]!
          totalCount: Int!
          pageInfo: PageInfo!
        }
        
        type PageInfo {
          hasNextPage: Boolean!
          hasPreviousPage: Boolean!
          startCursor: String
          endCursor: String
        }
      `;

      this.typeDefs.set(collectionName, typeDef);

    } catch (error) {
      console.warn(`[WARN] Failed to build type for collection ${collectionName}:`, error.message);
    }
  }

  _analyzeDocumentStructure(documents) {
    const fieldMap = new Map();

    for (const doc of documents) {
      for (const [key, value] of Object.entries(doc)) {
        if (key === '_id') continue;

        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            name: key,
            types: new Set(),
            nullable: false,
            frequency: 0
          });
        }

        const field = fieldMap.get(key);
        field.frequency++;
        field.types.add(this._getValueType(value));
      }
    }

    // Convert to field definitions
    return Array.from(fieldMap.values()).map(field => ({
      name: field.name,
      type: this._getMostCommonType(field.types),
      nullable: field.frequency < documents.length * 0.9 // Field is nullable if not present in 90% of docs
    }));
  }

  _getValueType(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Float';
    if (typeof value === 'string') return this._isDateString(value) ? 'Date' : 'String';
    if (Array.isArray(value)) return '[JSON]';
    if (typeof value === 'object') return 'JSON';
    return 'String';
  }

  _isDateString(str) {
    return !isNaN(Date.parse(str)) && /\d{4}-\d{2}-\d{2}/.test(str);
  }

  _getMostCommonType(types) {
    // Priority: String > JSON > Int > Float > Boolean
    if (types.has('String')) return 'String';
    if (types.has('JSON')) return 'JSON';
    if (types.has('Date')) return 'Date';
    if (types.has('Int')) return 'Int';
    if (types.has('Float')) return 'Float';
    if (types.has('Boolean')) return 'Boolean';
    return 'String';
  }

  _mapToGraphQLType(type) {
    const mapping = {
      'String': 'String',
      'Int': 'Int',
      'Float': 'Float',
      'Boolean': 'Boolean',
      'Date': 'Date',
      'JSON': 'JSON',
      '[JSON]': '[JSON]'
    };
    return mapping[type] || 'String';
  }

  _buildQueryType(collections) {
    const queries = collections.map(collection => {
      const typeName = this._capitalize(collection);
      return `
        # Get single ${collection} by ID
        ${collection}(id: ID!): ${typeName}
        
        # Get multiple ${collection} with filtering and pagination
        ${collection}s(
          filter: [FilterInput]
          sort: [SortInput]
          pagination: PaginationInput
        ): ${typeName}Connection!
        
        # Search ${collection}
        search${typeName}s(
          query: String!
          fields: [String]
          pagination: PaginationInput
        ): ${typeName}Connection!
      `;
    }).join('\n');

    const queryType = `
      type Query {
        # Database introspection
        collections: [Collection!]!
        collection(name: String!): Collection
        databaseStats: DatabaseStats!
        
        # Collection queries
        ${queries}
        
        # System queries
        health: JSON!
        version: String!
        
        # Query metadata
        _queryInfo: QueryInfo
      }
    `;

    this.typeDefs.set('Query', queryType);
  }

  _buildMutationType(collections) {
    const mutations = collections.map(collection => {
      const typeName = this._capitalize(collection);
      return `
        # Create ${collection}
        create${typeName}(input: ${typeName}Input!): MutationResult!
        
        # Update ${collection}
        update${typeName}(id: ID!, input: ${typeName}UpdateInput!): MutationResult!
        
        # Delete ${collection}
        delete${typeName}(id: ID!): MutationResult!
        
        # Bulk operations
        createMany${typeName}s(input: [${typeName}Input!]!): MutationResult!
        updateMany${typeName}s(filter: [FilterInput], input: ${typeName}UpdateInput!): MutationResult!
        deleteMany${typeName}s(filter: [FilterInput]): MutationResult!
      `;
    }).join('\n');

    const mutationType = `
      type Mutation {
        ${mutations}
        
        # Database operations
        createCollection(name: String!): MutationResult!
        dropCollection(name: String!): MutationResult!
        createIndex(collection: String!, fields: [String!]!, unique: Boolean): MutationResult!
        
        # Admin operations
        rebuildIndexes(collection: String): MutationResult!
        vacuum: MutationResult!
      }
    `;

    this.typeDefs.set('Mutation', mutationType);
  }

  _buildSubscriptionType(collections) {
    const subscriptions = collections.map(collection => {
      const typeName = this._capitalize(collection);
      return `
        # Subscribe to ${collection} changes
        ${collection}Created: ${typeName}!
        ${collection}Updated: ${typeName}!
        ${collection}Deleted: ID!
        
        # Subscribe to all changes in ${collection}
        ${collection}Changes: ${typeName}!
      `;
    }).join('\n');

    const subscriptionType = `
      type Subscription {
        ${subscriptions}
        
        # System subscriptions
        databaseStats: DatabaseStats!
        health: JSON!
      }
    `;

    this.typeDefs.set('Subscription', subscriptionType);
  }

  _initializeResolvers() {
    // Query resolvers
    this.resolvers.set('Query', {
      // Database introspection
      collections: () => this._resolveCollections(),
      collection: (_, { name }) => this._resolveCollection(name),
      databaseStats: () => this._resolveDatabaseStats(),
      health: () => this._resolveHealth(),
      version: () => '1.0.0',
      
      // Dynamic collection resolvers will be added
      ...this._buildCollectionQueryResolvers()
    });

    // Mutation resolvers
    this.resolvers.set('Mutation', {
      ...this._buildCollectionMutationResolvers(),
      
      // Database operations
      createCollection: (_, { name }) => this._createCollection(name),
      dropCollection: (_, { name }) => this._dropCollection(name),
      createIndex: (_, { collection, fields, unique }) => 
        this._createIndex(collection, fields, unique)
    });

    // Subscription resolvers
    if (this.config.subscriptions) {
      this.resolvers.set('Subscription', {
        ...this._buildCollectionSubscriptionResolvers(),
        databaseStats: () => this._subscribeDatabaseStats(),
        health: () => this._subscribeHealth()
      });
    }

    // Scalar resolvers
    this.resolvers.set('Date', {
      serialize: (value) => value instanceof Date ? value.toISOString() : value,
      parseValue: (value) => new Date(value),
      parseLiteral: (ast) => new Date(ast.value)
    });

    this.resolvers.set('JSON', {
      serialize: (value) => value,
      parseValue: (value) => value,
      parseLiteral: (ast) => JSON.parse(ast.value)
    });
  }

  _buildCollectionQueryResolvers() {
    const resolvers = {};
    
    if (!this.database) return resolvers;

    // Get collections and build resolvers
    try {
      const collections = this.database.getCollections ? this.database.getCollections() : [];
      
      for (const collection of collections) {
        // Single document resolver
        resolvers[collection] = async (_, { id }) => {
          return await this.database.findById(collection, id);
        };

        // Multiple documents resolver
        resolvers[`${collection}s`] = async (_, { filter, sort, pagination }) => {
          const query = this._buildMongoQuery(filter);
          const sortObj = this._buildSortObject(sort);
          const { skip = 0, limit = 10 } = pagination || {};

          const documents = await this.database.find(collection, query, {
            sort: sortObj,
            skip,
            limit
          });

          const totalCount = await this.database.count(collection, query);

          return {
            edges: documents,
            totalCount,
            pageInfo: {
              hasNextPage: (skip + limit) < totalCount,
              hasPreviousPage: skip > 0,
              startCursor: skip.toString(),
              endCursor: (skip + limit - 1).toString()
            }
          };
        };

        // Search resolver
        resolvers[`search${this._capitalize(collection)}s`] = async (_, { query, fields, pagination }) => {
          const { skip = 0, limit = 10 } = pagination || {};
          
          const searchResults = await this.database.search(collection, query, {
            fields,
            skip,
            limit
          });

          return {
            edges: searchResults.results || [],
            totalCount: searchResults.totalResults || 0,
            pageInfo: {
              hasNextPage: (skip + limit) < (searchResults.totalResults || 0),
              hasPreviousPage: skip > 0,
              startCursor: skip.toString(),
              endCursor: (skip + limit - 1).toString()
            }
          };
        };
      }
    } catch (error) {
      console.warn('[WARN] Could not build collection query resolvers:', error.message);
    }

    return resolvers;
  }

  _buildCollectionMutationResolvers() {
    const resolvers = {};
    
    if (!this.database) return resolvers;

    try {
      const collections = this.database.getCollections ? this.database.getCollections() : [];
      
      for (const collection of collections) {
        const typeName = this._capitalize(collection);

        // Create resolver
        resolvers[`create${typeName}`] = async (_, { input }) => {
          try {
            const result = await this.database.insert(collection, input);
            
            // Notify subscribers
            this._notifySubscribers(`${collection}Created`, result);
            this._notifySubscribers(`${collection}Changes`, result);

            return {
              success: true,
              message: `${typeName} created successfully`,
              data: result
            };
          } catch (error) {
            return {
              success: false,
              message: error.message,
              errors: [error.message]
            };
          }
        };

        // Update resolver
        resolvers[`update${typeName}`] = async (_, { id, input }) => {
          try {
            const result = await this.database.update(collection, { _id: id }, input);
            
            // Notify subscribers
            this._notifySubscribers(`${collection}Updated`, result);
            this._notifySubscribers(`${collection}Changes`, result);

            return {
              success: true,
              message: `${typeName} updated successfully`,
              data: result
            };
          } catch (error) {
            return {
              success: false,
              message: error.message,
              errors: [error.message]
            };
          }
        };

        // Delete resolver
        resolvers[`delete${typeName}`] = async (_, { id }) => {
          try {
            await this.database.remove(collection, { _id: id });
            
            // Notify subscribers
            this._notifySubscribers(`${collection}Deleted`, id);

            return {
              success: true,
              message: `${typeName} deleted successfully`,
              data: { _id: id }
            };
          } catch (error) {
            return {
              success: false,
              message: error.message,
              errors: [error.message]
            };
          }
        };
      }
    } catch (error) {
      console.warn('[WARN] Could not build collection mutation resolvers:', error.message);
    }

    return resolvers;
  }

  _buildCollectionSubscriptionResolvers() {
    const resolvers = {};
    
    try {
      const collections = this.database?.getCollections ? this.database.getCollections() : [];
      
      for (const collection of collections) {
        resolvers[`${collection}Created`] = {
          subscribe: () => this._createSubscription(`${collection}Created`)
        };
        
        resolvers[`${collection}Updated`] = {
          subscribe: () => this._createSubscription(`${collection}Updated`)
        };
        
        resolvers[`${collection}Deleted`] = {
          subscribe: () => this._createSubscription(`${collection}Deleted`)
        };
        
        resolvers[`${collection}Changes`] = {
          subscribe: () => this._createSubscription(`${collection}Changes`)
        };
      }
    } catch (error) {
      console.warn('[WARN] Could not build collection subscription resolvers:', error.message);
    }

    return resolvers;
  }

  _initializeSubscriptions() {
    console.log('🔔 Initializing GraphQL subscriptions...');
    // Subscription system would be initialized here
    // For now, we'll use a simple event-based system
  }

  // Helper methods for resolvers
  _buildMongoQuery(filters) {
    if (!filters || !Array.isArray(filters)) return {};

    const query = {};
    for (const filter of filters) {
      const { field, operator, value } = filter;
      
      switch (operator) {
        case 'eq':
          query[field] = value;
          break;
        case 'ne':
          query[field] = { $ne: value };
          break;
        case 'gt':
          query[field] = { $gt: value };
          break;
        case 'gte':
          query[field] = { $gte: value };
          break;
        case 'lt':
          query[field] = { $lt: value };
          break;
        case 'lte':
          query[field] = { $lte: value };
          break;
        case 'in':
          query[field] = { $in: Array.isArray(value) ? value : [value] };
          break;
        case 'regex':
          query[field] = { $regex: value, $options: 'i' };
          break;
      }
    }

    return query;
  }

  _buildSortObject(sorts) {
    if (!sorts || !Array.isArray(sorts)) return {};

    const sortObj = {};
    for (const sort of sorts) {
      sortObj[sort.field] = sort.order === 'DESC' ? -1 : 1;
    }

    return sortObj;
  }

  // Introspection resolvers
  async _resolveCollections() {
    if (!this.database) return [];

    try {
      const collections = await this.database.getCollections();
      const result = [];

      for (const collection of collections) {
        const count = await this.database.count(collection);
        const sampleDocs = await this.database.find(collection, {}, { limit: 10 });
        const fields = this._analyzeDocumentStructure(sampleDocs);

        result.push({
          name: collection,
          documentCount: count,
          fields: fields.map(f => ({
            name: f.name,
            type: f.type,
            nullable: f.nullable,
            frequency: f.frequency || 0,
            sampleValues: []
          })),
          indexes: [], // Would get from database
          lastModified: new Date()
        });
      }

      return result;
    } catch (error) {
      console.error('Error resolving collections:', error.message);
      return [];
    }
  }

  async _resolveCollection(name) {
    if (!this.database) return null;

    try {
      const collections = await this.database.getCollections();
      if (!collections.includes(name)) return null;

      const count = await this.database.count(name);
      const sampleDocs = await this.database.find(name, {}, { limit: 10 });
      const fields = this._analyzeDocumentStructure(sampleDocs);

      return {
        name,
        documentCount: count,
        fields: fields.map(f => ({
          name: f.name,
          type: f.type,
          nullable: f.nullable,
          frequency: f.frequency || 0,
          sampleValues: []
        })),
        indexes: [],
        lastModified: new Date()
      };
    } catch (error) {
      console.error(`Error resolving collection ${name}:`, error.message);
      return null;
    }
  }

  async _resolveDatabaseStats() {
    if (!this.database) {
      return {
        collections: 0,
        totalDocuments: 0,
        storageSize: '0 B',
        indexes: 0
      };
    }

    try {
      const collections = await this.database.getCollections();
      let totalDocuments = 0;

      for (const collection of collections) {
        totalDocuments += await this.database.count(collection);
      }

      return {
        collections: collections.length,
        totalDocuments,
        storageSize: '0 B', // Would calculate actual size
        indexes: 0 // Would count actual indexes
      };
    } catch (error) {
      console.error('Error resolving database stats:', error.message);
      return {
        collections: 0,
        totalDocuments: 0,
        storageSize: '0 B',
        indexes: 0
      };
    }
  }

  _resolveHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      graphql: {
        enabled: this.config.enabled,
        subscriptions: this.config.subscriptions,
        introspection: this.config.introspection
      }
    };
  }

  // Subscription management
  _createSubscription(event) {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    
    this.subscriptions.get(event).add(subscriptionId);
    this.metrics.subscriptionCount++;

    return {
      [Symbol.asyncIterator]: async function* () {
        // Subscription iterator would be implemented here
        yield { data: `Subscribed to ${event}` };
      }
    };
  }

  _notifySubscribers(event, data) {
    const subscribers = this.subscriptions.get(event);
    if (!subscribers) return;

    console.log(`🔔 Notifying ${subscribers.size} subscribers for event: ${event}`);
    
    // In a real implementation, this would send the data to all subscribers
    this.emit('subscriptionEvent', { event, data, subscriberCount: subscribers.size });
  }

  // API for external integration
  async executeQuery(query, variables = {}, context = {}) {
    const startTime = Date.now();
    this.queryStats.totalQueries++;

    try {
      // Simple query execution simulation
      console.log(`🔍 Executing GraphQL query: ${query.substring(0, 100)}...`);
      
      // Query analysis
      const analysis = this._analyzeQuery(query);
      
      if (analysis.depth > this.config.maxDepth) {
        throw new Error(`Query depth ${analysis.depth} exceeds maximum ${this.config.maxDepth}`);
      }
      
      if (analysis.complexity > this.config.maxComplexity) {
        throw new Error(`Query complexity ${analysis.complexity} exceeds maximum ${this.config.maxComplexity}`);
      }

      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

      const executionTime = Date.now() - startTime;
      this.queryStats.successfulQueries++;
      this.queryStats.averageExecutionTime = 
        (this.queryStats.averageExecutionTime + executionTime) / 2;

      // Track slow queries
      if (executionTime > 1000) {
        this.queryStats.slowQueries.push({
          query: query.substring(0, 200),
          executionTime,
          timestamp: Date.now()
        });
      }

      return {
        data: { message: 'Query executed successfully' },
        extensions: {
          queryInfo: {
            executionTime,
            complexity: analysis.complexity,
            depth: analysis.depth,
            cached: false
          }
        }
      };

    } catch (error) {
      this.queryStats.failedQueries++;
      this.metrics.errors++;
      
      return {
        errors: [{ message: error.message }],
        extensions: {
          queryInfo: {
            executionTime: Date.now() - startTime,
            cached: false
          }
        }
      };
    }
  }

  _analyzeQuery(query) {
    // Simple query analysis
    const depth = (query.match(/{/g) || []).length;
    const complexity = query.length / 10; // Simple complexity calculation
    
    return { depth, complexity };
  }

  // Schema management
  getSchema() {
    const allTypeDefs = Array.from(this.typeDefs.values()).join('\n\n');
    return allTypeDefs;
  }

  addCustomType(name, typeDef) {
    this.typeDefs.set(`custom_${name}`, typeDef);
    console.log(`[SUCCESS] Added custom type: ${name}`);
  }

  addCustomResolver(typeName, fieldName, resolver) {
    if (!this.customResolvers.has(typeName)) {
      this.customResolvers.set(typeName, {});
    }
    
    this.customResolvers.get(typeName)[fieldName] = resolver;
    console.log(`[SUCCESS] Added custom resolver: ${typeName}.${fieldName}`);
  }

  // Statistics and monitoring
  getStats() {
    return {
      config: {
        enabled: this.config.enabled,
        port: this.config.port,
        introspection: this.config.introspection,
        playground: this.config.playground,
        subscriptions: this.config.subscriptions
      },
      schema: {
        types: this.typeDefs.size,
        resolvers: this.resolvers.size,
        customTypes: Array.from(this.typeDefs.keys()).filter(k => k.startsWith('custom_')).length,
        customResolvers: this.customResolvers.size
      },
      queries: this.queryStats,
      subscriptions: {
        total: this.metrics.subscriptionCount,
        active: this.subscriptionClients.size,
        events: this.subscriptions.size
      },
      performance: this.metrics
    };
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async shutdown() {
    console.log('🔄 Shutting down GraphQL Engine...');
    
    // Close subscription connections
    this.subscriptionClients.clear();
    this.subscriptions.clear();
    
    // Clear caches
    this.queryCache.clear();
    this.typeDefs.clear();
    this.resolvers.clear();
    this.customResolvers.clear();
    
    console.log('[SUCCESS] GraphQL Engine shutdown complete');
  }
}

export default GraphQLEngine;
