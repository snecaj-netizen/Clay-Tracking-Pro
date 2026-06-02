import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteDuplicateSociety() {
  try {
    console.log('Attempting to delete duplicate society...');
    const res = await pool.query('DELETE FROM societies WHERE id = 235051');
    console.log('Deleted rows:', res.rowCount);
  } catch (err) {
    console.error('Error deleting society:', err);
  } finally {
    await pool.end();
  }
}

deleteDuplicateSociety();
