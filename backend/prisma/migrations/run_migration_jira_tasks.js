/**
 * Migration Script: Create jira_tasks table
 * Run this script to create the jira_tasks table in the database
 * 
 * Usage: node run_migration_jira_tasks.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL not found in .env file');
        console.error('Expected path:', path.join(__dirname, '../.env'));
        process.exit(1);
    }
    
    console.log('✅ DATABASE_URL loaded successfully');
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('rds.amazonaws.com') ? {
            rejectUnauthorized: false
        } : false
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        // Read the migration SQL file
        const migrationPath = path.join(__dirname, '20260205_create_jira_tasks_table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Running migration: Create jira_tasks table...');
        
        // Execute the migration
        await client.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('📊 Table created: jira_tasks');
        console.log('📊 Indexes created: 6 indexes');
        console.log('');
        console.log('Next steps:');
        console.log('1. Verify the table exists: SELECT * FROM jira_tasks LIMIT 1;');
        console.log('2. Deploy the jiraTasksHandler Lambda function');
        console.log('3. Update the frontend to use the new table');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('');
        console.error('Error details:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('');
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
runMigration().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});