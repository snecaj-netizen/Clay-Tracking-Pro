import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSocieties() {
  try {
    const { rows } = await pool.query('SELECT * FROM societies WHERE id IN (596, 235051)');
    console.log('Societies found:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error checking societies:', err);
  } finally {
    await pool.end();
  }
}

checkSocieties();
