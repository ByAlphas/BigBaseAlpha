const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src/dashboard')));

// In-memory data storage for demo
let streams = [];
let processors = [];
let analytics = [];
let events = [];
let systemStats = {
    startTime: Date.now(),
    totalEvents: 0,
    totalProcessed: 0,
    errors: 0
};

// Generate sample data
function generateSampleData() {
    // Sample streams
    streams = [
        {
            id: 'user-events',
            type: 'unbounded',
            format: 'json',
            description: 'User activity events',
            active: true,
            eventCount: 1250,
            createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 'sensor-data',
            type: 'unbounded',
            format: 'json',
            description: 'IoT sensor readings',
            active: true,
            eventCount: 5830,
            createdAt: new Date(Date.now() - 43200000).toISOString()
        },
        {
            id: 'transaction-stream',
            type: 'bounded',
            format: 'json',
            description: 'Financial transactions',
            active: false,
            eventCount: 890,
            createdAt: new Date(Date.now() - 21600000).toISOString()
        }
    ];

    // Sample processors
    processors = [
        {
            id: 'filter-1',
            streamId: 'user-events',
            type: 'filter',
            function: 'event => event.action === "click"',
            active: true,
            processedCount: 450,
            createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'aggregator-1',
            streamId: 'sensor-data',
            type: 'aggregate',
            function: 'events => events.reduce((sum, e) => sum + e.value, 0)',
            active: true,
            processedCount: 1200,
            createdAt: new Date(Date.now() - 7200000).toISOString()
        }
    ];

    // Sample analytics
    analytics = [
        {
            id: 'user-clicks-agg',
            name: 'User Clicks Aggregation',
            type: 'aggregation',
            streamId: 'user-events',
            lastResult: '245 clicks/hour',
            createdAt: new Date(Date.now() - 1800000).toISOString()
        },
        {
            id: 'temp-avg',
            name: 'Temperature Average',
            type: 'continuous_query',
            streamId: 'sensor-data',
            lastResult: '23.5°C',
            createdAt: new Date(Date.now() - 2700000).toISOString()
        }
    ];

    console.log('✅ Sample data generated for Stream Processing API');
}

// Initialize sample data
generateSampleData();

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function updateSystemStats() {
    systemStats.totalEvents = events.length;
    systemStats.totalProcessed = processors.reduce((sum, p) => sum + (p.processedCount || 0), 0);
}

// ===== STREAM PROCESSING API ENDPOINTS =====

// Get stream analytics overview
app.get('/api/stream/analytics', (req, res) => {
    updateSystemStats();
    
    const analytics = {
        totalStreams: streams.length,
        activeStreams: streams.filter(s => s.active).length,
        eventsPerSecond: Math.floor(Math.random() * 100) + 50,
        totalProcessors: processors.length,
        runningProcessors: processors.filter(p => p.active).length,
        processingRate: Math.floor(Math.random() * 500) + 200,
        activeWindows: Math.floor(Math.random() * 10) + 3,
        continuousQueries: analytics.filter(a => a.type === 'continuous_query').length,
        streamJoins: Math.floor(Math.random() * 5) + 1,
        avgLatency: Math.floor(Math.random() * 50) + 10,
        throughput: Math.floor(Math.random() * 100) + 50,
        memoryUsage: Math.floor(Math.random() * 30) + 45
    };
    
    res.json(analytics);
});

// Stream management endpoints
app.get('/api/streams', (req, res) => {
    res.json(streams);
});

app.post('/api/streams', (req, res) => {
    const { id, type, format, description } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'Stream ID is required' });
    }
    
    if (streams.find(s => s.id === id)) {
        return res.status(409).json({ error: 'Stream with this ID already exists' });
    }
    
    const newStream = {
        id,
        type: type || 'unbounded',
        format: format || 'json',
        description: description || '',
        active: true,
        eventCount: 0,
        createdAt: new Date().toISOString()
    };
    
    streams.push(newStream);
    res.status(201).json(newStream);
});

app.get('/api/streams/:id', (req, res) => {
    const stream = streams.find(s => s.id === req.params.id);
    if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
    }
    res.json(stream);
});

app.delete('/api/streams/:id', (req, res) => {
    const index = streams.findIndex(s => s.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Stream not found' });
    }
    
    const deletedStream = streams.splice(index, 1)[0];
    
    // Also remove related processors
    processors = processors.filter(p => p.streamId !== req.params.id);
    
    res.json({ message: 'Stream deleted successfully', stream: deletedStream });
});

