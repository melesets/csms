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
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database!');
    
    // Test a simple query
    const result = await client.query('SELECT 1 as test');
    console.log('Test query result:', result.rows[0]);
    
    // Check if users table exists
    try {
      const users = await client.query('SELECT * FROM users LIMIT 1');
      console.log('Users table exists with', users.rowCount, 'rows');
    } catch (err) {
      console.log('Error querying users table:', err.message);
    }
    
    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
