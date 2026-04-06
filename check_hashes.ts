
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined
});

async function checkHashes() {
  try {
    const { rows } = await pool.query("SELECT email, password FROM users WHERE email = 'snecaj@gmail.com'");
    if (rows.length > 0) {
      console.log('Email:', rows[0].email);
      console.log('Hash prefix:', rows[0].password.substring(0, 10));
    } else {
      console.log('Admin user not found');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkHashes();
