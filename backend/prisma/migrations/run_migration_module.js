const { Client } = require('pg');

const client = new Client({
  host: 'gestion-demanda-db.czuimyk2qu10.eu-west-1.rds.amazonaws.com',
  port: 5432,
  database: 'gestion_demanda',
  user: 'postgres',
  password: 'GestionDemanda2024!',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assignments' 
      AND column_name = 'module';
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('ℹ️  Column "module" already exists in assignments table');
      await client.end();
      return;
    }

    console.log('📝 Adding module column to assignments table...');

    // Add module column
    await client.query(`
      ALTER TABLE assignments 
      ADD COLUMN module VARCHAR(100) NULL;
    `);
    console.log('✅ Column "module" added successfully');

    // Create index
    await client.query(`
      CREATE INDEX idx_assignments_module ON assignments(module);
    `);
    console.log('✅ Index "idx_assignments_module" created successfully');

    // Add comment
    await client.query(`
      COMMENT ON COLUMN assignments.module IS 'Module associated with the assignment (e.g., Frontend, Backend, Database)';
    `);
    console.log('✅ Comment added to column');

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

runMigration();