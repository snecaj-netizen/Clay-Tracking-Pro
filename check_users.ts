
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined
});

async function checkUsers() {
  try {
    const { rows } = await pool.query("SELECT id, email, role, status FROM users");
    console.log('Users in database:', rows);
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();
