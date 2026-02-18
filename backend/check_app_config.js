const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') ? {
        rejectUnauthorized: false
    } : false
});

async function checkTable() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'app_config' 
            ORDER BY ordinal_position
        `);
        
        console.log('Columns in app_config table:');
        console.log('═══════════════════════════════════');
        result.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
        
        // Also check existing data
        const dataResult = await pool.query('SELECT * FROM app_config LIMIT 3');
        console.log('\nSample data:');
        console.log('═══════════════════════════════════');
        console.log(JSON.stringify(dataResult.rows, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkTable();