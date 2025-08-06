/*
 * BigBaseAlpha v1.5.1 Logger System Examples
 * Professional enterprise logging with full customization
 */

import { BigBaseAlpha } from '../src/alpha.js';

async function loggerExamples() {
  console.log('='.repeat(80));
  console.log('BigBaseAlpha v1.5.1 - Professional Logger System Examples');
  console.log('='.repeat(80));

  // Example 1: Enterprise Logging (Default v1.5.1)
  console.log('\n📋 Example 1: Enterprise Text-Based Logging (v1.5.1 Default)');
  const enterprise = new BigBaseAlpha({
    path: './example_enterprise',
    logger: {
      preset: 'enterprise',  // Professional [INFO], [SUCCESS], [WARN] format
      prefix: 'MyCompany'
    }
  });

  await enterprise.init();
  await enterprise.createCollection('employees');
  
  // Manual logging
  enterprise.log.info('System ready for production');
  enterprise.log.success('All health checks passed');
  enterprise.log.warn('Memory usage above 80%');
  
  await enterprise.close();

  // Example 2: Custom Corporate Branding
  console.log('\n🏢 Example 2: Custom Corporate Color Scheme');
  const branded = new BigBaseAlpha({
    path: './example_branded',
    logger: {
      format: 'text',
      prefix: 'ACME Corp',
      timestamp: true,
      colorScheme: {
        info: 'brightBlue',      // Corporate blue
        success: 'brightGreen',   // Success green
        warn: 'brightYellow',     // Warning amber
        error: 'brightRed',       // Error red
        process: 'brightMagenta'  // Process purple
      }
    }
  });

  await branded.init();
  branded.log.info('Corporate database system online');
  branded.log.success('Security protocols activated');
  await branded.close();

  // Example 3: Production Minimal Logging
  console.log('\n🚀 Example 3: Production Minimal Logging');
  const production = new BigBaseAlpha({
    path: './example_production',
    logger: {
      preset: 'minimal',  // Compact symbols for production
      colors: false       // No colors for log files
    }
  });

  await production.init();
  await production.createCollection('orders');
  production.log.info('Orders system initialized');
  await production.close();

  // Example 4: JSON Logging for ELK Stack
  console.log('\n📊 Example 4: JSON Logging for Log Aggregation (ELK Stack)');
  const jsonLogger = new BigBaseAlpha({
    path: './example_json',
    logger: {
      preset: 'json',
      timestamp: true
    }
  });

  await jsonLogger.init();
  jsonLogger.log.info('JSON structured logging active');
  jsonLogger.log.success('Ready for Elasticsearch ingestion');
  await jsonLogger.close();

  // Example 5: Runtime Configuration Changes
  console.log('\n⚙️ Example 5: Runtime Logger Configuration');
  const dynamic = new BigBaseAlpha({
    path: './example_dynamic',
    logger: { preset: 'enterprise' }
  });

  await dynamic.init();
  
  console.log('\n→ Starting with enterprise format...');
  dynamic.log.info('Initial configuration loaded');
  
  console.log('\n→ Switching to emoji format...');
  dynamic.setLoggerFormat('emoji');
  dynamic.log.success('Now using emoji format');
  
  console.log('\n→ Switching to minimal format...');
  dynamic.setLoggerFormat('minimal');
  dynamic.log.info('Minimal format active');
  
  console.log('\n→ Applying debug preset...');
  dynamic.setLoggerPreset('debug');
  dynamic.log.debug('Debug level information');
  
  await dynamic.close();

  // Example 6: Module-Specific Child Loggers
  console.log('\n🧩 Example 6: Module-Specific Child Loggers');
  const modular = new BigBaseAlpha({
    path: './example_modular',
    logger: { preset: 'enterprise' }
  });

  await modular.init();

  // Create specialized loggers for different modules
  const authLogger = modular.createChildLogger({
    prefix: 'AUTH',
    colorScheme: { success: 'brightGreen', error: 'brightRed' }
  });

  const apiLogger = modular.createChildLogger({
    prefix: 'API',
    colorScheme: { info: 'brightBlue', process: 'cyan' }
  });

  const dbLogger = modular.createChildLogger({
    prefix: 'DATABASE',
    colorScheme: { success: 'green', warn: 'yellow' }
  });

  // Use specialized loggers
  authLogger.info('User authentication initiated');
  authLogger.success('JWT token generated');
  
  apiLogger.info('REST API endpoint called');
  apiLogger.process('Processing request...');
  
  dbLogger.success('Database query completed');
  dbLogger.warn('Connection pool usage high');

  await modular.close();

  // Example 7: Legacy Compatibility Mode
  console.log('\n🔄 Example 7: Legacy Emoji Compatibility (pre-v1.5.1)');
  const legacy = new BigBaseAlpha({
    path: './example_legacy',
    logger: {
      preset: 'legacy'  // Maintains old emoji format
    }
  });

  await legacy.init();
  await legacy.createCollection('legacy_data');
  legacy.log.success('Legacy mode active for backward compatibility');
  await legacy.close();

  // Example 8: Silent Mode for Embedded Systems
  console.log('\n🔇 Example 8: Silent Mode for Embedded/SDK Usage');
  const silent = new BigBaseAlpha({
    path: './example_silent',
    logger: {
      preset: 'silent'  // No console output
    }
  });

  await silent.init();
  silent.log.info('This message will not appear');
  silent.log.error('Neither will this error');
  await silent.close();
  console.log('Silent mode completed (no output above)');

  console.log('\n' + '='.repeat(80));
  console.log('Logger Examples Complete!');
  console.log('BigBaseAlpha v1.5.1 provides enterprise-grade logging flexibility');
  console.log('='.repeat(80));
}

// Run examples
loggerExamples().catch(console.error);