// Publish event to stream
app.post('/api/streams/:id/publish', (req, res) => {
    const stream = streams.find(s => s.id === req.params.id);
    if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
    }
    
    const event = {
        id: generateId(),
        streamId: req.params.id,
        data: req.body,
        timestamp: new Date().toISOString()
    };
    
    events.push(event);
    stream.eventCount = (stream.eventCount || 0) + 1;
    
    // Simulate processing by relevant processors
    const streamProcessors = processors.filter(p => p.streamId === req.params.id && p.active);
    streamProcessors.forEach(processor => {
        processor.processedCount = (processor.processedCount || 0) + 1;
    });
    
    res.json({ 
        eventId: event.id, 
        message: 'Event published successfully',
        processedBy: streamProcessors.length
    });
});

// Processor management endpoints
app.get('/api/processors', (req, res) => {
    res.json(processors);
});

app.post('/api/processors', (req, res) => {
    const { streamId, type, function: processingFunction } = req.body;
    
    if (!streamId || !type) {
        return res.status(400).json({ error: 'StreamId and type are required' });
    }
    
    const stream = streams.find(s => s.id === streamId);
    if (!stream) {
        return res.status(404).json({ error: 'Target stream not found' });
    }
    
    const newProcessor = {
        id: generateId(),
        streamId,
        type,
        function: processingFunction || '',
        active: true,
        processedCount: 0,
        createdAt: new Date().toISOString()
    };
    
    processors.push(newProcessor);
    res.status(201).json(newProcessor);
});

app.delete('/api/processors/:id', (req, res) => {
    const index = processors.findIndex(p => p.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Processor not found' });
    }
    
    const deletedProcessor = processors.splice(index, 1)[0];
    res.json({ message: 'Processor deleted successfully', processor: deletedProcessor });
});

// Analytics endpoints
app.get('/api/analytics', (req, res) => {
    res.json(analytics);
});

app.post('/api/analytics/aggregation', (req, res) => {
    const { sourceStreamId, config } = req.body;
    
    if (!sourceStreamId) {
        return res.status(400).json({ error: 'Source stream ID is required' });
    }
    
    const sourceStream = streams.find(s => s.id === sourceStreamId);
    if (!sourceStream) {
        return res.status(404).json({ error: 'Source stream not found' });
    }
    
    const outputStreamId = `${sourceStreamId}_aggregation_${Date.now()}`;
    
    // Create output stream
    const outputStream = {
        id: outputStreamId,
        type: 'bounded',
        format: 'json',
        description: `Aggregation results for ${sourceStreamId}`,
        active: true,
        eventCount: 0,
        createdAt: new Date().toISOString()
    };
    
    streams.push(outputStream);
    
    // Create analytics entry
    const newAnalytics = {
        id: generateId(),
        name: `${config.type} Aggregation`,
        type: 'aggregation',
        streamId: sourceStreamId,
        outputStreamId,
        config,
        lastResult: 'Calculating...',
        createdAt: new Date().toISOString()
    };
    
    analytics.push(newAnalytics);
    
    res.status(201).json({
        message: 'Aggregation stream created successfully',
        sourceStreamId,
        outputStreamId,
        analytics: newAnalytics
    });
});

app.delete('/api/analytics/:id', (req, res) => {
    const index = analytics.findIndex(a => a.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Analytics not found' });
    }
    
    const deletedAnalytics = analytics.splice(index, 1)[0];
    res.json({ message: 'Analytics deleted successfully', analytics: deletedAnalytics });
});

// Performance monitoring endpoints
app.get('/api/stream/performance', (req, res) => {
    const performance = {
        cpuUsage: Math.floor(Math.random() * 40) + 30,
        memoryUsage: Math.floor(Math.random() * 200) + 150,
        networkIO: Math.floor(Math.random() * 1000) + 500,
        latency: Math.floor(Math.random() * 50) + 10,
        throughput: Math.floor(Math.random() * 100) + 50,
        errorRate: Math.random() * 2,
        timestamp: new Date().toISOString()
    };
    
    res.json(performance);
});

app.get('/api/stream/status', (req, res) => {
    const uptime = Date.now() - systemStats.startTime;
    const uptimeMinutes = Math.floor(uptime / 60000);
    
    const status = {
        engineStatus: 'running',
        uptime: uptimeMinutes,
        totalStreams: streams.length,
        activeStreams: streams.filter(s => s.active).length,
        totalProcessors: processors.length,
        runningProcessors: processors.filter(p => p.active).length,
        totalEvents: systemStats.totalEvents,
        totalProcessed: systemStats.totalProcessed,
        errorRate: systemStats.errors / Math.max(systemStats.totalEvents, 1) * 100,
        timestamp: new Date().toISOString()
    };
    
    res.json(status);
});

// Window management endpoints
app.post('/api/windows', (req, res) => {
    const { streamId, type, size, trigger } = req.body;
    
    if (!streamId || !type) {
        return res.status(400).json({ error: 'StreamId and type are required' });
    }
    
    const stream = streams.find(s => s.id === streamId);
    if (!stream) {
        return res.status(404).json({ error: 'Target stream not found' });
    }
    
    const newWindow = {
        id: generateId(),
        streamId,
        type,
        size: size || 5000,
        trigger: trigger || 'time',
        active: true,
        triggeredCount: 0,
        createdAt: new Date().toISOString()
    };
    
    res.status(201).json(newWindow);
});

