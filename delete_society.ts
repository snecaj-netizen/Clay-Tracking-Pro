import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteDuplicateSociety() {
  try {
    console.log('Starting safe merging of "Tav La Tana Del Lupo" (capital D) into "Tav La Tana del Lupo" (lowercase d)...');
    
    // 1. Update users
    const userUpdate = await pool.query(`
      UPDATE users 
      SET society = 'Tav La Tana del Lupo' 
      WHERE TRIM(society) = 'Tav La Tana Del Lupo'
    `);
    console.log(`Updated users references: ${userUpdate.rowCount}`);

    // 2. Update teams
    const teamUpdate = await pool.query(`
      UPDATE teams 
      SET society = 'Tav La Tana del Lupo' 
      WHERE TRIM(society) = 'Tav La Tana Del Lupo'
    `);
    console.log(`Updated teams references: ${teamUpdate.rowCount}`);

    // 3. Update events
    const eventUpdate = await pool.query(`
      UPDATE events 
      SET location = 'Tav La Tana del Lupo' 
      WHERE TRIM(location) = 'Tav La Tana Del Lupo'
    `);
    console.log(`Updated events references: ${eventUpdate.rowCount}`);

    // 4. Update competitions
    const compUpdate = await pool.query(`
      UPDATE competitions 
      SET location = 'Tav La Tana del Lupo' 
      WHERE TRIM(location) = 'Tav La Tana Del Lupo'
    `);
    console.log(`Updated competitions references: ${compUpdate.rowCount}`);

    // 5. Delete duplicate society
    const societyDelete = await pool.query(`
      DELETE FROM societies 
      WHERE name = 'Tav La Tana Del Lupo'
    `);
    console.log(`Deleted duplicate societies rows: ${societyDelete.rowCount}`);

    console.log('Society consolidation completed successfully!');
  } catch (err) {
    console.error('Error standardizing and deleting duplicate society:', err);
  } finally {
    await pool.end();
  }
}

deleteDuplicateSociety();

