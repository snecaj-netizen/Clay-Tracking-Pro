import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUsers() {
  try {
    const { rows } = await pool.query('SELECT id, email, role, society FROM users');
    console.log('Users:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();
