# BigBaseAlpha v1.5.0 - Modular Database System

## 🚀 Quick Start

BigBaseAlpha is now **fully modular**! Choose only the features you need:

### 📦 Minimal Setup (Fast & Clean)
```javascript
import BigBaseAlpha from 'bigbasealpha';

const db = new BigBaseAlpha({
  path: './my_data',
  // All advanced modules disabled by default
  modules: {
    authentication: false,
    hsm: false,
    apiGateway: false,
    machineLearning: false,
    replication: false,
    // ... all other features disabled
  }
});
```

### 🏢 Enterprise Setup (Full Features)
```javascript
const db = new BigBaseAlpha({
  path: './enterprise_data',
  modules: {
    authentication: true,     // JWT + RBAC
    hsm: true,               // Hardware Security Module
    apiGateway: true,        // API Gateway
    restAPI: true,           // Auto-generated REST API
    realtimeDashboard: true, // WebSocket monitoring
    replication: true,       // Master-slave replication
    machineLearning: true,   // AI/ML features
    monitoring: true,        // Advanced monitoring
    blockchain: true,        // Blockchain integration
    eventSourcing: true,     // Event sourcing & CQRS
    graphql: true,          // GraphQL API
    // Enable all enterprise features
  }
});
```

## 🔧 Available Modules

| Module | Description | Default | Use Case |
|--------|-------------|---------|----------|
| `authentication` | JWT + Role-based access control | `false` | User management, API security |
| `hsm` | Hardware Security Module (100% offline) | `false` | Maximum security, encryption |
| `apiGateway` | API Gateway with rate limiting | `false` | API management, load balancing |
| `restAPI` | Auto-generated REST endpoints | `false` | Quick API development |
| `realtimeDashboard` | WebSocket-based monitoring | `false` | Real-time data visualization |
| `replication` | Master-slave data replication | `false` | High availability, scaling |
| `machineLearning` | AI/ML integration | `false` | Predictive analytics, AI features |
| `monitoring` | Advanced system monitoring | `false` | Performance tracking, alerts |
| `graphql` | GraphQL API support | `false` | Flexible query language |
| `eventSourcing` | Event sourcing & CQRS | `false` | Event-driven architecture |
| `blockchain` | Blockchain data integrity | `false` | Immutable records, audit trails |
| `databaseConnectors` | External DB integrations | `false` | Legacy system integration |
| `streamProcessor` | Real-time stream processing | `false` | Live data processing |

## 📚 Quick Examples

### Example 1: Simple Database
```bash
node examples/minimal-setup.js
```
- ✅ Core database functionality only
- ✅ Fast startup (< 2 seconds)
- ✅ Low memory usage (< 20MB)

### Example 2: Enterprise Database  
```bash
node examples/full-setup.js
```
- ✅ All enterprise features enabled
- ✅ REST API on port 3001
- ✅ Real-time Dashboard on port 8080
- ✅ Replication master on port 9000

### Example 3: Custom Setup
```javascript
const db = new BigBaseAlpha({
  path: './custom_data',
  modules: {
    authentication: true,    // Enable user management
    restAPI: true,          // Enable REST API
    hsm: true,              // Enable security
    // Keep everything else disabled
  }
});
```

## 🎯 Benefits of Modular Design

### ⚡ Performance
- **Faster startup**: Only load needed modules
- **Lower memory**: Disable unused features  
- **Better performance**: No overhead from unused code

### 🔧 Flexibility  
- **Choose your stack**: Enable only what you need
- **Easy scaling**: Add modules as you grow
- **Clean architecture**: No bloated installations

### 🛡️ Security
- **Reduced attack surface**: Fewer modules = fewer vulnerabilities
- **Granular control**: Enable security features only when needed
- **Clean logs**: No noise from unused modules

## 📊 Module Startup Comparison

| Setup Type | Modules Enabled | Startup Time | Memory Usage | Best For |
|------------|----------------|--------------|--------------|----------|
| **Minimal** | 2-3 core modules | ~1.5s | ~15MB | Simple apps, development |
| **Standard** | 5-7 modules | ~3s | ~35MB | Web apps, APIs |
| **Enterprise** | All modules | ~8s | ~85MB | Large systems, production |

## 🔐 Security Features

When `hsm: true`:
```javascript
// 100% Offline Hardware Security Module
✅ RSA, ECDSA, AES-256-GCM encryption
✅ Tamper detection & integrity monitoring  
✅ Air-gapped operation (no internet required)
✅ Hardware-level key protection simulation
✅ Secure blockchain integration
```

## 🌐 API Features  

When `restAPI: true`:
```javascript
// Auto-generated REST endpoints
GET    /api/v1/collections/users
POST   /api/v1/collections/users  
PUT    /api/v1/collections/users/:id
DELETE /api/v1/collections/users/:id
```

## 📊 Real-time Monitoring

When `realtimeDashboard: true`:
```javascript
// WebSocket-based real-time monitoring
✅ Live system metrics (CPU, Memory, Disk)
✅ Database performance monitoring
✅ Real-time alerts and notifications
✅ Connected clients tracking
✅ Custom dashboard widgets
```

## 🔄 Replication & HA

When `replication: true`:
```javascript
// Master-slave replication
✅ Automatic failover
✅ Read scaling with multiple slaves
✅ Conflict resolution
✅ Network partition tolerance
✅ Real-time synchronization
```

## 💡 Best Practices

### For Development
```javascript
modules: {
  authentication: false,  // Simple development
  hsm: false,            // No security overhead
  restAPI: true,         // Quick API testing
}
```

### For Production
```javascript
modules: {
  authentication: true,   // Secure user management
  hsm: true,             // Maximum security
  replication: true,     // High availability
  monitoring: true,      // Performance tracking
  apiGateway: true,      // Load balancing
}
```

### For Microservices
```javascript
modules: {
  restAPI: true,         // API endpoints
  authentication: true,  // JWT tokens
  monitoring: true,      // Health checks
  // Keep lightweight
}
```

## 🛠️ Migration Guide

### From v1.4.x to v1.5.0
```javascript
// Old way (everything enabled)
const db = new BigBaseAlpha(options);

// New way (modular)
const db = new BigBaseAlpha({
  ...options,
  modules: {
    // Explicitly enable needed features
    authentication: true,
    restAPI: true,
    // Everything else defaults to false
  }
});
```

## 📋 Environment Variables

```bash
# Set default module configuration
BIGBASE_MODULES_AUTH=true
BIGBASE_MODULES_HSM=true  
BIGBASE_MODULES_API=true
BIGBASE_SILENT=false
```

---

**BigBaseAlpha v1.5.0**: *Clean, Modular, Enterprise-Ready Database System*

Choose your features. Build your database. Scale your way. 🚀
