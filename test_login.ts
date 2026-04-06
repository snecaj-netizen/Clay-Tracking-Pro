
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined
});

async function testLogin() {
  const email = 'snecaj@gmail.com';
  const password = 'admin';
  
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user) {
      console.log('User not found');
      return;
    }
    
    const validPassword = bcrypt.compareSync(password, user.password);
    console.log('Password valid:', validPassword);
    
    if (validPassword) {
      console.log('Login successful for', email);
    } else {
      console.log('Login failed for', email);
    }
  } catch (err) {
    console.error('Error during test login:', err);
  } finally {
    await pool.end();
  }
}

testLogin();
