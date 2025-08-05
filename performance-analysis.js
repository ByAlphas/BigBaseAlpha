/*
 * BigBaseAlpha v1.4.0 - Comprehensive Performance Analysis
 * Database optimization analysis for potential v1.4.5 release
 */

import BigBaseAlpha from './src/alpha.js';
import { performance } from 'perf_hooks';

class PerformanceAnalyzer {
    constructor() {
        this.results = {
            lazy_write: {},
            immediate_write: {},
            query_performance: {},
            indexing_impact: {},
            compression_analysis: {},
            memory_usage: {}
        };
    }

    async runCompleteAnalysis() {
        console.log('🔍 BigBaseAlpha v1.4.0 - Comprehensive Performance Analysis');
        console.log('═'.repeat(70));
        
        // Test 1: Write Performance Analysis
        await this.analyzeWritePerformance();
        
        // Test 2: Query Performance Analysis  
        await this.analyzeQueryPerformance();
        
        // Test 3: Indexing Impact Analysis
        await this.analyzeIndexingImpact();
        
        // Test 4: Memory Usage Analysis
        await this.analyzeMemoryUsage();
        
        // Test 5: Compression Analysis
        await this.analyzeCompression();
        
        // Final optimization recommendations
        this.generateOptimizationReport();
    }

    async analyzeWritePerformance() {
        console.log('\n📝 WRITE PERFORMANCE ANALYSIS');
        console.log('─'.repeat(50));
        
        // Test with different document sizes
        const testSizes = [100, 500, 1000, 2000, 5000];
        
        for (const size of testSizes) {
            await this.testWritePerformance(size);
        }
    }

    async testWritePerformance(docCount) {
        // Lazy write test
        const dbLazy = new BigBaseAlpha({
            path: `./PERF_TEST_LAZY_${docCount}`,
            performance: {
                lazyWrite: true,
                batchSize: 100,
                flushDelay: 2000
            }
        });
        
        await dbLazy.init();
        const collection = dbLazy.collection('perf_test');
        
        const startLazy = performance.now();
        
        // Generate test documents
        const docs = Array.from({ length: docCount }, (_, i) => ({
            _id: `doc_${i}`,
            index: i,
            data: `test_data_${i}`.repeat(10),
            timestamp: new Date(),
            metadata: { type: 'test', batch: Math.floor(i / 100) }
        }));
        
        // Insert with lazy write
        for (const doc of docs) {
            await collection.insert(doc);
        }
        
        const lazyInsertTime = performance.now() - startLazy;
        
        // Force flush
        const flushStart = performance.now();
        if (dbLazy.flushOperations) {
            await dbLazy.flushOperations();
        }
        const flushTime = performance.now() - flushStart;
        
        await dbLazy.close();
        
        // Immediate write test
        const dbImmediate = new BigBaseAlpha({
            path: `./PERF_TEST_IMMEDIATE_${docCount}`,
            performance: {
                lazyWrite: false
            }
        });
        
        await dbImmediate.init();
        const collectionImm = dbImmediate.collection('perf_test');
        
        const startImmediate = performance.now();
        
        for (const doc of docs) {
            await collectionImm.insert(doc);
        }
        
        const immediateTime = performance.now() - startImmediate;
        await dbImmediate.close();
        
        // Store results
        this.results.lazy_write[docCount] = {
            insertTime: lazyInsertTime,
            flushTime: flushTime,
            totalTime: lazyInsertTime + flushTime
        };
        
        this.results.immediate_write[docCount] = {
            totalTime: immediateTime
        };
        
        const speedup = (immediateTime / (lazyInsertTime + flushTime)).toFixed(2);
        
        console.log(`📊 ${docCount} docs: Lazy=${Math.round(lazyInsertTime + flushTime)}ms, Immediate=${Math.round(immediateTime)}ms, Speedup=${speedup}x`);
    }

