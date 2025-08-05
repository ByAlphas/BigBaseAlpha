/**
 * Full-Text Search and Query Profiler Test Example
 * Tests BigBaseAlpha's advanced search and profiling features
 */
import BigBaseAlpha from '../src/alpha.js';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

async function testSearchAndProfiler() {
  console.log('🔍 BigBaseAlpha Full-Text Search & Query Profiler Test\n');

  // Clean up previous test data
  const testPath = './search_test_data';
  if (existsSync(testPath)) {
    await rm(testPath, { recursive: true });
  }

  // Initialize database with new features
  console.log('1. Initializing database with search and profiler...');
  const db = new BigBaseAlpha({
    path: testPath,
    format: 'json',
    encryption: false,
    indexing: true,
    caching: true,
    auditLog: true
  });

  await db.init();
  console.log('✅ Database initialized with search and profiler\n');

  // Create collection with schema
  console.log('2. Creating collections...');
  
  await db.createCollection('articles', {
    title: { type: 'string', required: true, index: true },
    content: { type: 'string', required: true },
    author: { type: 'string', required: true, index: true },
    tags: { type: 'object' },
    category: { type: 'string', index: true },
    publishedAt: { type: 'object', index: true },
    views: { type: 'number', index: true }
  });

  await db.createCollection('users', {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true },
    bio: { type: 'string' },
    interests: { type: 'object' }
  });

  console.log('✅ Collections created\n');

  // Insert test data
  console.log('3. Inserting test articles...');

  const articles = [
    {
      title: 'Getting Started with JavaScript',
      content: 'JavaScript is a powerful programming language that runs in browsers and servers. This comprehensive guide covers all the basics you need to know to start building amazing web applications.',
      author: 'John Doe',
      category: 'Programming',
      tags: ['javascript', 'tutorial', 'beginners', 'web development'],
      publishedAt: new Date('2024-01-15'),
      views: 1250
    },
    {
      title: 'Advanced Node.js Techniques',
      content: 'Learn advanced Node.js patterns and techniques for building scalable server applications. Covers async/await, streams, clustering, and performance optimization.',
      author: 'Jane Smith',
      category: 'Backend',
      tags: ['nodejs', 'advanced', 'server', 'performance'],
      publishedAt: new Date('2024-01-20'),
      views: 890
    },
    {
      title: 'Database Design Principles',
      content: 'Understanding database design is crucial for building efficient applications. This article covers normalization, indexing, query optimization, and best practices.',
      author: 'Bob Wilson',
      category: 'Database',
      tags: ['database', 'design', 'sql', 'optimization'],
      publishedAt: new Date('2024-01-25'),
      views: 2100
    },
    {
      title: 'React Component Patterns',
      content: 'Explore modern React patterns including hooks, context, render props, and compound components. Learn how to build reusable and maintainable React applications.',
      author: 'Alice Brown',
      category: 'Frontend',
      tags: ['react', 'components', 'patterns', 'frontend'],
      publishedAt: new Date('2024-02-01'),
      views: 1680
    },
    {
      title: 'Microservices Architecture Guide',
      content: 'Microservices architecture enables building scalable and maintainable applications. Learn about service discovery, API gateways, and distributed systems patterns.',
      author: 'Charlie Davis',
      category: 'Architecture',
      tags: ['microservices', 'architecture', 'scalability', 'distributed'],
      publishedAt: new Date('2024-02-05'),
      views: 945
    },
    {
      title: 'Machine Learning with Python',
      content: 'Python is the go-to language for machine learning. This tutorial covers scikit-learn, pandas, numpy, and building your first ML models.',
      author: 'Diana Lee',
      category: 'Data Science',
      tags: ['python', 'machine learning', 'data science', 'ai'],
      publishedAt: new Date('2024-02-10'),
      views: 3200
    }
  ];

  const insertedArticles = [];
  for (const article of articles) {
    const inserted = await db.insert('articles', article);
    insertedArticles.push(inserted);
    console.log(`  📝 Added article: "${inserted.title}" by ${inserted.author}`);
  }

  console.log('✅ Test articles inserted\n');

  // Test Full-Text Search
  console.log('4. Testing Full-Text Search...\n');

  // Basic text search
  console.log('🔍 Search: "javascript programming"');
  const jsResults = await db.search('articles', 'javascript programming', {
    fields: ['title', 'content'],
    limit: 3,
    highlight: true
  });
  
  console.log(`Found ${jsResults.length} results:`);
  for (const result of jsResults) {
    console.log(`  📄 ${result.docId} - Score: ${result.score.toFixed(2)}`);
    console.log(`     Matches: ${result.matches.join(', ')}`);
  }
  console.log('');

  // Search with fuzzy matching
  console.log('🔍 Fuzzy search: "machien lerning" (with typos)');
  const fuzzyResults = await db.search('articles', 'machien lerning', {
    fields: ['title', 'content'],
    fuzzy: true,
    limit: 3
  });
  
  console.log(`Found ${fuzzyResults.length} results with fuzzy matching:`);
  for (const result of fuzzyResults) {
    console.log(`  📄 ${result.docId} - Score: ${result.score.toFixed(2)}`);
  }
  console.log('');

  // Category-specific search
  console.log('🔍 Search in specific field: "database" in titles');
  const dbResults = await db.search('articles', 'database', {
    fields: ['title'],
    limit: 5
  });
  
  console.log(`Found ${dbResults.length} results in titles:`);
  for (const result of dbResults) {
    console.log(`  📄 ${result.docId} - Score: ${result.score.toFixed(2)}`);
  }
  console.log('');

  // Test search suggestions
  console.log('🔍 Testing search suggestions...');
  const suggestions = await db.suggest('articles', 'prog', { limit: 5 });
  console.log(`Suggestions for "prog": ${suggestions.join(', ')}\n`);

  // Test Query Profiler
  console.log('5. Testing Query Profiler...\n');

  // Run some queries to generate profiling data
  console.log('Running queries to generate profiling data...');
  
  // Fast query
  await db.query('articles', {
    where: { category: 'Programming' },
    limit: 10
  });

  // Slow query (no limit, complex conditions)
  await db.query('articles', {
    where: { 
      views: { $gt: 1000 },
      category: { $in: ['Programming', 'Backend', 'Frontend'] }
    },
    sort: { views: -1, publishedAt: -1 }
  });

  // Query with errors (intentional)
  try {
    await db.query('nonexistent_collection', { where: { test: 'value' } });
  } catch (error) {
    // Expected error for profiling
  }

  // Search query for profiling
  await db.search('articles', 'optimization performance', {
    fields: ['title', 'content'],
    fuzzy: true
  });

  console.log('✅ Queries executed for profiling\n');

  // Get profiler statistics
  console.log('📊 Query Profiler Statistics:\n');
  
  const profilerStats = db.getProfilerStats();
  console.log(`Total Queries: ${profilerStats.totalQueries}`);
  console.log(`Average Time: ${profilerStats.averageTime.toFixed(2)}ms`);
  console.log(`Slow Queries: ${profilerStats.slowQueries}`);
  console.log(`Error Queries: ${profilerStats.errorQueries}`);
  console.log(`Fastest Query: ${profilerStats.fastestQuery}ms`);
  console.log(`Slowest Query: ${profilerStats.slowestQuery}ms\n`);

  // Get slow queries
  const slowQueries = db.getSlowQueries({ limit: 3, threshold: 10 });
  console.log(`Slow Queries (threshold: 10ms):`);
  for (const query of slowQueries) {
    console.log(`  🐌 ${query.operation} on ${query.collection} - ${query.duration}ms`);
    if (query.suggestions.length > 0) {
      console.log(`     💡 Suggestions: ${query.suggestions.join(', ')}`);
    }
  }
  console.log('');

  // Get real-time metrics
  const realTimeMetrics = db.getRealTimeQueryMetrics();
  console.log('📈 Real-time Query Metrics:');
  console.log(`  Active Queries: ${realTimeMetrics.currentActiveQueries}`);
  console.log(`  Queries (last 5min): ${realTimeMetrics.queriesLast5Min}`);
  console.log(`  Avg Response Time: ${realTimeMetrics.avgResponseTime.toFixed(2)}ms`);
  console.log(`  Errors (last 5min): ${realTimeMetrics.errorsLast5Min}`);
  console.log(`  Top Collections: ${realTimeMetrics.topCollections.map(c => c.name).join(', ')}`);
  console.log(`  Top Operations: ${realTimeMetrics.topOperations.map(o => o.name).join(', ')}\n`);

  // Analyze query patterns
  const patterns = db.analyzeQueryPatterns();
  console.log('🔍 Query Pattern Analysis:');
  console.log(`  Query Patterns: ${patterns.queryPatterns.length} unique patterns found`);
  console.log(`  Recommendations: ${patterns.recommendations.length} suggestions`);
  
  for (const rec of patterns.recommendations) {
    console.log(`    ${rec.type}: ${rec.message} (${rec.metric})`);
  }
  console.log('');

  // Test Search Engine Stats
  console.log('6. Search Engine Statistics:\n');
  
  const searchStats = db.getSearchStats();
  console.log(`Collections Indexed: ${searchStats.collectionsIndexed}`);
  console.log(`Total Documents: ${searchStats.totalDocuments}`);
  console.log(`Total Words: ${searchStats.totalWords}`);
  
  for (const collection of searchStats.collections) {
    console.log(`  📚 ${collection.collection}: ${collection.documentsIndexed} docs, ${collection.uniqueWords} words`);
    console.log(`     Fields: ${collection.fieldsIndexed.join(', ')}`);
  }
  console.log('');

  // Export profiler data
  console.log('7. Exporting profiler data...');
  
  const exportData = await db.exportQueryProfiles('json', { timeRange: '1h' });
  console.log(`Exported ${JSON.parse(exportData).totalProfiles} query profiles\n`);

  // Performance comparison
  console.log('8. Performance Comparison...\n');
  
  console.log('🏃 Running performance tests...');
  const start = Date.now();
  
  // Traditional query
  const traditionalStart = Date.now();
  const traditionalResults = await db.query('articles', {
    where: { 
      $or: [
        { title: { $regex: 'javascript' } },
        { content: { $regex: 'javascript' } }
      ]
    }
  });
  const traditionalTime = Date.now() - traditionalStart;
  
  // Full-text search
  const searchStart = Date.now();
  const searchResults = await db.search('articles', 'javascript', {
    fields: ['title', 'content']
  });
  const searchTime = Date.now() - searchStart;
  
  console.log('Performance Results:');
  console.log(`  Traditional regex query: ${traditionalTime}ms (${traditionalResults.length} results)`);
  console.log(`  Full-text search: ${searchTime}ms (${searchResults.length} results)`);
  console.log(`  Performance improvement: ${((traditionalTime - searchTime) / traditionalTime * 100).toFixed(1)}%\n`);

  // Database statistics
  console.log('9. Final Database Statistics...');
  const stats = db.getStats();
  console.log(`  Total Operations: ${stats.totalOperations}`);
  console.log(`  Collections: ${stats.collections}`);
  console.log(`  Cache Hit Rate: ${stats.cacheStats.hitRate || 0}%`);
  console.log(`  Uptime: ${Math.round(stats.uptime / 1000)}s\n`);

  // Cleanup
  console.log('10. Closing database...');
  await db.close();
  console.log('✅ Database closed\n');

  console.log('🎉 Full-Text Search & Query Profiler test completed successfully!');
  console.log('\n🚀 New Features Available:');
  console.log('  ✅ Full-text search with relevance scoring');
  console.log('  ✅ Fuzzy search for typo tolerance');
  console.log('  ✅ Search suggestions/autocomplete');
  console.log('  ✅ Query profiling and performance monitoring');
  console.log('  ✅ Slow query detection and optimization suggestions');
  console.log('  ✅ Real-time query metrics');
  console.log('  ✅ Query pattern analysis');
  console.log('  ✅ Performance comparison tools');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSearchAndProfiler().catch(console.error);
}

export { testSearchAndProfiler };
