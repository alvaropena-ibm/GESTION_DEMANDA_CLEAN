const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:GestionDemanda2024!@gestion-demanda-db.czuimyk2qu10.eu-west-1.rds.amazonaws.com:5432/gestion_demanda'
});

async function checkResources() {
    try {
        console.log('Checking resources in database...\n');
        
        // Check all teams
        const allTeams = await pool.query('SELECT DISTINCT team FROM resources ORDER BY team');
        console.log('All teams in database:');
        allTeams.rows.forEach(row => console.log(`  - ${row.team}`));
        
        console.log('\n---\n');
        
        // Check DARWIN resources (case-insensitive)
        const darwinResources = await pool.query(
            "SELECT id, name, team FROM resources WHERE UPPER(team) = 'DARWIN' LIMIT 10"
        );
        
        console.log(`Resources with team DARWIN (case-insensitive): ${darwinResources.rows.length}`);
        darwinResources.rows.forEach(row => {
            console.log(`  - ${row.name} (team: "${row.team}")`);
        });
        
        console.log('\n---\n');
        
        // Check darwin resources (lowercase)
        const darwinLower = await pool.query(
            "SELECT id, name, team FROM resources WHERE team = 'darwin' LIMIT 10"
        );
        
        console.log(`Resources with team 'darwin' (exact match): ${darwinLower.rows.length}`);
        darwinLower.rows.forEach(row => {
            console.log(`  - ${row.name} (team: "${row.team}")`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkResources();