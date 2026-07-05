import { Client } from 'pg';

async function diagnose() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
  });
  await client.connect();
  
  const ids = [
    'a9a95774-91ff-40d3-bda9-97912a1dc17b',
    '46dcf6f9-c6d1-47a3-a6fb-ab5ca829e0be',
    '2e8edda7-e7b8-48f7-a20f-7d535e264dd6',
    'b5fff567-58e0-4ac3-89b0-f76928cfe0d6'
  ];

  console.log('=== DETAILED EVENTS DATA ===');
  for (const id of ids) {
    const res = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log(`NOT FOUND: ${id}`);
    }
  }

  await client.end();
}

diagnose().catch(console.error);
