import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE regional_championships ADD COLUMN min_trials INTEGER DEFAULT 0;').then(() => console.log("Added min_trials")).catch(console.error).finally(() => pool.end());
