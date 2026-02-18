const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyConfiguration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('🔍 Verificando configuración de estados...\n');
        
        // Obtener configuración de estados
        const [configs] = await connection.query(
            'SELECT * FROM app_config WHERE config_key IN (?, ?) ORDER BY config_key',
            ['project_statuses', 'task_statuses']
        );
        
        if (configs.length === 0) {
            console.log('❌ No se encontró ninguna configuración de estados');
            return;
        }
        
        configs.forEach(config => {
            console.log(`\n📋 ${config.config_key.toUpperCase()}`);
            console.log(`   Descripción: ${config.description}`);
            
            const statuses = JSON.parse(config.config_value);
            console.log(`   Total de estados: ${statuses.length}`);
            console.log(`   Estados:`);
            statuses.forEach((status, index) => {
                console.log(`      ${index + 1}. ${status}`);
            });
        });
        
        // Verificar que ambas configuraciones existen
        const hasProjectStatuses = configs.some(c => c.config_key === 'project_statuses');
        const hasTaskStatuses = configs.some(c => c.config_key === 'task_statuses');
        
        console.log('\n✅ Resumen de verificación:');
        console.log(`   Estados de proyectos: ${hasProjectStatuses ? '✓ Configurado' : '✗ No configurado'}`);
        console.log(`   Estados de tareas: ${hasTaskStatuses ? '✓ Configurado' : '✗ No configurado'}`);
        
        if (hasProjectStatuses && hasTaskStatuses) {
            console.log('\n🎉 ¡Configuración completa y correcta!');
        } else {
            console.log('\n⚠️  Faltan configuraciones');
        }
        
    } catch (error) {
        console.error('❌ Error verificando la configuración:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

verifyConfiguration()
    .then(() => {
        console.log('\n✨ Verificación completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Error fatal:', error);
        process.exit(1);
    });