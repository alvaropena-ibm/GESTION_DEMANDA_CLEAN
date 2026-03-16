/**
 * Script para migrar projects a jira_tasks
 * 
 * Este script crea registros en jira_tasks para todos los projects que no tienen
 * un jira_task equivalente, permitiendo así que la migración de assignments y
 * concept_tasks funcione correctamente.
 * 
 * Uso:
 *   node backend/prisma/migrations/migrate_projects_to_jira_tasks.js
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configuración de la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com') ? {
        rejectUnauthorized: false
    } : false
});

async function migrateProjectsToJiraTasks() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Iniciando migración de projects a jira_tasks...\n');
        
        // Obtener projects que NO tienen jira_task equivalente
        const projectsWithoutJiraTask = await client.query(`
            SELECT p.*
            FROM projects p
            WHERE NOT EXISTS (
                SELECT 1 FROM jira_tasks jt 
                WHERE jt.code = p.code AND jt.team = p.team
            )
            ORDER BY p.code
        `);
        
        console.log(`📊 Encontrados ${projectsWithoutJiraTask.rows.length} projects sin jira_task equivalente\n`);
        
        if (projectsWithoutJiraTask.rows.length === 0) {
            console.log('✅ Todos los projects ya tienen jira_task equivalente');
            return;
        }
        
        // Iniciar transacción
        await client.query('BEGIN');
        
        try {
            let created = 0;
            let skipped = 0;
            
            for (const project of projectsWithoutJiraTask.rows) {
                try {
                    // Insertar en jira_tasks
                    await client.query(`
                        INSERT INTO jira_tasks (
                            code, title, description, type, priority,
                            start_date, end_date, status, domain, team,
                            jira_issue_key, jira_url
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                        )
                    `, [
                        project.code,
                        project.title,
                        project.description,
                        project.type,
                        project.priority,
                        project.start_date,
                        project.end_date,
                        project.status,
                        project.domain,
                        project.team,
                        project.jira_project_key, // Se mapea a jira_issue_key
                        project.jira_url
                    ]);
                    
                    created++;
                    console.log(`   ✅ Creado jira_task para: ${project.code} - ${project.title}`);
                    
                } catch (error) {
                    skipped++;
                    console.log(`   ⚠️  Omitido ${project.code}: ${error.message}`);
                }
            }
            
            // Commit de la transacción
            await client.query('COMMIT');
            
            console.log('\n═══════════════════════════════════════════════════════════');
            console.log('                  RESUMEN DE MIGRACIÓN                     ');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`Projects procesados:     ${projectsWithoutJiraTask.rows.length}`);
            console.log(`Jira_tasks creados:      ${created}`);
            console.log(`Omitidos (errores):      ${skipped}`);
            console.log('═══════════════════════════════════════════════════════════\n');
            
            console.log('✅ Migración de projects a jira_tasks completada!\n');
            
            // Verificar el resultado
            const totalJiraTasks = await client.query('SELECT COUNT(*) as count FROM jira_tasks');
            console.log(`📊 Total de jira_tasks en la base de datos: ${totalJiraTasks.rows[0].count}\n`);
            
        } catch (error) {
            // Rollback en caso de error
            await client.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar la migración
migrateProjectsToJiraTasks()
    .then(() => {
        console.log('✅ Proceso completado');
        console.log('📝 Ahora puedes ejecutar: node backend/prisma/migrations/run_migration_jira_tasks.js');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });