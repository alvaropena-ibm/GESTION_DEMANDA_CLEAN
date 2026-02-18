#!/usr/bin/env node

/**
 * Migration Script: Add tasks_type configuration
 * Date: 2026-02-16
 * Description: Inserts tasks_type configuration for each team (SAP, SAPLCORP, Mulesoft, Darwin)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') ? {
        rejectUnauthorized: false
    } : false
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting migration: Add tasks_type configuration...');
        console.log('📁 Reading SQL file...');
        
        // Read SQL file
        const sqlPath = path.join(__dirname, '20260216_add_tasks_type_config.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 Executing migration...');
        
        // Execute migration
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('📊 Verifying insertions...');
        
        // Verify insertions
        const result = await client.query(`
            SELECT config_key, config_value, team, created_at 
            FROM app_config 
            WHERE config_key = 'tasks_type'
            ORDER BY team
        `);
        
        console.log('');
        console.log('✅ Configuration entries created:');
        console.log('═══════════════════════════════════════════════════════════');
        result.rows.forEach(row => {
            console.log(`Team: ${row.team}`);
            console.log(`Key: ${row.config_key}`);
            console.log(`Value: ${row.config_value}`);
            console.log(`Created: ${row.created_at}`);
            console.log('───────────────────────────────────────────────────────────');
        });
        
        console.log('');
        console.log('🎉 Migration completed successfully!');
        console.log(`📝 Total configurations created: ${result.rows.length}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });