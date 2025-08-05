/**
 * BigBaseAlpha v1.5.0 - Full Enterprise Setup Example
 * Complete installation with all enterprise features enabled
 * 
 * @copyright 2025 ByAlphas. All rights reserved.
 */

import BigBaseAlpha from '../src/alpha.js';

async function fullEnterpriseSetup() {
    console.log('🚀 BigBaseAlpha v1.5.0 - Full Enterprise Setup');
    console.log('==============================================');
    console.log('🏢 Complete enterprise features enabled');
    console.log('🔐 Maximum security with HSM integration');
    console.log('⚡ All advanced modules activated');
    console.log('');

    // 🔧 Full enterprise configuration
    const db = new BigBaseAlpha({
        path: './enterprise_data',
        format: 'json',
        encryption: true,
        silent: false,
        
        // 🏢 Enable ALL enterprise modules
        modules: {
            // Core security features
            authentication: true,    // JWT + Role-based access
            hsm: true,              // Hardware Security Module (Offline)
            
            // API & Integration features
            apiGateway: true,       // API Gateway with rate limiting
            restAPI: true,          // Auto-generated REST endpoints
            realtimeDashboard: true,// WebSocket-based real-time monitoring
            graphql: true,          // GraphQL API
            
            // Advanced features
            machineLearning: true,  // ML/AI capabilities
            replication: true,      // Master-slave replication
            monitoring: true,       // Advanced system monitoring
            databaseConnectors: true,// External DB integrations
            eventSourcing: true,    // Event sourcing & CQRS
            blockchain: true,       // Blockchain integration
            streamProcessor: true   // Real-time stream processing
        },
        
        // Authentication configuration
        auth: {
            jwtSecret: 'enterprise-secret-key-2025',
            tokenExpiry: '8h',
            maxLoginAttempts: 5,
            enableApiKeys: true,
            enableRoles: true
        },
        
        // API configuration
        api: {
            port: 3000,
            enableSwagger: true,
            enableCors: true,
            rateLimiting: true
        },
        
        // Real-time dashboard configuration
        dashboard: {
            wsPort: 8080,
            maxClients: 200,
            updateInterval: 2000,
            enableAlerts: true
        },
        
        // Replication configuration
        replication: {
            role: 'master',
            port: 9000,
            enableBackup: true
        },
        
        // HSM Security configuration
        hsm: {
            keySize: 256,
            tamperDetection: true,
            auditLog: true
        }
    });

    try {
        console.log('📡 Initializing BigBaseAlpha Enterprise...');
        await db.init();
        console.log('✅ BigBaseAlpha Enterprise initialized successfully!');
        console.log('');

        // Show enabled services
        console.log('🔧 Enabled Enterprise Services:');
        console.log('─'.repeat(40));
        if (db.authManager) console.log('🔐 Authentication System: ✅ Active');
        if (db.hsm) console.log('🔒 HSM Security: ✅ Active (Offline Mode)');
        if (db.apiGateway) console.log('🌐 API Gateway: ✅ Active');
        if (db.mlEngine) console.log('🤖 Machine Learning: ✅ Active');
        if (db.replicationEngine) console.log('🔄 Replication: ✅ Active');
        if (db.monitoringEngine) console.log('📊 Monitoring: ✅ Active');
        if (db.blockchain) console.log('⛓️ Blockchain: ✅ Active');
        if (db.eventSourcing) console.log('📚 Event Sourcing: ✅ Active');
        console.log('');

        // Create collections with enterprise features
        console.log('📚 Creating enterprise collections...');
        await db.createCollection('users', {
            schema: {
                name: { type: 'string', required: true },
                email: { type: 'string', required: true, unique: true },
                role: { type: 'string', enum: ['admin', 'user', 'manager'] },
                department: { type: 'string' },
                permissions: { type: 'array' }
            },
            indexes: ['email', 'role', 'department'],
            auditLog: true
        });

        await db.createCollection('transactions', {
            schema: {
                amount: { type: 'number', required: true },
                currency: { type: 'string', required: true },
                status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
                userId: { type: 'string', required: true }
            },
            encryption: true,
            hsm: true // HSM-secured collection
        });

        console.log('✅ Enterprise collections created');
        console.log('');

        // Start enterprise services
        console.log('🚀 Starting enterprise services...');
        
        // Start Authentication (create admin user)
        if (db.authManager) {
            const adminUser = await db.authManager.createUser({
                username: 'admin',
                email: 'admin@enterprise.com',
                password: 'admin123',
                role: 'admin'
            });
            console.log('👑 Admin user created:', adminUser.username);
        }

        // Start REST API
        if (db.config.modules.restAPI) {
            await db.startRESTAPI({ port: 3001 });
            console.log('🌐 REST API started on port 3001');
        }

        // Start Real-time Dashboard
        if (db.config.modules.realtimeDashboard) {
            await db.startRealtimeDashboard({ wsPort: 8080 });
            console.log('📊 Real-time Dashboard started on port 8080');
        }

        // Start Replication
        if (db.config.modules.replication) {
            await db.startReplication({ role: 'master', port: 9000 });
            console.log('🔄 Replication master started on port 9000');
        }

        console.log('');
        console.log('🎉 BigBaseAlpha Enterprise is fully operational!');
        console.log('');
        console.log('🔗 Service Endpoints:');
        console.log('─'.repeat(40));
        console.log('📖 REST API: http://localhost:3001/api/v1/docs');
        console.log('📊 Dashboard: ws://localhost:8080');
        console.log('🔄 Replication: tcp://localhost:9000');
        console.log('🔍 Health Check: http://localhost:3001/api/v1/health');
        console.log('');
        console.log('🔐 Security Features:');
        console.log('─'.repeat(40));
        console.log('✅ HSM Hardware Security (100% Offline)');
        console.log('✅ JWT Authentication & Authorization');
        console.log('✅ Role-based Access Control (RBAC)');
        console.log('✅ API Rate Limiting & CORS');
        console.log('✅ Encrypted data storage');
        console.log('✅ Comprehensive audit logging');
        console.log('');
        console.log('💡 Enterprise Features:');
        console.log('─'.repeat(40));
        console.log('⚡ Real-time data synchronization');
        console.log('🤖 Machine Learning integration');
        console.log('📊 Advanced monitoring & alerting');
        console.log('⛓️ Blockchain data integrity');
        console.log('📚 Event sourcing & CQRS');
        console.log('🔄 High availability replication');
        console.log('');

        // Keep running for demonstration
        console.log('⏹️ Press Ctrl+C to stop all enterprise services');
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down BigBaseAlpha Enterprise...');
            await db.stopAllServices();
            console.log('✅ All enterprise services stopped');
            process.exit(0);
        });

        // Keep alive
        setInterval(() => {
            console.log(`⏰ Enterprise services running... ${new Date().toISOString()}`);
        }, 60000); // Log every minute

    } catch (error) {
        console.error('❌ Enterprise setup failed:', error.message);
        await db.close();
        process.exit(1);
    }
}

// Run full enterprise setup
fullEnterpriseSetup().catch(console.error);

export default fullEnterpriseSetup;
