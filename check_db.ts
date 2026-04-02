import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEvents() {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM events');
    console.log('Total events:', rows[0].count);
    const { rows: sample } = await pool.query('SELECT id, name, location, created_by, visibility FROM events LIMIT 5');
    console.log('Sample events:', JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error('Error checking events:', err);
  } finally {
    await pool.end();
  }
}

checkEvents();
