import { performance } from 'perf_hooks';
import os from 'os';
import fs from 'fs';
import TerminalUI from '../ui/index.js';

/**
 * BigBaseAlpha Performance Analytics & Profiling
 * Advanced performance monitoring and analysis tools
 */
class PerformanceAnalytics {
    constructor(options = {}) {
        this.options = {
            sampleInterval: 1000,
            maxSamples: 1000,
            enableProfiling: true,
            logLevel: 'info',
            ...options
        };
        
        this.ui = new TerminalUI();
        this.metrics = {
            queries: [],
            operations: [],
            system: [],
            logs: []
        };
        
        this.profilers = new Map();
        this.isActive = false;
        
        if (this.options.enableProfiling) {
            this.startSystemProfiling();
        }
    }

    /**
     * Start profiling a specific operation
     * @param {string} name - Profile name
     * @param {Object} options - Profiling options
     */
    startProfile(name, options = {}) {
        const profile = {
            name,
            startTime: performance.now(),
            startMemory: process.memoryUsage(),
            startCPU: process.cpuUsage(),
            samples: [],
            options
        };
        
        this.profilers.set(name, profile);
        
        if (options.realtime) {
            this.startRealtimeProfiling(name);
        }
        
        return profile;
    }

    /**
     * End profiling and return results
     * @param {string} name - Profile name
     */
    endProfile(name) {
        const profile = this.profilers.get(name);
        if (!profile) {
            throw new Error(`Profile '${name}' not found`);
        }
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const endCPU = process.cpuUsage(profile.startCPU);
        
        const result = {
            name: profile.name,
            duration: endTime - profile.startTime,
            memoryDelta: {
                rss: endMemory.rss - profile.startMemory.rss,
                heapUsed: endMemory.heapUsed - profile.startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - profile.startMemory.heapTotal,
                external: endMemory.external - profile.startMemory.external
            },
            cpuDelta: {
                user: endCPU.user,
                system: endCPU.system
            },
            samples: profile.samples,
            summary: this.generateProfileSummary(profile, endTime - profile.startTime)
        };
        
        this.profilers.delete(name);
        return result;
    }

    /**
     * Generate profile summary
     */
    generateProfileSummary(profile, duration) {
        return {
            performance: duration < 100 ? 'excellent' : duration < 1000 ? 'good' : 'needs optimization',
            memoryEfficient: Math.abs(profile.startMemory.heapUsed) < 50 * 1024 * 1024,
            recommendations: this.getPerformanceRecommendations(duration, profile.startMemory)
        };
    }

    /**
     * Get performance recommendations
     */
    getPerformanceRecommendations(duration, memoryUsage) {
        const recommendations = [];
        
        if (duration > 1000) {
            recommendations.push('Consider optimizing slow operations');
        }
        
        if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
            recommendations.push('Monitor memory usage for potential leaks');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Performance looks good!');
        }
        