    async analyzeQueryPerformance() {
        console.log('\n🔍 QUERY PERFORMANCE ANALYSIS');
        console.log('─'.repeat(50));
        
        const db = new BigBaseAlpha({
            path: './PERF_TEST_QUERY',
            performance: { lazyWrite: false }
        });
        
        await db.init();
        const collection = db.collection('query_test');
        
        // Insert test data
        const testData = Array.from({ length: 10000 }, (_, i) => ({
            _id: `item_${i}`,
            category: ['electronics', 'books', 'clothing'][i % 3],
            price: Math.floor(Math.random() * 1000) + 10,
            rating: Math.floor(Math.random() * 5) + 1,
            inStock: Math.random() > 0.3,
            tags: [`tag_${i % 100}`, `category_${i % 10}`]
        }));
        
        console.log('📝 Inserting 10,000 test documents...');
        for (const doc of testData) {
            await collection.insert(doc);
        }
        
        // Test different query types
        const queryTests = [
            { name: 'Simple equality', query: { category: 'electronics' } },
            { name: 'Range query', query: { price: { $gte: 100, $lte: 500 } } },
            { name: 'Complex AND', query: { $and: [{ category: 'books' }, { rating: { $gte: 4 } }] } },
            { name: 'Regex search', query: { tags: { $regex: /tag_1\d/ } } },
            { name: 'Multi-condition', query: { price: { $lt: 100 }, inStock: true, rating: { $gte: 3 } } }
        ];
        
        for (const test of queryTests) {
            const start = performance.now();
            const results = await collection.find(test.query);
            const queryTime = performance.now() - start;
            
            console.log(`🎯 ${test.name}: ${results.length} results in ${Math.round(queryTime)}ms`);
            
            this.results.query_performance[test.name] = {
                time: queryTime,
                resultCount: results.length
            };
        }
        
        await db.close();
    }

    async analyzeIndexingImpact() {
        console.log('\n📇 INDEXING IMPACT ANALYSIS');  
        console.log('─'.repeat(50));
        
        // Test without indexes
        await this.testIndexPerformance(false);
        
        // Test with indexes
        await this.testIndexPerformance(true);
    }

    async testIndexPerformance(useIndexes) {
        const dbPath = useIndexes ? './PERF_TEST_INDEXED' : './PERF_TEST_NO_INDEX';
        const db = new BigBaseAlpha({ path: dbPath });
        
        await db.init();
        const collection = db.collection('index_test');
        
        // Insert test data
        const docs = Array.from({ length: 5000 }, (_, i) => ({
            _id: `doc_${i}`,
            userId: Math.floor(Math.random() * 1000),
            status: ['active', 'inactive', 'pending'][i % 3],
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 30)
        }));
        
        for (const doc of docs) {
            await collection.insert(doc);
        }
        
        if (useIndexes) {
            await collection.createIndex({ userId: 1 });
            await collection.createIndex({ status: 1 });
            await collection.createIndex({ createdAt: -1 });
        }
        
        // Test queries
        const testQueries = [
            { userId: 500 },
            { status: 'active' },
            { createdAt: { $gte: new Date(Date.now() - 86400000 * 7) } }
        ];
        
        const indexType = useIndexes ? 'indexed' : 'no_index';
        this.results.indexing_impact[indexType] = {};
        
        for (const [i, query] of testQueries.entries()) {
            const start = performance.now();
            const results = await collection.find(query);
            const queryTime = performance.now() - start;
            
            this.results.indexing_impact[indexType][`query_${i}`] = {
                time: queryTime,
                results: results.length
            };
        }
        
        await db.close();
        
