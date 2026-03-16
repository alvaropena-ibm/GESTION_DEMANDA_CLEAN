/**
 * Script para hacer backup de las tablas antes de la migración
 * 
 * Este script:
 * 1. Se conecta a la base de datos
 * 2. Hace backup de assignments y concept_tasks
 * 3. Guarda los datos en archivos JSON
 * 
 * Uso:
 *   node backend/prisma/migrations/backup_before_migration.js
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

async function createBackup() {
    const client = await pool.connect();
    
    try {
        console.log('🔒 Iniciando backup de la base de datos...\n');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupDir = path.join(__dirname, 'backups');
        
        // Crear directorio de backups si no existe
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        // Backup de assignments
        console.log('📋 Haciendo backup de assignments...');
        const assignmentsResult = await client.query('SELECT * FROM assignments');
        const assignmentsFile = path.join(backupDir, `assignments_backup_${timestamp}.json`);
        fs.writeFileSync(assignmentsFile, JSON.stringify(assignmentsResult.rows, null, 2));
        console.log(`   ✅ ${assignmentsResult.rows.length} registros guardados en: ${assignmentsFile}`);
        
        // Backup de concept_tasks
        console.log('📝 Haciendo backup de concept_tasks...');
        const conceptTasksResult = await client.query('SELECT * FROM concept_tasks');
        const conceptTasksFile = path.join(backupDir, `concept_tasks_backup_${timestamp}.json`);
        fs.writeFileSync(conceptTasksFile, JSON.stringify(conceptTasksResult.rows, null, 2));
        console.log(`   ✅ ${conceptTasksResult.rows.length} registros guardados en: ${conceptTasksFile}`);
        
        // Backup de projects (por si acaso)
        console.log('📦 Haciendo backup de projects...');
        const projectsResult = await client.query('SELECT * FROM projects');
        const projectsFile = path.join(backupDir, `projects_backup_${timestamp}.json`);
        fs.writeFileSync(projectsFile, JSON.stringify(projectsResult.rows, null, 2));
        console.log(`   ✅ ${projectsResult.rows.length} registros guardados en: ${projectsFile}`);
        
        // Backup de jira_tasks
        console.log('🎫 Haciendo backup de jira_tasks...');
        const jiraTasksResult = await client.query('SELECT * FROM jira_tasks');
        const jiraTasksFile = path.join(backupDir, `jira_tasks_backup_${timestamp}.json`);
        fs.writeFileSync(jiraTasksFile, JSON.stringify(jiraTasksResult.rows, null, 2));
        console.log(`   ✅ ${jiraTasksResult.rows.length} registros guardados en: ${jiraTasksFile}`);
        
        // Crear archivo de metadata del backup
        const metadata = {
            timestamp: new Date().toISOString(),
            database: process.env.DATABASE_URL.split('@')[1]?.split('/')[1] || 'unknown',
            tables: {
                assignments: assignmentsResult.rows.length,
                concept_tasks: conceptTasksResult.rows.length,
                projects: projectsResult.rows.length,
                jira_tasks: jiraTasksResult.rows.length
            },
            files: {
                assignments: assignmentsFile,
                concept_tasks: conceptTasksFile,
                projects: projectsFile,
                jira_tasks: jiraTasksFile
            }
        };
        
        const metadataFile = path.join(backupDir, `backup_metadata_${timestamp}.json`);
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
        
        console.log('\n✅ Backup completado exitosamente!');
        console.log(`📁 Archivos guardados en: ${backupDir}`);
        console.log(`📊 Metadata: ${metadataFile}\n`);
        
        // Mostrar resumen
        console.log('═══════════════════════════════════════════════════════════');
        console.log('                    RESUMEN DEL BACKUP                     ');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Fecha:              ${metadata.timestamp}`);
        console.log(`Base de datos:      ${metadata.database}`);
        console.log(`Assignments:        ${metadata.tables.assignments} registros`);
        console.log(`Concept_tasks:      ${metadata.tables.concept_tasks} registros`);
        console.log(`Projects:           ${metadata.tables.projects} registros`);
        console.log(`Jira_tasks:         ${metadata.tables.jira_tasks} registros`);
        console.log('═══════════════════════════════════════════════════════════\n');
        
        return metadata;
        
    } catch (error) {
        console.error('❌ Error durante el backup:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar el backup
createBackup()
    .then(() => {
        console.log('✅ Proceso de backup finalizado correctamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error en el proceso de backup:', error);
        process.exit(1);
    });