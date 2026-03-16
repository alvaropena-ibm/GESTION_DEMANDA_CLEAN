/**
 * Script para ejecutar la migración de assignments y concept_tasks a jira_tasks
 * 
 * Este script:
 * 1. Lee el archivo SQL de migración
 * 2. Se conecta a la base de datos
 * 3. Ejecuta la migración
 * 4. Muestra el reporte de resultados
 * 
 * Uso:
 *   node backend/prisma/migrations/run_migration_jira_tasks.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configuración de la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com') ? {
        rejectUnauthorized: false
    } : false
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Iniciando migración a jira_tasks...\n');
        
        // Leer el archivo SQL
        const sqlFilePath = path.join(__dirname, '20260313_migrate_to_jira_tasks.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log('📄 Archivo SQL cargado correctamente');
        console.log('📊 Ejecutando migración...\n');
        
        // Ejecutar la migración dentro de una transacción
        await client.query('BEGIN');
        
        try {
            // Ejecutar el script SQL completo
            await client.query(sqlContent);
            
            // Commit de la transacción
            await client.query('COMMIT');
            
            console.log('\n✅ Migración completada exitosamente!\n');
            
            // Obtener estadísticas finales
            await showMigrationStats(client);
            
        } catch (error) {
            // Rollback en caso de error
            await client.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        console.error('\n⚠️  La migración ha sido revertida (ROLLBACK)\n');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

async function showMigrationStats(client) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                  ESTADÍSTICAS DE MIGRACIÓN                ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Estadísticas de assignments
    const assignmentsStats = await client.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(jira_task_id) as migrated,
            COUNT(*) FILTER (WHERE jira_task_id IS NULL AND project_id IS NOT NULL) as not_migrated,
            COUNT(*) FILTER (WHERE jira_task_id IS NOT NULL AND project_id IS NOT NULL) as both_ids
        FROM assignments
    `);
    
    const aStats = assignmentsStats.rows[0];
    console.log('📋 ASSIGNMENTS:');
    console.log(`   Total registros:              ${aStats.total}`);
    console.log(`   Migrados a jira_tasks:        ${aStats.migrated} (${((aStats.migrated/aStats.total)*100).toFixed(1)}%)`);
    console.log(`   No migrados:                  ${aStats.not_migrated}`);
    console.log(`   Con ambos IDs (transición):   ${aStats.both_ids}`);
    console.log('');
    
    // Estadísticas de concept_tasks
    const conceptTasksStats = await client.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(jira_task_id) as migrated,
            COUNT(*) FILTER (WHERE jira_task_id IS NULL AND project_id IS NOT NULL) as not_migrated,
            COUNT(*) FILTER (WHERE jira_task_id IS NOT NULL AND project_id IS NOT NULL) as both_ids
        FROM concept_tasks
    `);
    
    const ctStats = conceptTasksStats.rows[0];
    console.log('📝 CONCEPT_TASKS:');
    console.log(`   Total registros:              ${ctStats.total}`);
    console.log(`   Migrados a jira_tasks:        ${ctStats.migrated} (${((ctStats.migrated/ctStats.total)*100).toFixed(1)}%)`);
    console.log(`   No migrados:                  ${ctStats.not_migrated}`);
    console.log(`   Con ambos IDs (transición):   ${ctStats.both_ids}`);
    console.log('');
    
    // Verificar integridad referencial
    const orphanedAssignments = await client.query(`
        SELECT COUNT(*) as count
        FROM assignments
        WHERE jira_task_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM jira_tasks WHERE id = assignments.jira_task_id)
    `);
    
    const orphanedConceptTasks = await client.query(`
        SELECT COUNT(*) as count
        FROM concept_tasks
        WHERE jira_task_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM jira_tasks WHERE id = concept_tasks.jira_task_id)
    `);
    
    console.log('🔍 INTEGRIDAD REFERENCIAL:');
    console.log(`   Assignments huérfanos:        ${orphanedAssignments.rows[0].count}`);
    console.log(`   Concept_tasks huérfanos:      ${orphanedConceptTasks.rows[0].count}`);
    console.log('');
    
    // Mostrar registros no migrados si existen
    if (parseInt(aStats.not_migrated) > 0) {
        console.log('⚠️  ASSIGNMENTS NO MIGRADOS:');
        const notMigrated = await client.query(`
            SELECT a.id, a.title, p.code as project_code
            FROM assignments a
            LEFT JOIN projects p ON a.project_id = p.id
            WHERE a.jira_task_id IS NULL AND a.project_id IS NOT NULL
            LIMIT 5
        `);
        notMigrated.rows.forEach(row => {
            console.log(`   - ${row.title} (Project: ${row.project_code})`);
        });
        if (parseInt(aStats.not_migrated) > 5) {
            console.log(`   ... y ${parseInt(aStats.not_migrated) - 5} más`);
        }
        console.log('');
    }
    
    if (parseInt(ctStats.not_migrated) > 0) {
        console.log('⚠️  CONCEPT_TASKS NO MIGRADOS:');
        const notMigrated = await client.query(`
            SELECT ct.id, ct.title, p.code as project_code
            FROM concept_tasks ct
            LEFT JOIN projects p ON ct.project_id = p.id
            WHERE ct.jira_task_id IS NULL AND ct.project_id IS NOT NULL
            LIMIT 5
        `);
        notMigrated.rows.forEach(row => {
            console.log(`   - ${row.title} (Project: ${row.project_code})`);
        });
        if (parseInt(ctStats.not_migrated) > 5) {
            console.log(`   ... y ${parseInt(ctStats.not_migrated) - 5} más`);
        }
        console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Recomendaciones
    if (parseInt(aStats.not_migrated) > 0 || parseInt(ctStats.not_migrated) > 0) {
        console.log('💡 RECOMENDACIONES:');
        console.log('   1. Revisar los registros no migrados');
        console.log('   2. Crear jira_tasks para los projects faltantes');
        console.log('   3. O decidir si eliminar esos registros');
        console.log('');
    }
    
    console.log('📝 PRÓXIMOS PASOS:');
    console.log('   1. Actualizar las lambdas del backend (Fase 2)');
    console.log('   2. Actualizar los componentes del frontend (Fase 3)');
    console.log('   3. Realizar pruebas exhaustivas');
    console.log('   4. Una vez verificado, eliminar project_id en una migración futura');
    console.log('');
}

// Ejecutar la migración
runMigration();