        const indexStatus = useIndexes ? 'WITH indexes' : 'WITHOUT indexes';
        console.log(`📊 Query performance ${indexStatus}: Average ${this.getAverageQueryTime(indexType)}ms`);
    }

    getAverageQueryTime(indexType) {
        const times = Object.values(this.results.indexing_impact[indexType]).map(r => r.time);
        return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }

    async analyzeMemoryUsage() {
        console.log('\n🧠 MEMORY USAGE ANALYSIS');
        console.log('─'.repeat(50));
        
        const beforeMemory = process.memoryUsage();
        
        const db = new BigBaseAlpha({
            path: './PERF_TEST_MEMORY',
            performance: { lazyWrite: true }
        });
        
        await db.init();
        const collection = db.collection('memory_test');
        
        // Insert varying document sizes
        for (let i = 0; i < 1000; i++) {
            await collection.insert({
                _id: `mem_${i}`,
                smallData: `data_${i}`,
                mediumData: 'x'.repeat(100),
                largeData: 'y'.repeat(1000),
                arrayData: Array.from({ length: 50 }, (_, idx) => `item_${idx}`)
            });
        }
        
        const afterMemory = process.memoryUsage();
        
        this.results.memory_usage = {
            heapUsed: (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024,
            heapTotal: (afterMemory.heapTotal - beforeMemory.heapTotal) / 1024 / 1024,
            external: (afterMemory.external - beforeMemory.external) / 1024 / 1024
        };
        
        console.log(`📊 Memory increase: ${this.results.memory_usage.heapUsed.toFixed(2)}MB heap`);
        
        await db.close();
    }

    async analyzeCompression() {
        console.log('\n🗜️ COMPRESSION ANALYSIS');
        console.log('─'.repeat(50));
        
        // Test with compression
        const dbCompressed = new BigBaseAlpha({
            path: './PERF_TEST_COMPRESSED',
            compression: true
        });
        
        await dbCompressed.init();
        const collectionComp = dbCompressed.collection('compression_test');
        
        const testDoc = {
            _id: 'compression_test',
            repeatableData: 'This is highly compressible data! '.repeat(100),
            randomData: Math.random().toString(36).repeat(50),
            structuredData: Array.from({ length: 100 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                description: `Description for item ${i}`.repeat(5)
            }))
        };
        
        const startComp = performance.now();
        await collectionComp.insert(testDoc);
        const compTime = performance.now() - startComp;
        
        await dbCompressed.close();
        
        // Test without compression
        const dbUncompressed = new BigBaseAlpha({
            path: './PERF_TEST_UNCOMPRESSED',
            compression: false
        });
        
        await dbUncompressed.init();
        const collectionUncomp = dbUncompressed.collection('compression_test');
        
        const startUncomp = performance.now();
        await collectionUncomp.insert(testDoc);
        const uncompTime = performance.now() - startUncomp;
        
        await dbUncompressed.close();
        
        this.results.compression_analysis = {
            compressed_time: compTime,
            uncompressed_time: uncompTime,
            time_overhead: ((compTime - uncompTime) / uncompTime * 100).toFixed(2)
        };
        
        console.log(`📊 Compression overhead: ${this.results.compression_analysis.time_overhead}%`);
    }

    generateOptimizationReport() {
        console.log('\n📋 OPTIMIZATION ANALYSIS REPORT');
        console.log('═'.repeat(70));
        
        // Analyze lazy write performance
        let lazyWriteImprovement = 0;
        let testedSizes = 0;
        
        Object.keys(this.results.lazy_write).forEach(size => {
            const lazy = this.results.lazy_write[size].totalTime;
            const immediate = this.results.immediate_write[size].totalTime;
            const improvement = ((immediate - lazy) / immediate * 100);
            lazyWriteImprovement += improvement;
            testedSizes++;
        });
        
        const avgLazyImprovement = lazyWriteImprovement / testedSizes;
        
        // Analyze indexing improvement
        const noIndexAvg = this.getAverageQueryTime('no_index');
        const indexedAvg = this.getAverageQueryTime('indexed');
        const indexImprovement = ((noIndexAvg - indexedAvg) / noIndexAvg * 100);
        
        console.log('🎯 PERFORMANCE OPTIMIZATIONS FOUND:');
        console.log(`   ✅ Lazy Write: ${avgLazyImprovement.toFixed(1)}% faster on average`);
        console.log(`   ✅ Indexing: ${indexImprovement.toFixed(1)}% query performance improvement`);
        console.log(`   ✅ Memory Usage: ${this.results.memory_usage.heapUsed.toFixed(2)}MB for 1000 docs`);
        console.log(`   ✅ Compression: ${this.results.compression_analysis.time_overhead}% overhead`);
        
        console.log('\n📊 OPTIMIZATION RECOMMENDATIONS:');
        
        if (avgLazyImprovement > 15) {
            console.log('   🚀 SIGNIFICANT: Lazy write provides major performance boost');
        }
        
        if (indexImprovement > 30) {
            console.log('   🚀 SIGNIFICANT: Indexing dramatically improves query performance');
        }
        
        if (this.results.memory_usage.heapUsed < 50) {
            console.log('   ✅ GOOD: Memory usage is reasonable');
        }
        
        if (parseFloat(this.results.compression_analysis.time_overhead) < 20) {
            console.log('   ✅ GOOD: Compression overhead is acceptable');
        }
        
        console.log('\n🎯 VERSION RECOMMENDATION:');
        
        const hasSignificantOptimizations = avgLazyImprovement > 15 || indexImprovement > 30;
        
        if (hasSignificantOptimizations) {
            console.log('   🚀 RECOMMENDATION: Release as v1.4.5');
            console.log('   📝 REASON: Significant performance optimizations justify minor version bump');
            console.log('   🎁 NEW FEATURES: Performance engine, lazy write, advanced indexing');
        } else {
            console.log('   📦 RECOMMENDATION: Release as v1.4.1');
            console.log('   📝 REASON: Minor optimizations, focus on cleanup');
            console.log('   🧹 FOCUS: Hide demo files from npm package');
        }
        
        console.log('\n🔧 TECHNICAL DETAILS:');
        console.log('   📊 Test Results:', JSON.stringify(this.results, null, 2));
    }
}

// Run analysis
const analyzer = new PerformanceAnalyzer();
analyzer.runCompleteAnalysis().catch(console.error);
