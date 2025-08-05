/**
 * BigBaseAlpha - Distributed Computing Engine
 * Parallel processing support and distributed computing system
 * 
 * Features:
 * - Task Distribution & Load Balancing
 * - Worker Pool Management
 * - Map-Reduce Operations
 * - Parallel Query Processing
 * - Real-time Performance Analytics
 * - Fault Tolerance & Recovery
 * - Resource Monitoring
 * - Cluster Coordination
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DistributedComputingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxWorkers: options.maxWorkers || os.cpus().length,
            workerTimeout: options.workerTimeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            loadBalancingStrategy: options.loadBalancingStrategy || 'round-robin',
            enableClustering: options.enableClustering || true,
            enableAnalytics: options.enableAnalytics || true,
            ...options
        };

        this.workers = new Map();
        this.workQueue = [];
        this.activeJobs = new Map();
        this.completedJobs = new Map();
        this.statistics = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            workerUtilization: {},
            resourceUsage: {
                cpu: 0,
                memory: 0,
                disk: 0
            },
            performanceMetrics: []
        };

        this.clusters = new Map();
        this.nodeInfo = {
            id: this.generateNodeId(),
            type: 'master',
            startTime: Date.now(),
            capabilities: this.getNodeCapabilities()
        };

        this.initializeWorkerPool();
        this.startPerformanceMonitoring();
    }

    /**
     * Initialize Worker Pool
     */
    initializeWorkerPool() {
        console.log(`🔄 Initializing ${this.options.maxWorkers} workers...`);
        
        for (let i = 0; i < this.options.maxWorkers; i++) {
            this.createWorker(i);
        }

        this.emit('workerPoolInitialized', {
            workerCount: this.workers.size,
            timestamp: Date.now()
        });
    }

    /**
     * Create a new worker
     */
    createWorker(workerId) {
        try {
            const workerScript = path.join(__dirname, 'worker.js');
            const worker = new Worker(workerScript, {
                workerData: { workerId }
            });

            const workerInfo = {
                id: workerId,
                worker,
                status: 'idle',
                currentJob: null,
                jobsCompleted: 0,
                totalExecutionTime: 0,
                lastActivity: Date.now(),
                errors: 0
            };

            worker.on('message', (message) => {
                this.handleWorkerMessage(workerId, message);
            });

            worker.on('error', (error) => {
                this.handleWorkerError(workerId, error);
            });

            worker.on('exit', (code) => {
                this.handleWorkerExit(workerId, code);
            });

            this.workers.set(workerId, workerInfo);
            this.statistics.workerUtilization[workerId] = {
                utilization: 0,
                jobsCompleted: 0,
                averageExecutionTime: 0
            };

            console.log(`✅ Worker ${workerId} created`);
            
        } catch (error) {
            console.error(`❌ Failed to create worker ${workerId}:`, error);
        }
    }

    /**
     * Distribute and execute tasks
     */
    async distributeTask(taskType, data, options = {}) {
        const jobId = this.generateJobId();
        const job = {
            id: jobId,
            type: taskType,
            data,
            options: {
                priority: options.priority || 'normal',
                timeout: options.timeout || this.options.workerTimeout,
                retryAttempts: options.retryAttempts || this.options.retryAttempts,
                partitionStrategy: options.partitionStrategy || 'auto',
                ...options
            },
            status: 'queued',
            createdAt: Date.now(),
            attempts: 0,
            results: null,
            error: null
        };

        this.activeJobs.set(jobId, job);
        this.statistics.totalJobs++;

        // Partition data if needed
        const partitions = this.partitionData(data, job.options.partitionStrategy);
        
        if (partitions.length > 1) {
            return this.executeDistributedJob(job, partitions);
        } else {
            return this.executeSingleJob(job);
        }
    }

    /**
     * Execute single job
     */
    async executeSingleJob(job) {
        return new Promise((resolve, reject) => {
            const worker = this.selectWorker();
            
            if (!worker) {
                this.workQueue.push({ job, resolve, reject });
                return;
            }

            this.assignJobToWorker(worker.id, job, resolve, reject);
        });
    }

    /**
     * Execute distributed job with multiple partitions
     */
    async executeDistributedJob(job, partitions) {
        const subJobs = partitions.map((partition, index) => ({
            ...job,
            id: `${job.id}_${index}`,
            data: partition,
            parentJobId: job.id,
            partitionIndex: index
        }));

        const results = await Promise.allSettled(
            subJobs.map(subJob => this.executeSingleJob(subJob))
        );

        // Merge results
        const mergedResult = this.mergeResults(job.type, results);
        
        job.status = 'completed';
        job.results = mergedResult;
        job.completedAt = Date.now();
        job.executionTime = job.completedAt - job.createdAt;

        this.completedJobs.set(job.id, job);
        this.activeJobs.delete(job.id);
        
        this.updateStatistics(job);
        this.emit('jobCompleted', job);

        return mergedResult;
    }

    /**
     * Assign job to worker
     */
    assignJobToWorker(workerId, job, resolve, reject) {
        const workerInfo = this.workers.get(workerId);
        
        if (!workerInfo || workerInfo.status !== 'idle') {
            this.workQueue.push({ job, resolve, reject });
            return;
        }

        workerInfo.status = 'busy';
        workerInfo.currentJob = job;
        workerInfo.lastActivity = Date.now();

        const timeout = setTimeout(() => {
            this.handleJobTimeout(workerId, job);
            reject(new Error(`Job ${job.id} timed out`));
        }, job.options.timeout);

        workerInfo.worker.postMessage({
            type: 'executeJob',
            job: {
                id: job.id,
                type: job.type,
                data: job.data,
                options: job.options
            }
        });

        // Store resolve/reject for later use
        workerInfo.currentJob.resolve = resolve;
        workerInfo.currentJob.reject = reject;
        workerInfo.currentJob.timeout = timeout;
    }

    /**
     * Handle worker messages
     */
    handleWorkerMessage(workerId, message) {
        const workerInfo = this.workers.get(workerId);
        
        if (!workerInfo) return;

        switch (message.type) {
            case 'jobCompleted':
                this.handleJobCompleted(workerId, message);
                break;
                
            case 'jobFailed':
                this.handleJobFailed(workerId, message);
                break;
                
            case 'status':
                this.handleWorkerStatus(workerId, message);
                break;
                
            default:
                console.warn(`Unknown message type from worker ${workerId}:`, message.type);
        }
    }

    /**
     * Handle job completion
     */
    handleJobCompleted(workerId, message) {
        const workerInfo = this.workers.get(workerId);
        const job = workerInfo.currentJob;

        if (!job) return;

        clearTimeout(job.timeout);
        
        job.status = 'completed';
        job.results = message.result;
        job.completedAt = Date.now();
        job.executionTime = job.completedAt - job.createdAt;

        this.completedJobs.set(job.id, job);
        this.activeJobs.delete(job.id);

        workerInfo.status = 'idle';
        workerInfo.currentJob = null;
        workerInfo.jobsCompleted++;
        workerInfo.totalExecutionTime += job.executionTime;

        this.updateStatistics(job);
        this.emit('jobCompleted', job);

        if (job.resolve) {
            job.resolve(job.results);
        }

        // Process next job in queue
        this.processWorkQueue();
    }

    /**
     * Handle job failure
     */
    handleJobFailed(workerId, message) {
        const workerInfo = this.workers.get(workerId);
        const job = workerInfo.currentJob;

        if (!job) return;

        clearTimeout(job.timeout);
        
        job.attempts++;
        job.error = message.error;

        if (job.attempts < job.options.retryAttempts) {
            // Retry job
            console.log(`🔄 Retrying job ${job.id} (attempt ${job.attempts + 1})`);
            workerInfo.status = 'idle';
            workerInfo.currentJob = null;
            this.assignJobToWorker(workerId, job, job.resolve, job.reject);
        } else {
            // Job failed permanently
            job.status = 'failed';
            job.failedAt = Date.now();

            this.activeJobs.delete(job.id);
            this.statistics.failedJobs++;

            workerInfo.status = 'idle';
            workerInfo.currentJob = null;
            workerInfo.errors++;

            this.emit('jobFailed', job);

            if (job.reject) {
                job.reject(new Error(job.error));
            }

            this.processWorkQueue();
        }
    }

    /**
     * Process work queue
     */
    processWorkQueue() {
        if (this.workQueue.length === 0) return;

        const availableWorker = this.selectWorker();
        if (!availableWorker) return;

        const { job, resolve, reject } = this.workQueue.shift();
        this.assignJobToWorker(availableWorker.id, job, resolve, reject);
    }

    /**
     * Select best worker based on load balancing strategy
     */
    selectWorker() {
        const idleWorkers = Array.from(this.workers.values())
            .filter(worker => worker.status === 'idle');

        if (idleWorkers.length === 0) return null;

        switch (this.options.loadBalancingStrategy) {
            case 'round-robin':
                return this.selectRoundRobinWorker(idleWorkers);
                
            case 'least-loaded':
                return this.selectLeastLoadedWorker(idleWorkers);
                
            case 'fastest':
                return this.selectFastestWorker(idleWorkers);
                
            default:
                return idleWorkers[0];
        }
    }

    /**
     * Select worker using round-robin strategy
     */
    selectRoundRobinWorker(workers) {
        if (!this.lastSelectedWorker) {
            this.lastSelectedWorker = 0;
        }
        
        this.lastSelectedWorker = (this.lastSelectedWorker + 1) % workers.length;
        return workers[this.lastSelectedWorker];
    }

    /**
     * Select least loaded worker
     */
    selectLeastLoadedWorker(workers) {
        return workers.reduce((least, current) => {
            return current.jobsCompleted < least.jobsCompleted ? current : least;
        });
    }

    /**
     * Select fastest worker
     */
    selectFastestWorker(workers) {
        return workers.reduce((fastest, current) => {
            const currentAvg = current.jobsCompleted > 0 ? 
                current.totalExecutionTime / current.jobsCompleted : Infinity;
            const fastestAvg = fastest.jobsCompleted > 0 ? 
                fastest.totalExecutionTime / fastest.jobsCompleted : Infinity;
            
            return currentAvg < fastestAvg ? current : fastest;
        });
    }

    /**
     * Partition data for distributed processing
     */
    partitionData(data, strategy = 'auto') {
        if (!Array.isArray(data)) {
            return [data];
        }

        const maxPartitions = Math.min(this.workers.size, data.length);
        
        if (maxPartitions <= 1) {
            return [data];
        }

        switch (strategy) {
            case 'chunks':
                return this.partitionByChunks(data, maxPartitions);
                
            case 'size':
                return this.partitionBySize(data, maxPartitions);
                
            case 'auto':
                return data.length > 1000 ? 
                    this.partitionByChunks(data, maxPartitions) : [data];
                
            default:
                return [data];
        }
    }

    /**
     * Partition data by chunks
     */
    partitionByChunks(data, partitionCount) {
        const chunkSize = Math.ceil(data.length / partitionCount);
        const partitions = [];

        for (let i = 0; i < data.length; i += chunkSize) {
            partitions.push(data.slice(i, i + chunkSize));
        }

        return partitions;
    }

    /**
     * Partition data by size
     */
    partitionBySize(data, maxSize) {
        const partitions = [];
        
        for (let i = 0; i < data.length; i += maxSize) {
            partitions.push(data.slice(i, i + maxSize));
        }

        return partitions;
    }

    /**
     * Merge results from distributed execution
     */
    mergeResults(jobType, results) {
        const successfulResults = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);

        switch (jobType) {
            case 'map':
                return successfulResults.flat();
                
            case 'reduce':
                return successfulResults.reduce((acc, val) => acc + val, 0);
                
            case 'filter':
                return successfulResults.flat();
                
            case 'query':
                return successfulResults.flat();
                
            case 'aggregate':
                return this.mergeAggregationResults(successfulResults);
                
            default:
                return successfulResults;
        }
    }

    /**
     * Merge aggregation results
     */
    mergeAggregationResults(results) {
        const merged = {};
        
        results.forEach(result => {
            Object.keys(result).forEach(key => {
                if (typeof result[key] === 'number') {
                    merged[key] = (merged[key] || 0) + result[key];
                } else if (Array.isArray(result[key])) {
                    merged[key] = (merged[key] || []).concat(result[key]);
                } else {
                    merged[key] = result[key];
                }
            });
        });

        return merged;
    }

    /**
     * Map-Reduce operation
     */
    async mapReduce(data, mapFunction, reduceFunction, options = {}) {
        console.log('🗺️ Starting Map-Reduce operation...');

        // Map phase
        const mapResults = await this.distributeTask('map', {
            data,
            mapFunction: mapFunction.toString()
        }, {
            ...options,
            partitionStrategy: 'chunks'
        });

        // Reduce phase
        const reduceResult = await this.distributeTask('reduce', {
            data: mapResults,
            reduceFunction: reduceFunction.toString()
        }, {
            ...options,
            partitionStrategy: 'chunks'
        });

        return reduceResult;
    }

    /**
     * Parallel query processing
     */
    async parallelQuery(collections, queryFunction, options = {}) {
        console.log('🔍 Starting parallel query processing...');

        const queryResults = await Promise.allSettled(
            collections.map(collection => 
                this.distributeTask('query', {
                    collection,
                    queryFunction: queryFunction.toString()
                }, options)
            )
        );

        return queryResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .flat();
    }

    /**
     * Batch processing
     */
    async batchProcess(items, processingFunction, options = {}) {
        console.log(`📦 Starting batch processing of ${items.length} items...`);

        return this.distributeTask('batch', {
            items,
            processingFunction: processingFunction.toString()
        }, {
            ...options,
            partitionStrategy: 'chunks'
        });
    }

    /**
     * Performance analytics
     */
    async analyzePerformance(timeRange = 3600000) { // 1 hour default
        const now = Date.now();
        const since = now - timeRange;

        const recentJobs = Array.from(this.completedJobs.values())
            .filter(job => job.completedAt >= since);

        const analytics = {
            timeRange: {
                start: since,
                end: now,
                duration: timeRange
            },
            jobMetrics: {
                total: recentJobs.length,
                avgExecutionTime: recentJobs.length > 0 ? 
                    recentJobs.reduce((sum, job) => sum + job.executionTime, 0) / recentJobs.length : 0,
                minExecutionTime: recentJobs.length > 0 ? 
                    Math.min(...recentJobs.map(job => job.executionTime)) : 0,
                maxExecutionTime: recentJobs.length > 0 ? 
                    Math.max(...recentJobs.map(job => job.executionTime)) : 0,
                throughput: recentJobs.length / (timeRange / 1000) // jobs per second
            },
            workerMetrics: this.getWorkerMetrics(),
            resourceMetrics: await this.getResourceMetrics(),
            trends: this.calculatePerformanceTrends(recentJobs),
            bottlenecks: this.identifyBottlenecks(),
            recommendations: this.generateOptimizationRecommendations()
        };

        this.emit('performanceAnalyzed', analytics);
        return analytics;
    }

    /**
     * Get worker metrics
     */
    getWorkerMetrics() {
        const metrics = {};
        
        this.workers.forEach((worker, id) => {
            const utilization = worker.jobsCompleted > 0 ? 
                (worker.totalExecutionTime / (Date.now() - this.nodeInfo.startTime)) * 100 : 0;
            
            metrics[id] = {
                status: worker.status,
                jobsCompleted: worker.jobsCompleted,
                averageExecutionTime: worker.jobsCompleted > 0 ? 
                    worker.totalExecutionTime / worker.jobsCompleted : 0,
                utilization: Math.min(utilization, 100),
                errors: worker.errors,
                lastActivity: worker.lastActivity
            };
        });

        return metrics;
    }

    /**
     * Get resource metrics
     */
    async getResourceMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                external: memUsage.external,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
                percentage: this.statistics.resourceUsage.cpu
            },
            workers: {
                total: this.workers.size,
                active: Array.from(this.workers.values()).filter(w => w.status === 'busy').length,
                idle: Array.from(this.workers.values()).filter(w => w.status === 'idle').length
            }
        };
    }

    /**
     * Calculate performance trends
     */
    calculatePerformanceTrends(jobs) {
        if (jobs.length < 2) return null;

        const sortedJobs = jobs.sort((a, b) => a.completedAt - b.completedAt);
        const timeWindows = this.createTimeWindows(sortedJobs, 10); // 10 windows
        
        const trends = timeWindows.map(window => ({
            timeRange: window.timeRange,
            jobCount: window.jobs.length,
            avgExecutionTime: window.jobs.length > 0 ? 
                window.jobs.reduce((sum, job) => sum + job.executionTime, 0) / window.jobs.length : 0,
            throughput: window.jobs.length / (window.timeRange.duration / 1000)
        }));

        return {
            executionTime: this.calculateTrend(trends.map(t => t.avgExecutionTime)),
            throughput: this.calculateTrend(trends.map(t => t.throughput)),
            windows: trends
        };
    }

    /**
     * Create time windows for trend analysis
     */
    createTimeWindows(jobs, windowCount) {
        if (jobs.length === 0) return [];

        const startTime = jobs[0].completedAt;
        const endTime = jobs[jobs.length - 1].completedAt;
        const windowDuration = (endTime - startTime) / windowCount;

        const windows = [];
        
        for (let i = 0; i < windowCount; i++) {
            const windowStart = startTime + (i * windowDuration);
            const windowEnd = windowStart + windowDuration;
            
            const windowJobs = jobs.filter(job => 
                job.completedAt >= windowStart && job.completedAt < windowEnd
            );

            windows.push({
                timeRange: {
                    start: windowStart,
                    end: windowEnd,
                    duration: windowDuration
                },
                jobs: windowJobs
            });
        }

        return windows;
    }

    /**
     * Calculate trend (increasing/decreasing/stable)
     */
    calculateTrend(values) {
        if (values.length < 2) return 'insufficient_data';

        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));

        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

        const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (Math.abs(percentChange) < 5) return 'stable';
        return percentChange > 0 ? 'increasing' : 'decreasing';
    }

    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks() {
        const bottlenecks = [];
        const workerMetrics = this.getWorkerMetrics();

        // Worker utilization bottlenecks
        const avgUtilization = Object.values(workerMetrics)
            .reduce((sum, metric) => sum + metric.utilization, 0) / Object.keys(workerMetrics).length;

        if (avgUtilization > 80) {
            bottlenecks.push({
                type: 'high_worker_utilization',
                severity: 'high',
                description: 'Worker utilization is above 80%',
                recommendation: 'Consider increasing worker pool size'
            });
        }

        // Memory usage bottlenecks
        if (this.statistics.resourceUsage.memory > 85) {
            bottlenecks.push({
                type: 'high_memory_usage',
                severity: 'high',
                description: 'Memory usage is above 85%',
                recommendation: 'Optimize memory usage or increase available memory'
            });
        }

        // Queue length bottlenecks
        if (this.workQueue.length > 10) {
            bottlenecks.push({
                type: 'long_work_queue',
                severity: 'medium',
                description: 'Work queue is backing up',
                recommendation: 'Increase worker count or optimize job processing'
            });
        }

        // Error rate bottlenecks
        const totalErrors = Object.values(workerMetrics)
            .reduce((sum, metric) => sum + metric.errors, 0);
        const errorRate = this.statistics.totalJobs > 0 ? 
            (totalErrors / this.statistics.totalJobs) * 100 : 0;

        if (errorRate > 5) {
            bottlenecks.push({
                type: 'high_error_rate',
                severity: 'high',
                description: `Error rate is ${errorRate.toFixed(1)}%`,
                recommendation: 'Review job implementations and error handling'
            });
        }

        return bottlenecks;
    }

    /**
     * Generate optimization recommendations
     */
    generateOptimizationRecommendations() {
        const recommendations = [];
        const workerMetrics = this.getWorkerMetrics();

        // Worker pool optimization
        const avgUtilization = Object.values(workerMetrics)
            .reduce((sum, metric) => sum + metric.utilization, 0) / Object.keys(workerMetrics).length;

        if (avgUtilization < 30) {
            recommendations.push({
                type: 'reduce_workers',
                priority: 'low',
                description: 'Worker utilization is low, consider reducing worker pool size',
                impact: 'Reduced resource consumption'
            });
        } else if (avgUtilization > 80) {
            recommendations.push({
                type: 'increase_workers',
                priority: 'high',
                description: 'Worker utilization is high, consider increasing worker pool size',
                impact: 'Improved throughput and reduced latency'
            });
        }

        // Load balancing optimization
        const utilizationVariance = this.calculateUtilizationVariance(workerMetrics);
        if (utilizationVariance > 20) {
            recommendations.push({
                type: 'improve_load_balancing',
                priority: 'medium',
                description: 'Worker load is uneven, consider improving load balancing strategy',
                impact: 'Better resource utilization'
            });
        }

        // Partitioning optimization
        if (this.statistics.averageExecutionTime > 5000) {
            recommendations.push({
                type: 'optimize_partitioning',
                priority: 'medium',
                description: 'Jobs are taking long to execute, consider better data partitioning',
                impact: 'Reduced execution time through better parallelization'
            });
        }

        return recommendations;
    }

    /**
     * Calculate utilization variance
     */
    calculateUtilizationVariance(workerMetrics) {
        const utilizations = Object.values(workerMetrics).map(m => m.utilization);
        const avg = utilizations.reduce((sum, val) => sum + val, 0) / utilizations.length;
        const variance = utilizations.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / utilizations.length;
        return Math.sqrt(variance);
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updateResourceUsage();
            this.recordPerformanceMetrics();
        }, 5000); // Every 5 seconds
    }

    /**
     * Update resource usage statistics
     */
    updateResourceUsage() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        this.statistics.resourceUsage = {
            memory: (memUsage.heapUsed / memUsage.heapTotal) * 100,
            cpu: ((cpuUsage.user + cpuUsage.system) / 1000000) / 1000, // Convert to seconds
            disk: 0 // Placeholder for disk usage
        };
    }

    /**
     * Record performance metrics
     */
    recordPerformanceMetrics() {
        const timestamp = Date.now();
        const metrics = {
            timestamp,
            activeJobs: this.activeJobs.size,
            queueLength: this.workQueue.length,
            workerUtilization: this.calculateAverageWorkerUtilization(),
            resourceUsage: { ...this.statistics.resourceUsage },
            throughput: this.calculateCurrentThroughput()
        };

        this.statistics.performanceMetrics.push(metrics);

        // Keep only last 1000 metrics (about 1.4 hours at 5-second intervals)
        if (this.statistics.performanceMetrics.length > 1000) {
            this.statistics.performanceMetrics = this.statistics.performanceMetrics.slice(-1000);
        }

        this.emit('performanceMetricsUpdated', metrics);
    }

    /**
     * Calculate average worker utilization
     */
    calculateAverageWorkerUtilization() {
        const workers = Array.from(this.workers.values());
        const busyWorkers = workers.filter(w => w.status === 'busy').length;
        return (busyWorkers / workers.length) * 100;
    }

    /**
     * Calculate current throughput
     */
    calculateCurrentThroughput() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        const recentJobs = Array.from(this.completedJobs.values())
            .filter(job => job.completedAt >= oneMinuteAgo);

        return recentJobs.length; // Jobs per minute
    }

    /**
     * Update statistics
     */
    updateStatistics(job) {
        this.statistics.completedJobs++;
        this.statistics.totalExecutionTime += job.executionTime;
        this.statistics.averageExecutionTime = 
            this.statistics.totalExecutionTime / this.statistics.completedJobs;

        // Update worker utilization
        const workerInfo = Array.from(this.workers.values())
            .find(w => w.currentJob && w.currentJob.id === job.id);
        
        if (workerInfo) {
            const workerId = workerInfo.id;
            this.statistics.workerUtilization[workerId] = {
                utilization: (workerInfo.totalExecutionTime / (Date.now() - this.nodeInfo.startTime)) * 100,
                jobsCompleted: workerInfo.jobsCompleted,
                averageExecutionTime: workerInfo.totalExecutionTime / workerInfo.jobsCompleted
            };
        }
    }

    /**
     * Get system status
     */
    getSystemStatus() {
        return {
            nodeInfo: this.nodeInfo,
            workers: {
                total: this.workers.size,
                idle: Array.from(this.workers.values()).filter(w => w.status === 'idle').length,
                busy: Array.from(this.workers.values()).filter(w => w.status === 'busy').length
            },
            jobs: {
                active: this.activeJobs.size,
                queued: this.workQueue.length,
                completed: this.statistics.completedJobs,
                failed: this.statistics.failedJobs
            },
            performance: {
                averageExecutionTime: this.statistics.averageExecutionTime,
                throughput: this.calculateCurrentThroughput(),
                resourceUsage: this.statistics.resourceUsage
            }
        };
    }

    /**
     * Utility functions
     */
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getNodeCapabilities() {
        return {
            cpuCores: os.cpus().length,
            totalMemory: os.totalmem(),
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version
        };
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        console.log('🔄 Shutting down distributed computing engine...');

        // Wait for active jobs to complete
        const activeJobPromises = Array.from(this.activeJobs.values())
            .map(job => new Promise(resolve => {
                const checkJob = () => {
                    if (!this.activeJobs.has(job.id)) {
                        resolve();
                    } else {
                        setTimeout(checkJob, 100);
                    }
                };
                checkJob();
            }));

        await Promise.all(activeJobPromises);

        // Terminate all workers
        const terminatePromises = Array.from(this.workers.values())
            .map(workerInfo => workerInfo.worker.terminate());

        await Promise.all(terminatePromises);

        this.workers.clear();
        this.workQueue = [];
        this.activeJobs.clear();

        console.log('✅ Distributed computing engine shut down successfully');
        this.emit('shutdown');
    }
}

export { DistributedComputingEngine };
export default DistributedComputingEngine;
