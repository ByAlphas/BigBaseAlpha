#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';

import BigBaseAlpha from '../alpha.js';

const program = new Command();

// Global configuration
let globalConfig = {
  path: process.cwd(),
  verbose: false
};

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = chalk.gray(`[${timestamp}]`);
  
  switch (type) {
    case 'success':
      console.log(`${prefix} ${chalk.green('✓')} ${message}`);
      break;
    case 'error':
      console.log(`${prefix} ${chalk.red('✗')} ${message}`);
      break;
    case 'warning':
      console.log(`${prefix} ${chalk.yellow('⚠')} ${message}`);
      break;
    case 'info':
    default:
      console.log(`${prefix} ${chalk.blue('ℹ')} ${message}`);
      break;
  }
}

function createSpinner(text) {
  return ora({
    text,
    spinner: 'dots',
    color: 'blue'
  });
}

async function connectToDatabase(path = null) {
  const dbPath = path || globalConfig.path;
  
  if (!existsSync(join(dbPath, 'bigbase.config.json'))) {
    throw new Error(`No BigBaseAlpha database found at ${dbPath}. Run 'bigbase init' first.`);
  }

  const db = new BigBaseAlpha({
    path: dbPath,
    auditLog: false, // Disable audit for CLI operations
    caching: false   // Disable caching for CLI operations
  });

  await db.init();
  return db;
}

// CLI Commands

program
  .name('bigbase')
  .description('BigBaseAlpha - Professional Grade Custom Database System')
  .version('1.0.0')
  .option('-v, --verbose', 'verbose output')
  .option('-p, --path <path>', 'database path', process.cwd())
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.opts();
    globalConfig.verbose = opts.verbose;
    globalConfig.path = opts.path;
  });

