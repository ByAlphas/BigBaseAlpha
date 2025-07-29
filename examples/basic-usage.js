import BigBaseAlpha from '../src/alpha.js';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

/**
 * Basic usage example of BigBaseAlpha
 */
async function basicExample() {
      console.log('� BigBaseAlpha basic usage example');

  // Clean up previous test data
  const testPath = './example_data';
  if (existsSync(testPath)) {
    await rm(testPath, { recursive: true });
  }

  // Initialize database
  console.log('1. Initializing database...');
  const db = new BigBaseAlpha({
    path: testPath,
    format: 'json',
    encryption: false,
    compression: false,
    indexing: true,
    caching: true
  });

  await db.init();
  console.log('✅ BigBaseAlpha basic example completed successfully!');

  // Create collections
  console.log('2. Creating collections...');
  
  // Users collection with schema
  await db.createCollection('users', {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, unique: true, index: true },
    age: { type: 'number', index: true },
    active: { type: 'boolean', default: true }
  });

  // Posts collection
  await db.createCollection('posts', {
    title: { type: 'string', required: true, index: true },
    content: { type: 'string', required: true },
    authorId: { type: 'string', required: true, index: true },
    tags: { type: 'object' },
    publishedAt: { type: 'object', index: true }
  });

  console.log('✅ Collections created\n');

  // Insert data
  console.log('3. Inserting sample data...');

  // Insert users
  const users = [
    { name: 'John Doe', email: 'john@example.com', age: 30, active: true },
    { name: 'Jane Smith', email: 'jane@example.com', age: 25, active: true },
    { name: 'Bob Johnson', email: 'bob@example.com', age: 35, active: false },
    { name: 'Alice Brown', email: 'alice@example.com', age: 28, active: true }
  ];

  const insertedUsers = [];
  for (const user of users) {
    const inserted = await db.insert('users', user);
    insertedUsers.push(inserted);
    console.log(`  Added user: ${inserted.name} (ID: ${inserted._id})`);
  }

  // Insert posts
  const posts = [
    {
      title: 'Getting Started with BigBaseAlpha',
      content: 'This is a comprehensive guide to using BigBaseAlpha...',
      authorId: insertedUsers[0]._id,
      tags: ['database', 'nodejs', 'tutorial'],
      publishedAt: new Date('2024-01-15')
    },
    {
      title: 'Advanced Query Techniques',
      content: 'Learn how to perform complex queries...',
      authorId: insertedUsers[1]._id,
      tags: ['database', 'advanced', 'queries'],
      publishedAt: new Date('2024-01-20')
    },
    {
      title: 'Security Best Practices',
      content: 'Keep your data safe with these security tips...',
      authorId: insertedUsers[0]._id,
      tags: ['security', 'best-practices'],
      publishedAt: new Date('2024-01-25')
    }
  ];

  for (const post of posts) {
    const inserted = await db.insert('posts', post);
    console.log(`  Added post: ${inserted.title} (ID: ${inserted._id})`);
  }

  console.log('✅ Sample data inserted\n');

  // Query examples
  console.log('4. Performing queries...');

  // Find all active users
  const activeUsers = await db.query('users', {
    where: { active: true },
    sort: { age: 1 }
  });
  console.log(`  Active users (${activeUsers.length}):`);
  activeUsers.forEach(user => console.log(`    - ${user.name} (age: ${user.age})`));

  // Find users by age range
  const youngUsers = await db.query('users', {
    where: { age: { $lt: 30 } },
    select: ['name', 'age', 'email']
  });
  console.log(`\\n  Users under 30 (${youngUsers.length}):`);
  youngUsers.forEach(user => console.log(`    - ${user.name} (${user.age})`));

  // Find posts by author
  const johnsPosts = await db.query('posts', {
    where: { authorId: insertedUsers[0]._id },
    sort: { publishedAt: -1 }
  });
  console.log(`\\n  John's posts (${johnsPosts.length}):`);
  johnsPosts.forEach(post => console.log(`    - ${post.title}`));

  // Find posts with specific tags
  const tutorialPosts = await db.query('posts', {
    where: { tags: { $in: ['tutorial', 'advanced'] } }
  });
  console.log(`\\n  Tutorial/Advanced posts (${tutorialPosts.length}):`);
  tutorialPosts.forEach(post => console.log(`    - ${post.title}`));

  console.log('\\n✅ Queries completed\\n');

  // Update examples
  console.log('5. Updating data...');

  // Update user age
  const updatedUser = await db.update('users', insertedUsers[0]._id, {
    age: 31,
    lastLogin: new Date()
  });
  console.log(`  Updated ${updatedUser.name}'s age to ${updatedUser.age}`);

  // Update post tags
  const firstPost = await db.findById('posts', johnsPosts[0]._id);
  await db.update('posts', firstPost._id, {
    tags: [...firstPost.tags, 'updated'],
    editedAt: new Date()
  });
  console.log(`  Added 'updated' tag to post: ${firstPost.title}`);

  console.log('✅ Updates completed\\n');

  // Statistics
  console.log('6. Database statistics...');
  const stats = db.getStats();
  console.log(`  Total operations: ${stats.totalOperations}`);
  console.log(`  Inserts: ${stats.totalInserts}`);
  console.log(`  Reads: ${stats.totalReads}`);
  console.log(`  Updates: ${stats.totalUpdates}`);
  console.log(`  Collections: ${stats.collections}`);
  console.log(`  Uptime: ${Math.round(stats.uptime / 1000)}s`);
  
  if (stats.cacheStats) {
    console.log(`  Cache hit rate: ${stats.cacheStats.hitRate}%`);
    console.log(`  Cache items: ${stats.cacheStats.currentItems}`);
  }

  console.log('\\n✅ Statistics displayed\\n');

  // Backup
  console.log('7. Creating backup...');
  const backupPath = await db.backup('./example_backup.bba');
  console.log(`✅ Backup created: ${backupPath}\\n`);

  // Cleanup
  console.log('8. Closing database...');
  await db.close();
  console.log('✅ Database closed\\n');

  console.log('🎉 Example completed successfully!');
  console.log('\\nTo explore more features:');
  console.log('- Check the generated files in ./example_data/');
  console.log('- Run the CLI: node src/cli/index.js --help');
  console.log('- Start the dashboard: node src/dashboard/server.js');
}

/**
 * Advanced features example
 */
async function advancedExample() {
  console.log('\\n🔬 BigBaseAlpha Advanced Features Example\\n');

  const testPath = './advanced_example_data';
  if (existsSync(testPath)) {
    await rm(testPath, { recursive: true });
  }

  // Initialize with advanced features
  const db = new BigBaseAlpha({
    path: testPath,
    format: 'hybrid',
    encryption: true,
    compression: true,
    indexing: true,
    caching: true,
    auditLog: true,
    backupInterval: 0, // Disable auto backup for demo
    plugins: []
  });

  await db.init();
  console.log('✅ Database with advanced features initialized\\n');

  // Create collection with complex schema
  await db.createCollection('products', {
    name: { type: 'string', required: true, index: true },
    category: { type: 'string', required: true, index: true },
    price: { type: 'number', required: true, index: true },
    description: { type: 'string' },
    metadata: { type: 'object' },
    tags: { type: 'object' },
    inStock: { type: 'boolean', default: true, index: true },
    secretNotes: { type: 'string' } // Will be encrypted automatically
  });

  console.log('1. Inserting products with encryption...');

  const products = [
    {
      name: 'Professional Laptop',
      category: 'Electronics',
      price: 1299.99,
      description: 'High-performance laptop for professionals',
      metadata: {
        brand: 'TechCorp',
        model: 'Pro-X1',
        specs: {
          cpu: 'Intel i7',
          ram: '16GB',
          storage: '512GB SSD'
        }
      },
      tags: ['laptop', 'professional', 'high-performance'],
      inStock: true,
      secretNotes: 'This contains sensitive supplier information'
    },
    {
      name: 'Gaming Mouse',
      category: 'Electronics',
      price: 79.99,
      description: 'RGB gaming mouse with high DPI',
      metadata: {
        brand: 'GameGear',
        model: 'RGB-Pro',
        specs: {
          dpi: 16000,
          buttons: 8,
          wireless: true
        }
      },
      tags: ['mouse', 'gaming', 'rgb'],
      inStock: true,
      secretNotes: 'Confidential: Cost is only $15'
    },
    {
      name: 'Office Chair',
      category: 'Furniture',
      price: 299.99,
      description: 'Ergonomic office chair',
      metadata: {
        brand: 'ComfortSeat',
        model: 'Ergo-Pro',
        specs: {
          material: 'Mesh',
          adjustable: true,
          warranty: '5 years'
        }
      },
      tags: ['chair', 'office', 'ergonomic'],
      inStock: false,
      secretNotes: 'Special discount available for bulk orders'
    }
  ];

  for (const product of products) {
    const inserted = await db.insert('products', product);
    console.log(`  Added: ${inserted.name} - $${inserted.price}`);
  }

  console.log('\\n2. Complex queries with indexing...');

  // Range query on price
  const affordableProducts = await db.query('products', {
    where: {
      price: { $lt: 500 },
      inStock: true
    },
    sort: { price: 1 }
  });
  console.log(`  Affordable products in stock (${affordableProducts.length}):`);
  affordableProducts.forEach(p => console.log(`    - ${p.name}: $${p.price}`));

  // Category aggregation
  const categories = await db.query('products', {
    select: ['category', 'price']
  });
  const categoryStats = {};
  categories.forEach(p => {
    if (!categoryStats[p.category]) {
      categoryStats[p.category] = { count: 0, totalValue: 0 };
    }
    categoryStats[p.category].count++;
    categoryStats[p.category].totalValue += p.price;
  });

  console.log(`\\n  Category statistics:`);
  for (const [category, stats] of Object.entries(categoryStats)) {
    const avgPrice = (stats.totalValue / stats.count).toFixed(2);
    console.log(`    - ${category}: ${stats.count} items, avg price: $${avgPrice}`);
  }

  console.log('\\n3. TTL and expiration...');

  // Insert temporary data with TTL
  const tempProduct = {
    name: 'Flash Sale Item',
    category: 'Special',
    price: 19.99,
    description: 'Limited time offer',
    _ttl: new Date(Date.now() + 5000) // Expires in 5 seconds
  };

  const temp = await db.insert('products', tempProduct);
  console.log(`  Added temporary item: ${temp.name} (expires in 5s)`);

  // Wait and check if it's still there
  console.log('  Waiting 6 seconds...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  const expiredItem = await db.findById('products', temp._id);
  console.log(`  Item after expiration: ${expiredItem ? 'Still exists' : 'Expired and removed'}`);

  console.log('\\n4. Security features...');

  // Hash a password
  const hashedPassword = await db.security.hash('mySecretPassword');
  console.log(`  Hashed password: ${hashedPassword.substring(0, 20)}...`);

  // Verify password
  const isValid = await db.security.verifyHash('mySecretPassword', hashedPassword);
  console.log(`  Password verification: ${isValid ? 'Valid' : 'Invalid'}`);

  // Generate API key
  const apiKey = db.security.generateApiKey();
  console.log(`  Generated API key: ${apiKey.substring(0, 20)}...`);

  // Validate API key
  const isValidKey = db.security.validateApiKey(apiKey);
  console.log(`  API key validation: ${isValidKey ? 'Valid' : 'Invalid'}`);

  console.log('\\n5. Plugin system...');

  // Load a custom plugin
  const customPlugin = {
    name: 'price-calculator',
    version: '1.0.0',
    description: 'Calculates total inventory value',

    async onInit(database) {
      console.log('  📦 Price calculator plugin initialized');
    },

    async calculateTotalValue(collectionName) {
      const products = await db.query(collectionName);
      const total = products.reduce((sum, product) => sum + (product.price || 0), 0);
      return total;
    }
  };

  // Manually register plugin
  db.plugins.plugins.set('price-calculator', customPlugin);
  await customPlugin.onInit(db);

  const totalValue = await customPlugin.calculateTotalValue('products');
  console.log(`  Total inventory value: $${totalValue.toFixed(2)}`);

  console.log('\\n6. Backup and statistics...');

  const finalStats = db.getStats();
  console.log(`  Final statistics:`);
  console.log(`    - Total operations: ${finalStats.totalOperations}`);
  console.log(`    - Memory usage: ${Math.round(finalStats.memoryUsage.used / 1024 / 1024)}MB`);
  console.log(`    - Cache hit rate: ${finalStats.cacheStats?.hitRate || 0}%`);

  // Create encrypted backup
  const backupPath = await db.backup('./advanced_backup.bba');
  console.log(`  ✅ Encrypted backup created: ${backupPath}`);

  await db.close();
  console.log('\\n✅ Advanced example completed!');
}

// Run examples
async function runExamples() {
  try {
    await basicExample();
    await advancedExample();
    
    console.log('\\n🎉 All examples completed successfully!');
    console.log('\\nNext steps:');
    console.log('1. Explore the generated data directories');
    console.log('2. Try the CLI commands: node src/cli/index.js --help');
    console.log('3. Start the web dashboard: node src/dashboard/server.js');
    console.log('4. Read the documentation in README.md');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}

export { basicExample, advancedExample };
