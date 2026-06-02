import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSocieties() {
  try {
    console.log('=== INVESTIGATING SOCIETIES ===');
    const { rows: socRows } = await pool.query(`
      SELECT id, name, code, email FROM societies 
      WHERE LOWER(name) LIKE '%la tana%'
    `);
    console.log('Societies found:', socRows);

    console.log('\n=== INVESTIGATING USERS ===');
    const { rows: userRows } = await pool.query(`
      SELECT id, name, surname, email, society FROM users 
      WHERE LOWER(society) LIKE '%la tana%'
    `);
    console.log(`Users with society reference (${userRows.length}):`, userRows);

    console.log('\n=== INVESTIGATING TEAMS ===');
    const { rows: teamRows } = await pool.query(`
      SELECT id, name, society FROM teams 
      WHERE LOWER(society) LIKE '%la tana%'
    `);
    console.log(`Teams with society reference (${teamRows.length}):`, teamRows);

    console.log('\n=== INVESTIGATING EVENTS ===');
    const { rows: eventRows } = await pool.query(`
      SELECT id, name, location FROM events 
      WHERE LOWER(location) LIKE '%la tana%'
    `);
    console.log(`Events with location reference (${eventRows.length}):`, eventRows);

    console.log('\n=== INVESTIGATING COMPETITIONS ===');
    const { rows: compRows } = await pool.query(`
      SELECT id, name, location FROM competitions 
      WHERE LOWER(location) LIKE '%la tana%'
    `);
    console.log(`Competitions with location reference (${compRows.length}):`, compRows);

  } catch (err) {
    console.error('Error checking societies:', err);
  } finally {
    await pool.end();
  }
}

checkSocieties();

