/**
 * Migration Script: Add fix_versions field
 * Date: 2026-02-13
 * Description: Adds fix_versions JSONB field to projects and jira_tasks tables
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') ? {
            rejectUnauthorized: false
        } : false
    });

    try {
        console.log('🔌 Conectando a la base de datos...');
        await client.connect();
        console.log('✅ Conectado exitosamente');

        // Read migration file
        const migrationPath = path.join(__dirname, '20260213_add_fix_versions.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('\n📝 Ejecutando migración: Add fix_versions field...');
        console.log('─'.repeat(60));

        // Execute migration
        await client.query(migrationSQL);

        console.log('✅ Migración ejecutada exitosamente');
        console.log('─'.repeat(60));

        // Verify the changes
        console.log('\n🔍 Verificando cambios...');
        
        const projectsCheck = await client.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'projects' AND column_name = 'fix_versions'
        `);

        const jiraTasksCheck = await client.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'jira_tasks' AND column_name = 'fix_versions'
        `);

        if (projectsCheck.rows.length > 0) {
            console.log('✅ Campo fix_versions agregado a tabla projects');
            console.log('   Tipo:', projectsCheck.rows[0].data_type);
            console.log('   Default:', projectsCheck.rows[0].column_default);
        } else {
            console.log('❌ Campo fix_versions NO encontrado en tabla projects');
        }

        if (jiraTasksCheck.rows.length > 0) {
            console.log('✅ Campo fix_versions agregado a tabla jira_tasks');
            console.log('   Tipo:', jiraTasksCheck.rows[0].data_type);
            console.log('   Default:', jiraTasksCheck.rows[0].column_default);
        } else {
            console.log('❌ Campo fix_versions NO encontrado en tabla jira_tasks');
        }

        // Check indexes
        const indexCheck = await client.query(`
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE indexname IN ('idx_projects_fix_versions', 'idx_jira_tasks_fix_versions')
        `);

        console.log('\n📊 Índices creados:');
        indexCheck.rows.forEach(row => {
            console.log(`   ✅ ${row.indexname} en tabla ${row.tablename}`);
        });

        console.log('\n✨ Migración completada exitosamente');

    } catch (error) {
        console.error('\n❌ Error ejecutando migración:', error);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Conexión cerrada');
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('\n✅ Proceso completado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    });