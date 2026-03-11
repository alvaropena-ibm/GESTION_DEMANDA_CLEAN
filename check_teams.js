const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:GestionDemanda2024!@gestion-demanda-db.czuimyk2qu10.eu-west-1.rds.amazonaws.com:5432/gestion_demanda'
});

async function checkTeams() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');
        
        // Query 1: Ver todos los valores únicos de team
        console.log('=== VALORES ÚNICOS DE TEAM ===');
        const teamsResult = await client.query(`
            SELECT DISTINCT team, COUNT(*) as count
            FROM projects
            GROUP BY team
            ORDER BY team
        `);
        console.table(teamsResult.rows);
        
        // Query 2: Ver proyectos específicos de Darwin (case-insensitive)
        console.log('\n=== PROYECTOS DARWIN (case-insensitive) ===');
        const darwinResult = await client.query(`
            SELECT code, title, team
            FROM projects
            WHERE UPPER(team) = UPPER('DARWIN')
            LIMIT 5
        `);
        console.table(darwinResult.rows);
        
        // Query 3: Ver todos los proyectos con team que contenga 'dar'
        console.log('\n=== PROYECTOS CON "dar" EN TEAM ===');
        const darResult = await client.query(`
            SELECT code, title, team
            FROM projects
            WHERE LOWER(team) LIKE '%dar%'
            LIMIT 10
        `);
        console.table(darResult.rows);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkTeams();
