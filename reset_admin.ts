
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined
});

async function resetAdmin() {
  const email = 'snecaj@gmail.com';
  const password = 'admin';
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  
  try {
    const { rowCount } = await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hash, email]);
    console.log(`Updated ${rowCount} user(s)`);
    
    const { rows } = await pool.query("SELECT email, password FROM users WHERE email = $1", [email]);
    console.log('New hash prefix:', rows[0].password.substring(0, 10));
  } catch (err) {
    console.error('Error resetting admin:', err);
  } finally {
    await pool.end();
  }
}

resetAdmin();