        return recommendations;
    }

    /**
     * Real-time profiling with UI
     */
    startRealtimeProfiling(name) {
        const profile = this.profilers.get(name);
        if (!profile) return;
        
        const interval = setInterval(() => {
            const currentTime = performance.now();
            const currentMemory = process.memoryUsage();
            
            profile.samples.push({
                timestamp: currentTime,
                memory: currentMemory,
                duration: currentTime - profile.startTime
            });
            
            // Create real-time chart
            const memoryData = profile.samples.map(s => s.memory.heapUsed / 1024 / 1024);
            const chart = this.ui.createChart({
                type: 'line',
                values: memoryData.slice(-50) // Last 50 samples
            }, {
                title: `${name} - Memory Usage (MB)`,
                color: 'cyan'
            });
            
            console.clear();
            chart.render();
            
            console.log(`Duration: ${(currentTime - profile.startTime).toFixed(2)}ms`);
            console.log(`Current Memory: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            
        }, this.options.sampleInterval);
        
        profile.realtimeInterval = interval;
    }

    /**
     * System-wide profiling
     */
    startSystemProfiling() {
        if (this.isActive) return;
        this.isActive = true;
        
        const systemInterval = setInterval(() => {
            const systemMetrics = {
                timestamp: Date.now(),
                cpu: this.getCPUUsage(),
                memory: this.getMemoryUsage(),
                disk: this.getDiskUsage(),
                network: this.getNetworkUsage()
            };
            
            this.metrics.system.push(systemMetrics);
            
            // Keep only recent samples
            if (this.metrics.system.length > this.options.maxSamples) {
                this.metrics.system.shift();
            }
            
        }, this.options.sampleInterval);
        
        this.systemInterval = systemInterval;
    }

    /**
     * Get CPU usage statistics
     */
    getCPUUsage() {
        const cpus = os.cpus();
        const usage = cpus.map(cpu => {
            const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
            const idle = cpu.times.idle;
            return ((total - idle) / total * 100);
        });
        
        return {
            cores: usage,
            average: usage.reduce((acc, val) => acc + val, 0) / usage.length,
            loadAverage: os.loadavg()
        };
    }

    /**
     * Get memory usage statistics
     */
    getMemoryUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const processMem = process.memoryUsage();
        
        return {
            system: {
                total: totalMem,
                free: freeMem,
                used: totalMem - freeMem,
                percentage: ((totalMem - freeMem) / totalMem * 100)
            },
            process: {
                rss: processMem.rss,
                heapUsed: processMem.heapUsed,
                heapTotal: processMem.heapTotal,
                external: processMem.external
            }
        };
    }

    /**
     * Get disk usage (simplified)
     */
    getDiskUsage() {
        try {
            const stats = fs.statSync('.');
            return {
                available: true,
                lastAccess: stats.atime,
                lastModified: stats.mtime,
                size: stats.size || 0
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Get network usage (simulated)
     */
    getNetworkUsage() {
        const networkInterfaces = os.networkInterfaces();
        const interfaces = Object.keys(networkInterfaces).length;
        
        return {
            interfaces,
            // Simulated network activity
            bytesIn: Math.floor(Math.random() * 1000000),
            bytesOut: Math.floor(Math.random() * 1000000)
        };
    }

    /**
     * Analyze query performance
     */
    analyzeQuery(queryInfo) {
        const analysis = {
            executionTime: queryInfo.duration,
            complexity: this.calculateQueryComplexity(queryInfo),
            efficiency: this.calculateEfficiency(queryInfo),
            recommendations: []
        };
        
        if (analysis.executionTime > 1000) {
            analysis.recommendations.push('Consider adding indexes for better performance');
        }
        
        if (analysis.complexity > 10) {
            analysis.recommendations.push('Query complexity is high, consider simplification');
        }
        
        this.metrics.queries.push(analysis);
        return analysis;
    }

    /**
     * Calculate query complexity score
     */
    calculateQueryComplexity(queryInfo) {
        let complexity = 0;
        
        if (queryInfo.filters) complexity += Object.keys(queryInfo.filters).length;
        if (queryInfo.sort) complexity += 2;
        if (queryInfo.limit) complexity += 1;
        if (queryInfo.joins) complexity += queryInfo.joins.length * 3;
        
        return complexity;
    }

    /**
     * Calculate efficiency score
     */
    calculateEfficiency(queryInfo) {
        const timeScore = Math.max(0, 100 - (queryInfo.duration / 10));
        const complexityScore = Math.max(0, 100 - (this.calculateQueryComplexity(queryInfo) * 5));
        
        return (timeScore + complexityScore) / 2;
    }

    /**
     * Log analysis and monitoring
     */
    analyzeLogDensity(logs) {
        const analysis = {
            total: logs.length,
            byLevel: {},
            timeDistribution: {},
            patterns: []
        };
        
        logs.forEach(log => {
            // Count by level
            analysis.byLevel[log.level] = (analysis.byLevel[log.level] || 0) + 1;
            
            // Time distribution
            const hour = new Date(log.timestamp).getHours();
            analysis.timeDistribution[hour] = (analysis.timeDistribution[hour] || 0) + 1;
        });
        
        // Detect patterns
        if (analysis.byLevel.error > logs.length * 0.1) {
            analysis.patterns.push('High error rate detected');
        }
        
        return analysis;
    }

    /**
     * Data flow analysis
     */
    analyzeDataFlow(operations) {
        const flow = {
            reads: operations.filter(op => op.type === 'read').length,
            writes: operations.filter(op => op.type === 'write').length,
            deletes: operations.filter(op => op.type === 'delete').length,
            throughput: operations.length / (Date.now() - operations[0]?.timestamp || 1) * 1000
        };
        
        flow.readWriteRatio = flow.reads / (flow.writes || 1);
        flow.efficiency = flow.throughput > 100 ? 'high' : flow.throughput > 50 ? 'medium' : 'low';
        
        return flow;
    }

    /**
     * Generate performance report
     */
    generateReport(options = {}) {
        const { format = 'terminal', includeCharts = true } = options;
        
        const report = {
            timestamp: new Date().toISOString(),
            system: this.getSystemSummary(),
            queries: this.getQuerySummary(),
            performance: this.getPerformanceSummary(),
            recommendations: this.getGlobalRecommendations()
        };
        
        if (format === 'terminal') {
            this.renderTerminalReport(report, includeCharts);
        }
        
        return report;
    }

    /**
     * Get system summary
     */
    getSystemSummary() {
        const recentMetrics = this.metrics.system.slice(-10);
        
        if (recentMetrics.length === 0) return null;
        
        const avgCPU = recentMetrics.reduce((acc, m) => acc + m.cpu.average, 0) / recentMetrics.length;
        const avgMemory = recentMetrics.reduce((acc, m) => acc + m.memory.system.percentage, 0) / recentMetrics.length;
        
        return {
            averageCPU: avgCPU,
            averageMemory: avgMemory,
            uptime: process.uptime(),
            samplesCollected: this.metrics.system.length
        };
    }

    /**
     * Get query summary
     */
    getQuerySummary() {
        if (this.metrics.queries.length === 0) return null;
        
        const totalDuration = this.metrics.queries.reduce((acc, q) => acc + q.executionTime, 0);
        const avgDuration = totalDuration / this.metrics.queries.length;
        const slowQueries = this.metrics.queries.filter(q => q.executionTime > 1000).length;
        
        return {
            totalQueries: this.metrics.queries.length,
            averageDuration: avgDuration,
            slowQueries,
            efficiencyScore: this.metrics.queries.reduce((acc, q) => acc + q.efficiency, 0) / this.metrics.queries.length
        };
    }

    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        return {
            activeProfiles: this.profilers.size,
            systemProfiling: this.isActive,
            totalSamples: this.metrics.system.length + this.metrics.queries.length
        };
    }

    /**
     * Get global recommendations
     */
    getGlobalRecommendations() {
        const recommendations = [];
        
        const systemSummary = this.getSystemSummary();
        if (systemSummary) {
            if (systemSummary.averageCPU > 80) {
                recommendations.push('High CPU usage detected - consider optimizing operations');
            }
            if (systemSummary.averageMemory > 80) {
                recommendations.push('High memory usage - monitor for potential leaks');
            }
        }
        
        const querySummary = this.getQuerySummary();
        if (querySummary && querySummary.slowQueries > 0) {
            recommendations.push(`${querySummary.slowQueries} slow queries detected - consider optimization`);
        }
        
        if (recommendations.length === 0) {
            recommendations.push('System performance looks healthy!');
        }
        
        return recommendations;
    }

    /**
     * Render terminal report
     */
    renderTerminalReport(report, includeCharts) {
        console.clear();
        console.log(this.ui.createComponent({
            type: 'chart',
            data: {
                type: 'bar',
                values: [
                    { label: 'CPU Usage', value: report.system?.averageCPU || 0 },
                    { label: 'Memory Usage', value: report.system?.averageMemory || 0 },
                    { label: 'Query Efficiency', value: report.queries?.efficiencyScore || 0 }
                ]
            },
            options: { title: 'Performance Overview', color: 'green' }
        }).data);
        
        if (report.queries) {
            const queryTable = this.ui.createTable([
                { Metric: 'Total Queries', Value: report.queries.totalQueries },
                { Metric: 'Average Duration', Value: `${report.queries.averageDuration.toFixed(2)}ms` },
                { Metric: 'Slow Queries', Value: report.queries.slowQueries },
                { Metric: 'Efficiency Score', Value: `${report.queries.efficiencyScore.toFixed(1)}%` }
            ], { title: 'Query Performance' });
            
            queryTable.render();
        }
        
        console.log('\n' + '🔍 Recommendations:'.green);
        report.recommendations.forEach(rec => {
            console.log(`  • ${rec}`);
        });
    }

    /**
     * Stop all profiling
     */
    stop() {
        this.isActive = false;
        
        if (this.systemInterval) {
            clearInterval(this.systemInterval);
        }
        
        this.profilers.forEach(profile => {
            if (profile.realtimeInterval) {
                clearInterval(profile.realtimeInterval);
            }
        });
        
        this.profilers.clear();
    }

    /**
     * Export metrics data
     */
    exportMetrics(format = 'json') {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            activeProfiles: Array.from(this.profilers.keys())
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }
}

export default PerformanceAnalytics;