// Initialize command
program
  .command('init')
  .description('Initialize a new BigBaseAlpha database')
  .option('-f, --format <format>', 'storage format (json|binary|hybrid)', 'json')
  .option('-e, --encryption', 'enable encryption')
  .option('-c, --compression', 'enable compression')
  .option('--force', 'overwrite existing database')
  .action(async (options) => {
    const spinner = createSpinner('Initializing BigBaseAlpha database...');
    
    try {
      spinner.start();
      
      const dbPath = globalConfig.path;
      const configPath = join(dbPath, 'bigbase.config.json');
      
      if (existsSync(configPath) && !options.force) {
        spinner.fail();
        log('Database already exists. Use --force to overwrite.', 'error');
        process.exit(1);
      }

      const config = {
        path: dbPath,
        format: options.format,
        encryption: options.encryption || false,
        compression: options.compression || false,
        indexing: true,
        caching: true,
        auditLog: true
      };

      const db = new BigBaseAlpha(config);
      await db.init();
      await db.close();
      
      spinner.succeed();
      log(`Database initialized at ${dbPath}`, 'success');
      log(`Format: ${options.format}`, 'info');
      log(`Encryption: ${options.encryption ? 'enabled' : 'disabled'}`, 'info');
      log(`Compression: ${options.compression ? 'enabled' : 'disabled'}`, 'info');
      
    } catch (error) {
      spinner.fail();
      log(`Failed to initialize database: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show database status and information')
  .action(async () => {
    const spinner = createSpinner('Checking database status...');
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      const stats = db.getStats();
      const config = db.configManager.getAll();
      
      await db.close();
      spinner.succeed();
      
      console.log(chalk.bold('\n📊 BigBaseAlpha Database Status\n'));
      
      // Database info table
      const infoTable = new Table({
        head: [chalk.cyan('Property'), chalk.cyan('Value')],
        colWidths: [20, 40]
      });
      
      infoTable.push(
        ['Path', config.path],
        ['Format', config.format],
        ['Encryption', config.encryption ? chalk.green('Enabled') : chalk.red('Disabled')],
        ['Compression', config.compression ? chalk.green('Enabled') : chalk.red('Disabled')],
        ['Indexing', config.indexing ? chalk.green('Enabled') : chalk.red('Disabled')],
        ['Caching', config.caching ? chalk.green('Enabled') : chalk.red('Disabled')],
        ['Collections', stats.collections.toString()],
        ['Uptime', `${Math.round(stats.uptime / 1000)}s`]
      );
      
      console.log(infoTable.toString());
      
      // Statistics table
      if (stats.totalOperations > 0) {
        console.log(chalk.bold('\n📈 Operations Statistics\n'));
        
        const statsTable = new Table({
          head: [chalk.cyan('Operation'), chalk.cyan('Count')],
          colWidths: [20, 15]
        });
        
        statsTable.push(
          ['Total Operations', stats.totalOperations.toLocaleString()],
          ['Inserts', stats.totalInserts.toLocaleString()],
          ['Reads', stats.totalReads.toLocaleString()],
          ['Updates', stats.totalUpdates.toLocaleString()],
          ['Deletes', stats.totalDeletes.toLocaleString()]
        );
        
        console.log(statsTable.toString());
      }
      
    } catch (error) {
      spinner.fail();
      log(`Failed to get database status: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Display detailed database statistics')
  .option('-c, --collection <name>', 'show stats for specific collection')
  .action(async (options) => {
    const spinner = createSpinner('Gathering statistics...');
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      const stats = db.getStats();
      
      await db.close();
      spinner.succeed();
      
      console.log(chalk.bold('\n📊 BigBaseAlpha Statistics\n'));
      
      // Performance metrics
      const perfTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 25]
      });
      
      perfTable.push(
        ['Memory Usage', `${Math.round(stats.memoryUsage.used / 1024 / 1024)} MB`],
        ['Heap Used', `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)} MB`],
        ['Heap Total', `${Math.round(stats.memoryUsage.heapTotal / 1024 / 1024)} MB`],
        ['External', `${Math.round(stats.memoryUsage.external / 1024 / 1024)} MB`]
      );
      
      console.log(perfTable.toString());
      
      // Cache statistics
      if (stats.cacheStats) {
        console.log(chalk.bold('\n💾 Cache Statistics\n'));
        
        const cacheTable = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          colWidths: [25, 25]
        });
        
        cacheTable.push(
          ['Hit Rate', `${stats.cacheStats.hitRate}%`],
          ['Total Hits', stats.cacheStats.hits.toLocaleString()],
          ['Total Misses', stats.cacheStats.misses.toLocaleString()],
          ['Current Items', stats.cacheStats.currentItems.toLocaleString()],
          ['Memory Usage', stats.cacheStats.memoryUsage],
          ['Evictions', stats.cacheStats.evictions.toLocaleString()]
        );
        
        console.log(cacheTable.toString());
      }
      
      // Storage statistics
      if (stats.storageStats) {
        console.log(chalk.bold('\n💿 Storage Statistics\n'));
        
        const storageTable = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          colWidths: [25, 25]
        });
        
        storageTable.push(
          ['Total Reads', stats.storageStats.totalReads.toLocaleString()],
          ['Total Writes', stats.storageStats.totalWrites.toLocaleString()],
          ['Total Bytes', `${Math.round(stats.storageStats.totalBytes / 1024 / 1024)} MB`]
        );
        
        console.log(storageTable.toString());
      }
      
    } catch (error) {
      spinner.fail();
      log(`Failed to get statistics: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Collections command
program
  .command('collections')
  .description('List all collections')
  .alias('ls')
  .option('-d, --details', 'show detailed information')
  .action(async (options) => {
    const spinner = createSpinner('Loading collections...');
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      const collections = Array.from(db.collections.keys());
      
      spinner.succeed();
      
      if (collections.length === 0) {
        log('No collections found', 'info');
        await db.close();
        return;
      }
      
      console.log(chalk.bold('\n📁 Collections\n'));
      
      if (options.details) {
        for (const collectionName of collections) {
          const collection = db.collections.get(collectionName);
          const stats = await db.storage.getCollectionStats(collectionName);
          
          console.log(chalk.cyan.bold(collectionName));
          console.log(`  Documents: ${collection.metadata.totalDocuments}`);
          console.log(`  Created: ${collection.created.toLocaleString()}`);
          console.log(`  Modified: ${collection.metadata.lastModified.toLocaleString()}`);
          if (stats) {
            console.log(`  Size: ${Math.round(stats.size / 1024)} KB`);
          }
          console.log('');
        }
      } else {
        const table = new Table({
          head: [chalk.cyan('Name'), chalk.cyan('Documents'), chalk.cyan('Last Modified')],
          colWidths: [30, 15, 25]
        });
        
        for (const collectionName of collections) {
          const collection = db.collections.get(collectionName);
          if (collection) {
            table.push([
              collectionName,
              collection.metadata.totalDocuments.toString(),
              collection.metadata.lastModified.toLocaleString()
            ]);
          }
        }
        
        console.log(table.toString());
      }
      
      await db.close();
      
    } catch (error) {
      spinner.fail();
      log(`Failed to list collections: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Create collection command
program
  .command('create')
  .description('Create a new collection')
  .argument('<name>', 'collection name')
  .option('-s, --schema <file>', 'schema file (JSON)')
  .action(async (name, options) => {
    const spinner = createSpinner(`Creating collection '${name}'...`);
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      
      let schema = null;
      if (options.schema) {
        if (!existsSync(options.schema)) {
          throw new Error(`Schema file not found: ${options.schema}`);
        }
        const schemaContent = await fs.readFile(options.schema, 'utf8');
        schema = JSON.parse(schemaContent);
      }
      
      await db.createCollection(name, schema);
      await db.close();
      
      spinner.succeed();
      log(`Collection '${name}' created successfully`, 'success');
      
      if (schema) {
        log(`Schema applied with ${Object.keys(schema).length} fields`, 'info');
      }
      
    } catch (error) {
      spinner.fail();
      log(`Failed to create collection: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Drop collection command
program
  .command('drop')
  .description('Drop a collection')
  .argument('<name>', 'collection name')
  .option('--force', 'skip confirmation prompt')
  .action(async (name, options) => {
    if (!options.force) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question(`Are you sure you want to drop collection '${name}'? (y/N): `, resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        log('Operation cancelled', 'info');
        return;
      }
    }
    
    const spinner = createSpinner(`Dropping collection '${name}'...`);
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      
      if (!db.collections.has(name)) {
        throw new Error(`Collection '${name}' does not exist`);
      }
      
      // Remove all documents first
      const collection = db.collections.get(name);
      const documentIds = Array.from(collection.documents.keys());
      
      for (const id of documentIds) {
        await db.delete(name, id);
      }
      
      // Remove collection
      db.collections.delete(name);
      db.schemas.delete(name);
      
      // Remove from storage
      await db.storage.dropCollection(name);
      
      await db.close();
      
      spinner.succeed();
      log(`Collection '${name}' dropped successfully`, 'success');
      log(`Removed ${documentIds.length} documents`, 'info');
      
    } catch (error) {
      spinner.fail();
      log(`Failed to drop collection: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Import data command
program
  .command('import')
  .description('Import data from JSON file')
  .argument('<collection>', 'collection name')
  .argument('<file>', 'JSON file path')
  .option('--batch-size <n>', 'batch size for import', '100')
  .option('--create-collection', 'create collection if it doesn\'t exist')
  .action(async (collection, file, options) => {
    const spinner = createSpinner(`Importing data into '${collection}'...`);
    
    try {
      if (!existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }
      
      spinner.start();
      
      const db = await connectToDatabase();
      
      // Check if collection exists
      if (!db.collections.has(collection)) {
        if (options.createCollection) {
          await db.createCollection(collection);
          log(`Created collection '${collection}'`, 'info');
        } else {
          throw new Error(`Collection '${collection}' does not exist. Use --create-collection flag.`);
        }
      }
      
      // Read and parse JSON file
      const fileContent = await fs.readFile(file, 'utf8');
      let data;
      
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON file: ${parseError.message}`);
      }
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        data = [data];
      }
      
      const batchSize = parseInt(options.batchSize);
      let imported = 0;
      let failed = 0;
      
      // Import in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        for (const item of batch) {
          try {
            await db.insert(collection, item);
            imported++;
          } catch (error) {
            failed++;
            if (globalConfig.verbose) {
              log(`Failed to import item: ${error.message}`, 'warning');
            }
          }
        }
        
        // Update spinner text with progress
        const progress = Math.round((i + batch.length) / data.length * 100);
        spinner.text = `Importing data... ${progress}% (${imported} imported, ${failed} failed)`;
      }
      
      await db.close();
      spinner.succeed();
      
      log(`Import completed: ${imported} documents imported`, 'success');
      if (failed > 0) {
        log(`${failed} documents failed to import`, 'warning');
      }
      
    } catch (error) {
      spinner.fail();
      log(`Import failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Export data command
program
  .command('export')
  .description('Export collection data to JSON file')
  .argument('<collection>', 'collection name')
  .argument('<file>', 'output JSON file path')
  .option('--pretty', 'format JSON with indentation')
  .option('--query <json>', 'filter documents with query (JSON)')
  .action(async (collection, file, options) => {
    const spinner = createSpinner(`Exporting '${collection}' data...`);
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      
      if (!db.collections.has(collection)) {
        throw new Error(`Collection '${collection}' does not exist`);
      }
      
      let queryOptions = {};
      if (options.query) {
        try {
          const query = JSON.parse(options.query);
          queryOptions.where = query;
        } catch (parseError) {
          throw new Error(`Invalid query JSON: ${parseError.message}`);
        }
      }
      
      // Get all documents
      const documents = await db.query(collection, queryOptions);
      
      await db.close();
      
      // Write to file
      const jsonContent = JSON.stringify(documents, null, options.pretty ? 2 : 0);
      await fs.writeFile(file, jsonContent, 'utf8');
      
      spinner.succeed();
      log(`Exported ${documents.length} documents to ${file}`, 'success');
      
    } catch (error) {
      spinner.fail();
      log(`Export failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage database configuration')
  .option('-l, --list', 'list all configuration')
  .option('-g, --get <key>', 'get configuration value')
  .option('-s, --set <key=value>', 'set configuration value')
  .option('-d, --delete <key>', 'delete configuration key')
  .option('-e, --export <file>', 'export configuration to file')
  .option('-i, --import <file>', 'import configuration from file')
  .action(async (options) => {
    const spinner = createSpinner('Managing configuration...');
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      const config = db.configManager;
      
      if (options.list) {
        const allConfig = config.getAll();
        spinner.succeed();
        
        console.log(chalk.bold('\n⚙️  Database Configuration\n'));
        console.log(JSON.stringify(allConfig, null, 2));
        
      } else if (options.get) {
        const value = config.get(options.get);
        spinner.succeed();
        
        console.log(chalk.bold(`\n⚙️  Configuration: ${options.get}\n`));
        console.log(JSON.stringify(value, null, 2));
        
      } else if (options.set) {
        const [key, value] = options.set.split('=');
        if (!key || value === undefined) {
          throw new Error('Invalid format. Use: key=value');
        }
        
        // Try to parse value as JSON, fallback to string
        let parsedValue;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          parsedValue = value;
        }
        
        await config.set(key, parsedValue);
        spinner.succeed();
        
        log(`Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`, 'success');
        
      } else if (options.delete) {
        const deleted = await config.delete(options.delete);
        spinner.succeed();
        
        if (deleted) {
          log(`Configuration deleted: ${options.delete}`, 'success');
        } else {
          log(`Configuration key not found: ${options.delete}`, 'warning');
        }
        
      } else if (options.export) {
        await config.export(options.export);
        spinner.succeed();
        
        log(`Configuration exported to: ${options.export}`, 'success');
        
      } else if (options.import) {
        await config.import(options.import);
        spinner.succeed();
        
        log(`Configuration imported from: ${options.import}`, 'success');
        
      } else {
        spinner.fail();
        log('No configuration action specified. Use --help for options.', 'error');
      }
      
      await db.close();
      
    } catch (error) {
      spinner.fail();
      log(`Configuration operation failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Backup command
program
  .command('backup')
  .description('Create database backup')
  .option('-o, --output <path>', 'backup output path')
  .action(async (options) => {
    const spinner = createSpinner('Creating backup...');
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      const backupPath = await db.backup(options.output);
      
      await db.close();
      spinner.succeed();
      
      log(`Backup created: ${backupPath}`, 'success');
      
    } catch (error) {
      spinner.fail();
      log(`Backup failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Restore command
program
  .command('restore')
  .description('Restore database from backup')
  .argument('<backup-path>', 'path to backup file')
  .option('--force', 'overwrite existing database')
  .action(async (backupPath, options) => {
    const spinner = createSpinner('Restoring from backup...');
    
    try {
      spinner.start();
      
      if (!existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
      
      const configPath = join(globalConfig.path, 'bigbase.config.json');
      if (existsSync(configPath) && !options.force) {
        throw new Error('Database already exists. Use --force to overwrite.');
      }
      
      const db = new BigBaseAlpha({ path: globalConfig.path });
      await db.init();
      await db.storage.restore(backupPath);
      await db.close();
      
      spinner.succeed();
      log(`Database restored from: ${backupPath}`, 'success');
      
    } catch (error) {
      spinner.fail();
      log(`Restore failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Plugins command
program
  .command('plugins')
  .description('Manage plugins')
  .option('-l, --list', 'list loaded plugins')
  .option('-i, --info <name>', 'show plugin information')
  .action(async (options) => {
    const spinner = createSpinner('Managing plugins...');
    
    try {
      spinner.start();
      
      const db = await connectToDatabase();
      
      if (options.list) {
        const plugins = db.plugins.getLoadedPlugins();
        const stats = db.plugins.getStats();
        
        spinner.succeed();
        
        console.log(chalk.bold('\n🔌 Loaded Plugins\n'));
        
        if (plugins.length === 0) {
          log('No plugins loaded', 'info');
        } else {
          const table = new Table({
            head: [chalk.cyan('Name'), chalk.cyan('Version'), chalk.cyan('Description')],
            colWidths: [20, 10, 40]
          });
          
          for (const pluginName of plugins) {
            const info = db.plugins.getPluginInfo(pluginName);
            table.push([
              info.name,
              info.version,
              info.description
            ]);
          }
          
          console.log(table.toString());
          
          console.log(chalk.bold('\n📊 Plugin Statistics\n'));
          console.log(`Total Plugins: ${stats.totalPlugins}`);
          console.log(`Hook Handlers: ${Object.keys(stats.hooks).length}`);
        }
        
      } else if (options.info) {
        const info = db.plugins.getPluginInfo(options.info);
        
        spinner.succeed();
        
        if (!info) {
          log(`Plugin not found: ${options.info}`, 'error');
        } else {
          console.log(chalk.bold(`\n🔌 Plugin: ${info.name}\n`));
          console.log(`Version: ${info.version}`);
          console.log(`Description: ${info.description}`);
          console.log(`Author: ${info.author}`);
          console.log(`Hooks: ${info.hooks.join(', ')}`);
          console.log(`Loaded: ${info.config.loaded.toLocaleString()}`);
        }
        
      } else {
        spinner.fail();
        log('No plugin action specified. Use --help for options.', 'error');
      }
      
      await db.close();
      
    } catch (error) {
      spinner.fail();
      log(`Plugin operation failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Doctor command - health check
program
  .command('doctor')
  .description('Run database health checks')
  .action(async () => {
    console.log(chalk.bold('\n🔍 BigBaseAlpha Health Check\n'));
    
    const checks = [
      {
        name: 'Database Directory',
        check: () => existsSync(globalConfig.path),
        fix: 'Run "bigbase init" to create a new database'
      },
      {
        name: 'Configuration File',
        check: () => existsSync(join(globalConfig.path, 'bigbase.config.json')),
        fix: 'Run "bigbase init" to create configuration'
      },
      {
        name: 'Collections Directory',
        check: () => existsSync(join(globalConfig.path, 'collections')),
        fix: 'Database will create this automatically'
      },
      {
        name: 'Metadata Directory',
        check: () => existsSync(join(globalConfig.path, 'metadata')),
        fix: 'Database will create this automatically'
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const check of checks) {
      const result = check.check();
      
      if (result) {
        console.log(`${chalk.green('✓')} ${check.name}`);
        passed++;
      } else {
        console.log(`${chalk.red('✗')} ${check.name} - ${check.fix}`);
        failed++;
      }
    }
    
    console.log(chalk.bold(`\n📊 Results: ${chalk.green(passed + ' passed')}, ${chalk.red(failed + ' failed')}\n`));
    
    if (failed > 0) {
      process.exit(1);
    }
  });

// Benchmark command
program
  .command('benchmark')
  .description('Run performance benchmarks')
  .option('-n, --operations <n>', 'number of operations per test', '1000')
  .option('-t, --test <type>', 'specific test to run (insert|read|update|delete)', 'all')
  .action(async (options) => {
    console.log(chalk.bold('\n⚡ BigBaseAlpha Benchmark\n'));
    
    const operations = parseInt(options.operations);
    const testType = options.test;
    
    const spinner = createSpinner('Preparing benchmark...');
    
    try {
      spinner.start();
      
      // Create temporary database for benchmark
      const benchmarkPath = join(globalConfig.path, '.benchmark');
      if (existsSync(benchmarkPath)) {
        await fs.rm(benchmarkPath, { recursive: true });
      }
      
      const db = new BigBaseAlpha({
        path: benchmarkPath,
        format: 'json',
        encryption: false,
        compression: false,
        caching: true,
        indexing: true,
        auditLog: false
      });
      
      await db.init();
      await db.createCollection('benchmark');
      
      spinner.succeed();
      
      // Benchmark functions
      const benchmarks = {
        async insert() {
          console.log(chalk.cyan(`\n📝 Insert Benchmark (${operations} operations)`));
          const start = process.hrtime.bigint();
          
          for (let i = 0; i < operations; i++) {
            await db.insert('benchmark', {
              name: `User ${i}`,
              email: `user${i}@example.com`,
              age: Math.floor(Math.random() * 50) + 20,
              timestamp: new Date(),
              data: { index: i, random: Math.random() }
            });
          }
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000; // Convert to milliseconds
          const opsPerSecond = Math.round(operations / (duration / 1000));
          
          console.log(`  ⏱️  Duration: ${duration.toFixed(2)}ms`);
          console.log(`  🚀 Operations/sec: ${opsPerSecond.toLocaleString()}`);
          console.log(`  💾 Avg per operation: ${(duration / operations).toFixed(2)}ms`);
          
          return { duration, opsPerSecond };
        },
        
        async read() {
          console.log(chalk.cyan(`\n📖 Read Benchmark (${operations} operations)`));
          
          // Get some document IDs to read
          const docs = await db.query('benchmark', { limit: Math.min(operations, 100) });
          if (docs.length === 0) {
            console.log('  ⚠️  No documents to read. Run insert benchmark first.');
            return null;
          }
          
          const start = process.hrtime.bigint();
          
          for (let i = 0; i < operations; i++) {
            const docId = docs[i % docs.length]._id;
            await db.findById('benchmark', docId);
          }
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000;
          const opsPerSecond = Math.round(operations / (duration / 1000));
          
          console.log(`  ⏱️  Duration: ${duration.toFixed(2)}ms`);
          console.log(`  🚀 Operations/sec: ${opsPerSecond.toLocaleString()}`);
          console.log(`  💾 Avg per operation: ${(duration / operations).toFixed(2)}ms`);
          
          return { duration, opsPerSecond };
        },
        
        async update() {
          console.log(chalk.cyan(`\n✏️  Update Benchmark (${operations} operations)`));
          
          const docs = await db.query('benchmark', { limit: Math.min(operations, 100) });
          if (docs.length === 0) {
            console.log('  ⚠️  No documents to update. Run insert benchmark first.');
            return null;
          }
          
          const start = process.hrtime.bigint();
          
          for (let i = 0; i < operations; i++) {
            const doc = docs[i % docs.length];
            await db.update('benchmark', doc._id, {
              age: Math.floor(Math.random() * 50) + 20,
              updated: new Date()
            });
          }
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000;
          const opsPerSecond = Math.round(operations / (duration / 1000));
          
          console.log(`  ⏱️  Duration: ${duration.toFixed(2)}ms`);
          console.log(`  🚀 Operations/sec: ${opsPerSecond.toLocaleString()}`);
          console.log(`  💾 Avg per operation: ${(duration / operations).toFixed(2)}ms`);
          
          return { duration, opsPerSecond };
        },
        
        async delete() {
          console.log(chalk.cyan(`\n🗑️  Delete Benchmark (${operations} operations)`));
          
          const docs = await db.query('benchmark', { limit: operations });
          if (docs.length === 0) {
            console.log('  ⚠️  No documents to delete. Run insert benchmark first.');
            return null;
          }
          
          const start = process.hrtime.bigint();
          
          for (let i = 0; i < Math.min(operations, docs.length); i++) {
            await db.delete('benchmark', docs[i]._id);
          }
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000;
          const actualOps = Math.min(operations, docs.length);
          const opsPerSecond = Math.round(actualOps / (duration / 1000));
          
          console.log(`  ⏱️  Duration: ${duration.toFixed(2)}ms`);
          console.log(`  🚀 Operations/sec: ${opsPerSecond.toLocaleString()}`);
          console.log(`  💾 Avg per operation: ${(duration / actualOps).toFixed(2)}ms`);
          
          return { duration, opsPerSecond };
        }
      };
      
      // Run benchmarks
      const results = {};
      
      if (testType === 'all') {
        for (const [name, benchmark] of Object.entries(benchmarks)) {
          results[name] = await benchmark();
        }
      } else if (benchmarks[testType]) {
        results[testType] = await benchmarks[testType]();
      } else {
        throw new Error(`Unknown test type: ${testType}`);
      }
      
      await db.close();
      
      // Cleanup
      await fs.rm(benchmarkPath, { recursive: true });
      
      // Summary
      console.log(chalk.bold('\n📊 Benchmark Summary\n'));
      
      const summaryTable = new Table({
        head: [chalk.cyan('Test'), chalk.cyan('Duration (ms)'), chalk.cyan('Ops/sec')],
        colWidths: [15, 15, 15]
      });
      
      for (const [test, result] of Object.entries(results)) {
        if (result) {
          summaryTable.push([
            test.charAt(0).toUpperCase() + test.slice(1),
            result.duration.toFixed(2),
            result.opsPerSecond.toLocaleString()
          ]);
        }
      }
      
      console.log(summaryTable.toString());
      
    } catch (error) {
      spinner.fail();
      log(`Benchmark failed: ${error.message}`, 'error');
      if (globalConfig.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Error handling
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name()
});

program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
  process.exit(1);
});

// Main execution
if (process.argv.length === 2) {
  program.help();
}

program.parse();
