/**
 * BigBaseAlpha - Distributed Computing Worker
 * Worker thread for parallel job execution
 */

import { parentPort, workerData } from 'worker_threads';

class DistributedWorker {
    constructor(workerId) {
        this.workerId = workerId;
        this.status = 'idle';
        this.currentJob = null;
        
        this.setupMessageHandling();
        this.reportStatus();
    }

    setupMessageHandling() {
        parentPort.on('message', (message) => {
            this.handleMessage(message);
        });
    }

    async handleMessage(message) {
        switch (message.type) {
            case 'executeJob':
                await this.executeJob(message.job);
                break;
                
            case 'ping':
                this.sendMessage({ type: 'pong', workerId: this.workerId });
                break;
                
            default:
                console.warn(`Worker ${this.workerId}: Unknown message type:`, message.type);
        }
    }

    async executeJob(job) {
        this.status = 'busy';
        this.currentJob = job;
        
        try {
            console.log(`Worker ${this.workerId}: Executing job ${job.id} (${job.type})`);
            
            const startTime = Date.now();
            const result = await this.processJob(job);
            const executionTime = Date.now() - startTime;
            
            this.sendMessage({
                type: 'jobCompleted',
                jobId: job.id,
                result,
                executionTime,
                workerId: this.workerId
            });
            
            console.log(`Worker ${this.workerId}: Completed job ${job.id} in ${executionTime}ms`);
            
        } catch (error) {
            console.error(`Worker ${this.workerId}: Job ${job.id} failed:`, error.message);
            
            this.sendMessage({
                type: 'jobFailed',
                jobId: job.id,
                error: error.message,
                workerId: this.workerId
            });
        } finally {
            this.status = 'idle';
            this.currentJob = null;
        }
    }

    async processJob(job) {
        switch (job.type) {
            case 'map':
                return this.processMapJob(job);
                
            case 'reduce':
                return this.processReduceJob(job);
                
            case 'filter':
                return this.processFilterJob(job);
                
            case 'query':
                return this.processQueryJob(job);
                
            case 'batch':
                return this.processBatchJob(job);
                
            case 'aggregate':
                return this.processAggregateJob(job);
                
            case 'sort':
                return this.processSortJob(job);
                
            case 'transform':
                return this.processTransformJob(job);
                
            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }
    }

    // Map operation
    processMapJob(job) {
        const { data, mapFunction } = job.data;
        const mapFn = new Function('return ' + mapFunction)();
        
        return data.map(mapFn);
    }

    // Reduce operation
    processReduceJob(job) {
        const { data, reduceFunction } = job.data;
        const reduceFn = new Function('return ' + reduceFunction)();
        
        return data.reduce(reduceFn);
    }

    // Filter operation
    processFilterJob(job) {
        const { data, filterFunction } = job.data;
        const filterFn = new Function('return ' + filterFunction)();
        
        return data.filter(filterFn);
    }

    // Query operation
    processQueryJob(job) {
        const { collection, queryFunction } = job.data;
        const queryFn = new Function('return ' + queryFunction)();
        
        return collection.filter(queryFn);
    }

    // Batch processing
    processBatchJob(job) {
        const { items, processingFunction } = job.data;
        const processFn = new Function('return ' + processingFunction)();
        
        return items.map(processFn);
    }

    // Aggregation operation
    processAggregateJob(job) {
        const { data, aggregateFunction } = job.data;
        const aggregateFn = new Function('return ' + aggregateFunction)();
        
        return aggregateFn(data);
    }

    // Sort operation
    processSortJob(job) {
        const { data, sortFunction } = job.data;
        const sortFn = sortFunction ? new Function('return ' + sortFunction)() : undefined;
        
        return [...data].sort(sortFn);
    }

    // Transform operation
    processTransformJob(job) {
        const { data, transformFunction } = job.data;
        const transformFn = new Function('return ' + transformFunction)();
        
        return transformFn(data);
    }

    sendMessage(message) {
        parentPort.postMessage(message);
    }

    reportStatus() {
        this.sendMessage({
            type: 'status',
            workerId: this.workerId,
            status: this.status,
            timestamp: Date.now()
        });
    }
}

// Initialize worker
const worker = new DistributedWorker(workerData.workerId);

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log(`Worker ${workerData.workerId}: Shutting down...`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(`Worker ${workerData.workerId}: Terminating...`);
    process.exit(0);
});
