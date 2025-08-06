# Changelog

## [1.5.1] - 2025-08-06
### Added - Modular Logger System
- **Enterprise Text-Based Logging**: Professional logging system replacing emoji-based logs
  - Text-based log levels: [INFO], [SUCCESS], [WARN], [ERROR], [DEBUG], [PROCESS]
  - Full compatibility with enterprise environments and CI/CD systems
  - Improved readability for log files and terminal output
  - Professional timestamp formatting with ISO 8601 standard
- **Fully Customizable Color Schemes**: Advanced color support using colors package
  - 256-color terminal support with professional color presets
  - Customizable color schemes for corporate branding
  - Runtime color configuration without restart required
  - Color disable option for file logging and low-color environments
- **Multiple Output Formats**: Flexible logging formats for different use cases
  - Text format (default): Professional enterprise logging with timestamps
  - Emoji format (legacy): Maintains backward compatibility with pre-v1.5.1
  - Minimal format: Compact symbols for resource-constrained environments
  - JSON format: Structured logging for ELK stack and log aggregation systems
- **Runtime Configuration Management**: Dynamic logger changes without system restart
  - setLoggerFormat(): Switch between text, emoji, minimal, JSON formats
  - setLoggerPreset(): Apply enterprise, legacy, minimal, debug, silent presets
  - setLoggerColors(): Enable/disable colors dynamically
  - setLoggerColorScheme(): Update color schemes on the fly
- **Professional Enterprise Presets**: Pre-configured setups for different environments
  - Enterprise (default): Professional text-based logging with colors and timestamps
  - Legacy: Maintains emoji compatibility for existing deployments
  - Minimal: Compact output for production and resource-constrained systems
  - JSON: Structured output for Elasticsearch, Splunk, and log aggregation
  - Debug: Detailed logging for development and troubleshooting
  - Silent: No output for embedded systems and SDK usage
- **Manual Logging API**: Direct access to logging functions
  - db.log.info(), db.log.success(), db.log.warn(), db.log.error()
  - db.log.debug(), db.log.process() for different log levels
  - Child logger creation for modular applications
  - Inherited configuration with override capability
- **Quick Preset Switchers**: Convenience methods for common configurations
  - enableTextLogging(), enableEmojiLogging(), enableMinimalLogging()
  - enableJSONLogging(), enableDebugLogging(), enableSilentLogging()
  - One-method preset changes for rapid environment switching

### Changed
- **Default Logging Format**: Changed from emoji-based to professional text-based logging
- **Log Message Format**: Improved consistency and readability across all modules
- **Color Scheme**: Enhanced color support with professional enterprise defaults

### Fixed
- **Emoji Compatibility Issues**: Resolved emoji display problems in various terminal environments
- **Log Format Consistency**: Standardized log message formatting across all system components

## [1.5.0] - 2025-08-05
### Added - Enterprise Authentication & API Features
- **JWT Authentication & User Management**: Complete authentication system with role-based access control
  - JWT token-based authentication with refresh tokens
  - User management with roles: admin, user, readonly, api
  - API key generation and management for third-party access
  - Session management with automatic cleanup
  - Login attempt protection with account lockout
  - Multi-factor authentication ready architecture
- **Auto-Generated REST API**: Full REST API with automatic endpoint generation
  - Auto-generated CRUD endpoints for all collections: GET, POST, PUT, DELETE, PATCH
  - OpenAPI/Swagger documentation with interactive UI
  - Pagination, filtering, sorting, and search capabilities
  - Bulk operations support (insert, update, delete many)
  - Rate limiting and CORS support
  - Authentication middleware integration
- **Real-time Dashboard Enhancement**: WebSocket-based live monitoring
  - Real-time metrics streaming via WebSocket connections
  - Live system monitoring: CPU, memory, database operations
  - Real-time alerts and notifications system
  - Client subscription management for different data channels
  - Live query execution with real-time results
  - User activity tracking and session monitoring
- **Master-Slave Replication**: High availability with automatic failover
  - Master-slave replication with operation log synchronization
  - Automatic failover with master election process
  - Heartbeat monitoring and health checks
  - Data synchronization with compression support
  - Network-based replication protocol
  - Manual failover capabilities for maintenance

### Enhanced
- **New API Commands**:
  - `npm run api:start` - Start REST API server (port 3001)
  - `npm run dashboard:realtime` - Start real-time dashboard (port 8080)
  - `npm run replication:master` - Start as master node
  - `npm run replication:slave` - Start as slave node
  - `npm run auth:demo` - Create demo admin user
  - `npm run services:start` - Start all v1.5.0 services
  - `npm run status` - Enhanced system status with v1.5.0 features

### Architecture
- **Enterprise-Ready Features**: Full authentication, API, and replication stack
- **Microservices Architecture**: Separate services for API, dashboard, and replication
- **WebSocket Integration**: Real-time communication for dashboard and monitoring
- **Security Enhancements**: JWT tokens, API keys, role-based permissions
- **High Availability**: Master-slave replication with automatic failover

### Breaking Changes
- Authentication now required for REST API access
- Dashboard WebSocket requires authentication tokens
- New configuration structure for v1.5.0 features