// Continuous query endpoints
app.post('/api/queries/continuous', (req, res) => {
    const { queryId, streamId, query } = req.body;
    
    if (!queryId || !streamId) {
        return res.status(400).json({ error: 'QueryId and streamId are required' });
    }
    
    const stream = streams.find(s => s.id === streamId);
    if (!stream) {
        return res.status(404).json({ error: 'Target stream not found' });
    }
    
    const newQuery = {
        id: queryId,
        streamId,
        query: query || '',
        active: true,
        resultCount: 0,
        createdAt: new Date().toISOString()
    };
    
    // Add to analytics
    analytics.push({
        id: generateId(),
        name: `Continuous Query: ${queryId}`,
        type: 'continuous_query',
        streamId,
        queryId,
        lastResult: 'Executing...',
        createdAt: new Date().toISOString()
    });
    
    res.status(201).json(newQuery);
});

// Stream join endpoints
app.post('/api/joins', (req, res) => {
    const { leftStreamId, rightStreamId, joinType, condition } = req.body;
    
    if (!leftStreamId || !rightStreamId) {
        return res.status(400).json({ error: 'Both stream IDs are required' });
    }
    
    const leftStream = streams.find(s => s.id === leftStreamId);
    const rightStream = streams.find(s => s.id === rightStreamId);
    
    if (!leftStream || !rightStream) {
        return res.status(404).json({ error: 'One or both streams not found' });
    }
    
    const joinId = generateId();
    const outputStreamId = `join_${leftStreamId}_${rightStreamId}_${joinId}`;
    
    // Create output stream for join results
    const outputStream = {
        id: outputStreamId,
        type: 'unbounded',
        format: 'json',
        description: `Join results: ${leftStreamId} ${joinType || 'inner'} ${rightStreamId}`,
        active: true,
        eventCount: 0,
        createdAt: new Date().toISOString()
    };
    
    streams.push(outputStream);
    
    const joinProcessor = {
        id: joinId,
        type: 'join',
        leftStreamId,
        rightStreamId,
        outputStreamId,
        joinType: joinType || 'inner',
        condition: condition || '',
        active: true,
        processedCount: 0,
        createdAt: new Date().toISOString()
    };
    
    res.status(201).json({
        message: 'Stream join created successfully',
        join: joinProcessor,
        outputStream
    });
});

// Dashboard routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/dashboard/stream-dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/dashboard/stream-dashboard.html'));
});

app.get('/stream-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/dashboard/stream-dashboard.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - systemStats.startTime,
        streams: streams.length,
        processors: processors.length,
        events: events.length
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    systemStats.errors++;
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Simulate real-time events
function simulateRealTimeEvents() {
    setInterval(() => {
        if (streams.length > 0) {
            const randomStream = streams[Math.floor(Math.random() * streams.length)];
            if (randomStream.active) {
                const sampleEvent = {
                    id: generateId(),
                    streamId: randomStream.id,
                    data: {
                        value: Math.floor(Math.random() * 100),
                        timestamp: Date.now(),
                        action: ['click', 'view', 'purchase', 'login'][Math.floor(Math.random() * 4)]
                    },
                    timestamp: new Date().toISOString()
                };
                
                events.push(sampleEvent);
                randomStream.eventCount = (randomStream.eventCount || 0) + 1;
                
                // Keep only last 1000 events to prevent memory issues
                if (events.length > 1000) {
                    events = events.slice(-1000);
                }
            }
        }
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds
}

// Start the server
app.listen(PORT, () => {
    console.log('🚀 BigBaseAlpha Stream Processing Mock Server started');
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
    console.log(`💡 Health Check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('📋 Available Endpoints:');
    console.log('  GET  /api/stream/analytics     - Stream processing overview');
    console.log('  GET  /api/streams              - List all streams');
    console.log('  POST /api/streams              - Create new stream');
    console.log('  POST /api/streams/:id/publish  - Publish event to stream');
    console.log('  GET  /api/processors           - List all processors');
    console.log('  POST /api/processors           - Create stream processor');
    console.log('  GET  /api/analytics            - List analytics');
    console.log('  POST /api/analytics/aggregation - Create aggregation stream');
    console.log('  GET  /api/stream/performance   - Get performance metrics');
    console.log('  GET  /api/stream/status        - Get system status');
    console.log('  POST /api/windows              - Create window');
    console.log('  POST /api/queries/continuous   - Create continuous query');
    console.log('  POST /api/joins                - Create stream join');
    console.log('');
    
    // Start real-time event simulation
    simulateRealTimeEvents();
    console.log('🔄 Real-time event simulation started');
});

module.exports = app;
