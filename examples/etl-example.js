#!/usr/bin/env node

// ETL & Data Pipeline Example for BigBaseAlpha
import BigBaseAlpha from '../src/alpha.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function etlExample() {
    console.log('🔄 BigBaseAlpha ETL & Data Pipeline Example');
    console.log('='.repeat(60));

    try {
        // Initialize database
        console.log('\n📊 Initializing BigBaseAlpha with ETL...');
        const db = new BigBaseAlpha({
            path: './etl_example_data',
            indexing: true,
            caching: true,
            auditLog: true
        });

        await db.init();
        console.log('✅ Database with ETL engine initialized');

        // Create test collections
        console.log('\n📁 Creating test collections...');
        await db.createCollection('raw_users', {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
            age: { type: 'number' }
        });

        await db.createCollection('processed_users', {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
            age: { type: 'number' },
            status: { type: 'string' }
        });

        // Create sample CSV data
        console.log('\n📝 Creating sample CSV data...');
        const csvData = [
            'name,email,age,status',
            'John Doe,john.doe@example.com,30,ACTIVE',
            'Jane Smith,jane.smith@example.com,25,ACTIVE', 
            'Bob Johnson,bob.johnson@example.com,35,INACTIVE',
            'Alice Brown,alice.brown@example.com,28,ACTIVE',
            'Charlie Wilson,charlie.wilson@example.com,42,PENDING'
        ].join('\n');

        const csvPath = './etl_example_data/sample_users.csv';
        await fs.writeFile(csvPath, csvData, 'utf8');
        console.log(`✅ Sample CSV created: ${csvPath}`);

        // Example 1: Simple CSV Import Pipeline
        console.log('\n🔄 Example 1: Creating CSV Import Pipeline...');
        const importPipeline = await db.createETLPipeline({
            name: 'User Data Import',
            description: 'Import user data from CSV file',
            source: {
                type: 'csv',
                path: csvPath
            },
            destination: {
                type: 'collection',
                collection: 'raw_users'
            },
            transformations: [
                {
                    type: 'normalize',
                    config: {
                        fields: ['email', 'status']
                    }
                }
            ],
            validations: [
                {
                    type: 'schema',
                    config: {
                        schema: {
                            name: { required: true, type: 'string' },
                            email: { required: true, type: 'string' },
                            age: { type: 'string' } // CSV data comes as strings
                        }
                    }
                }
            ],
            schedule: null, // Manual execution
            enabled: true
        });

        console.log(`✅ Import pipeline created: ${importPipeline.id}`);

        // Execute import pipeline
        console.log('\n▶️ Executing import pipeline...');
        const importExecution = await db.executeETLPipeline(importPipeline.id);
        console.log(`✅ Import completed - Status: ${importExecution.status}`);
        console.log(`   Rows processed: ${importExecution.rowsProcessed}`);
        console.log(`   Duration: ${importExecution.endTime - importExecution.startTime}ms`);

        // Example 2: Data Transformation Pipeline
        console.log('\n🔄 Example 2: Creating Data Transformation Pipeline...');
        const transformPipeline = await db.createETLPipeline({
            name: 'User Data Processing',
            description: 'Process and transform user data',
            source: {
                type: 'collection',
                collection: 'raw_users',
                query: {} // Get all records
            },
            destination: {
                type: 'collection',
                collection: 'processed_users'
            },
            transformations: [
                {
                    type: 'map',
                    config: {
                        mapping: {
                            name: 'name',
                            email: 'email',
                            age: 'age',
                            status: 'status'
                        }
                    }
                },
                {
                    type: 'filter',
                    config: {
                        condition: '{{age}} >= 25' // Only adults 25+
                    }
                }
            ],
            validations: [
                {
                    type: 'completeness',
                    config: {
                        threshold: 0.8,
                        requiredFields: ['name', 'email']
                    }
                }
            ]
        });

        console.log(`✅ Transform pipeline created: ${transformPipeline.id}`);

        // Execute transformation pipeline
        console.log('\n▶️ Executing transformation pipeline...');
        const transformExecution = await db.executeETLPipeline(transformPipeline.id);
        console.log(`✅ Transform completed - Status: ${transformExecution.status}`);
        console.log(`   Rows processed: ${transformExecution.rowsProcessed}`);

        // Example 3: Data Aggregation Pipeline
        console.log('\n🔄 Example 3: Creating Data Aggregation Pipeline...');
        const aggregationPipeline = await db.createETLPipeline({
            name: 'User Statistics Aggregation',
            description: 'Generate user statistics by status',
            source: {
                type: 'collection',
                collection: 'processed_users'
            },
            destination: {
                type: 'json',
                path: './etl_example_data/user_stats.json'
            },
            transformations: [
                {
                    type: 'aggregate',
                    config: {
                        groupBy: 'status',
                        aggregations: {
                            count: 'count',
                            avg_age: 'avg'
                        }
                    }
                }
            ]
        });

        console.log(`✅ Aggregation pipeline created: ${aggregationPipeline.id}`);

        // Execute aggregation pipeline
        console.log('\n▶️ Executing aggregation pipeline...');
        const aggExecution = await db.executeETLPipeline(aggregationPipeline.id);
        console.log(`✅ Aggregation completed - Status: ${aggExecution.status}`);

        // Example 4: Scheduled Data Export Pipeline
        console.log('\n🔄 Example 4: Creating Scheduled Export Pipeline...');
        const exportPipeline = await db.createETLPipeline({
            name: 'Daily User Export',
            description: 'Daily export of processed users to CSV',
            source: {
                type: 'collection',
                collection: 'processed_users'
            },
            destination: {
                type: 'csv',
                path: './etl_example_data/daily_users_export.csv'
            },
            schedule: 'daily',
            enabled: true
        });

        console.log(`✅ Export pipeline created: ${exportPipeline.id}`);
        console.log(`   Scheduled: ${exportPipeline.schedule}`);

        // Show pipeline status
        console.log('\n📊 ETL Pipeline Status:');
        const allPipelines = db.getETLPipelines();
        allPipelines.forEach(pipeline => {
            console.log(`   • ${pipeline.name} (${pipeline.id})`);
            console.log(`     Status: ${pipeline.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`     Schedule: ${pipeline.schedule || 'Manual'}`);
            console.log(`     Total runs: ${pipeline.stats.totalRuns}`);
            console.log(`     Success rate: ${pipeline.stats.totalRuns > 0 ? 
                Math.round((pipeline.stats.successfulRuns / pipeline.stats.totalRuns) * 100) : 0}%`);
        });

        // Show ETL statistics
        console.log('\n📈 ETL Engine Statistics:');
        const etlStats = db.getETLStats();
        console.log(`   Total Pipelines: ${etlStats.totalPipelinesConfigured}`);
        console.log(`   Active Pipelines: ${etlStats.activePipelines}`);
        console.log(`   Scheduled Pipelines: ${etlStats.scheduledPipelines}`);
        console.log(`   Total Jobs Executed: ${etlStats.totalJobs}`);
        console.log(`   Success Rate: ${etlStats.totalJobs > 0 ? 
            Math.round((etlStats.successfulJobs / etlStats.totalJobs) * 100) : 0}%`);
        console.log(`   Total Rows Processed: ${etlStats.totalRowsProcessed}`);

        // Show job history
        console.log('\n📋 Recent Job History:');
        const jobHistory = db.getETLJobHistory(5);
        jobHistory.forEach(job => {
            console.log(`   • ${job.id} - ${job.status}`);
            console.log(`     Duration: ${job.endTime ? job.endTime - job.startTime : 'N/A'}ms`);
            console.log(`     Rows: ${job.rowsProcessed}`);
        });

        // Verify data in collections
        console.log('\n🔍 Verifying processed data...');
        const rawUsers = await db.find('raw_users');
        const processedUsers = await db.find('processed_users');
        
        console.log(`   Raw users collection: ${rawUsers.length} records`);
        console.log(`   Processed users collection: ${processedUsers.length} records`);

        // Show sample processed data
        if (processedUsers.length > 0) {
            console.log('\n📋 Sample processed user:');
            const sample = processedUsers[0];
            console.log(`   Name: ${sample.name}`);
            console.log(`   Email: ${sample.email}`);
            console.log(`   Age: ${sample.age}`);
            console.log(`   Status: ${sample.status}`);
        }

        // Test quick import/export methods
        console.log('\n🚀 Testing Quick Import/Export Methods...');
        
        // Create another sample CSV
        const quickCsvData = [
            'name,department,salary',
            'Alice Johnson,Engineering,75000',
            'Bob Smith,Marketing,55000',
            'Carol Davis,Sales,60000'
        ].join('\n');
        
        const quickCsvPath = './etl_example_data/employees.csv';
        await fs.writeFile(quickCsvPath, quickCsvData, 'utf8');

        // Quick import
        console.log('\n📥 Quick CSV import...');
        await db.createCollection('employees');
        const quickImport = await db.importFromCSV('employees', quickCsvPath);
        console.log(`✅ Quick import completed - Rows: ${quickImport.rowsProcessed}`);

        // Quick export
        console.log('\n📤 Quick CSV export...');
        const quickExport = await db.exportToCSV('employees', './etl_example_data/employees_backup.csv');
        console.log(`✅ Quick export completed - Rows: ${quickExport.rowsProcessed}`);

        console.log('\n✅ ETL & Data Pipeline examples completed successfully!');
        console.log('🎉 BigBaseAlpha now has powerful data processing capabilities!');

        // Clean up
        await db.close();

    } catch (error) {
        console.error('\n❌ ETL example failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the example
etlExample().catch(console.error);
