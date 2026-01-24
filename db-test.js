import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ISBAR',
  password: '1954',
  port: 1212,
});

async function testConnection() {
  const client = await pool.connect();
  try {
    // Test connection
    const res = await client.query('SELECT NOW() as current_time');
    console.log('Connected to database at:', res.rows[0].current_time);
    
    // List all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\nTables in ISBAR database:');
    tables.rows.forEach(row => console.log(`- ${row.table_name}`));
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection();