## [1.4.5] - 2025-08-03
### Added - Performance Engine & Advanced Collection System
- **Lazy Write Performance Engine**: Significant write performance improvements with configurable batching
  - `performance: { lazyWrite: true, batchSize: 100, flushDelay: 2000 }` - Batch processing optimization
  - ~12-20% write performance improvement with background flush processing
  - Memory-efficient operations with compression support
- **Advanced Collection System**: Complete document-based collection API with powerful querying
  - `db.collection('name')` - Auto-creating collections with document management
  - Advanced query operators: `$gt`, `$lt`, `$gte`, `$lte`, `$regex`, `$and`, `$or`, `$not`
  - Query optimization engine with execution plans and performance profiling
  - Automatic indexing system: `collection.createIndex({ field: 1 })` for better query performance
- **Enhanced Query Performance**: Advanced query engine with 0-2ms execution times
  - Complex query support: `collection.find({ $and: [{ category: 'books' }, { price: { $lt: 50 } }] })`
  - Query profiling: `collection.find().explain()` for performance analysis
  - Collection statistics: document count, index usage, memory consumption
- **Storage Integration Improvements**: Fixed collection-storage integration bugs
  - Proper error handling with fallback mechanisms
  - Optimized document persistence layer with better reliability

### Fixed
- Collection system storage integration bug causing `saveDocument is not a function` error
- Improved error handling in collection document operations
- Better memory management in large document operations

### Changed
- Package cleanup: Demo files hidden from npm package via .npmignore
- Performance test directories excluded from git repository
- Optimized startup time and resource usage

## [1.4.0] - 2025-08-03
### Added - Security & Privacy Suite
- **Self-Destruct Mode**: Database can destroy itself after a timeout with secure PIN cancellation
  - `db.activateSelfDestruct({ timeout, secure, wipeLevel })` - Configurable destruction with deep wipe
  - Deep wipe overwrites data 3 times with random data for secure deletion
  - Secure PIN protection: `db.abortDestruct("pin")` to cancel destruction
- **Dead Man's Switch**: Automatic database destruction after period of inactivity
  - `db.enableDeadMansSwitch({ delay, triggerMessage, callback })` - Auto-destruct on inactivity
  - Perfect for offline systems and emergency situations
- **Paranoia Mode**: Enhanced logging and tampering protection
  - Every operation (get, set, delete) is hashed and timestamped with encryption
  - `db.enableParanoia({ encryption, tamperCheck })` - Self-encrypting log system
- **One-Time Access Keys**: Data that self-destructs after single read
  - `db.set("key", "value", { once: true })` - Auto-delete after first access
- **Wipe Command**: Pattern-based secure data deletion
  - `db.wipe("pattern*")` - Secure overwrite deletion for pattern matching
- **Fake Mode / Decoy Database**: Returns fake data when wrong password is used
  - `db.enableDecoy({ password, realDb, decoyDb })` - Honeypot protection
- **Execution Triggers**: Data that executes code when accessed
  - Trigger functions on data read: `{ onRead: () => {} }` option

## [1.3.0] - 2025-08-02
### Added
- **Terminal UI Framework**: Rich terminal components with colors integration for enhanced developer experience
  - ASCII charts: bar chart, line chart, pie chart visualization in terminal
  - Dynamic data tables with sorting and filtering capabilities
  - Real-time log monitors with colored levels (info, warn, error)
  - Component API: `alpha.ui.createComponent({ type: 'chart', data })` for easy UI creation
- **Profiling & Performance Monitor**: System performance monitoring through terminal interface
  - CPU, RAM, Disk I/O live graphics and monitoring
  - `alpha.ui.monitor('cpu')` for real-time system monitoring
  - Log density analysis, query duration tracking, data flow analytics
  - Performance insights and bottleneck detection

## [1.2.0] - 2025-07-31
### Added
- Dashboard (port 3000) and Streaming (port 8080) are now disabled by default. These services will only start if you explicitly call `startDashboard()` or `startStreaming()`.
- This prevents unwanted open ports when BigBaseAlpha is integrated into other projects, improving security and resource management.

## [1.1.0] - 2025-07-31
### Added
- Centralized log control: `silent` and `logger` options for all core and plugin logs
- All logs can now be silenced or redirected in embedded/SDK usage
- Buffer serialization/deserialization for `.db` format fully fixed and tested
- Full multi-format data storage support: `.json`, `.db` (binary/encrypted), `.csv`, `.xml`, `.yaml`, `.bin`, `.hybrid` formats are now supported for collections and backups.
- New formats added in this release: `.db` (binary/encrypted), `.csv`, `.xml`, `.yaml`, `.bin`, `.hybrid`.
- All format tests (json, binary, hybrid, csv, xml, yaml, db) pass without error
- `.db` files can now be fully encrypted (`encryption: true`), making their contents unreadable and secure for production use. This ensures sensitive data is not visible even if the file is accessed directly.

### Changed
- Internal plugin log calls now respect the main instance's `silent`/`logger` options
- Test scripts and error messages fully translated to English

### Fixed
- `.db` file header bug (slice length) resolved for robust binary compatibility
- Minor test and documentation improvements

---
See the full documentation in the README.md for usage, security, and upgrade notes.
