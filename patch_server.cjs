const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Update INSERT
code = code.replace(
  `const { id, name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id } = req.body;`,
  `const { id, name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id, min_trials } = req.body;`
);

code = code.replace(
  `INSERT INTO regional_championships (id, name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id)`,
  `INSERT INTO regional_championships (id, name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id, min_trials)`
);

code = code.replace(
  `VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)\`,
      [rcId, name, parseInt(year) || new Date().getFullYear(), season, region, discipline, trial1_name || null, trial1_event_id || null, trial2_name || null, trial2_event_id || null, trial3_name || null, trial3_event_id || null, trial4_name || null, trial4_event_id || null]`,
  `VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)\`,
      [rcId, name, parseInt(year) || new Date().getFullYear(), season, region, discipline, trial1_name || null, trial1_event_id || null, trial2_name || null, trial2_event_id || null, trial3_name || null, trial3_event_id || null, trial4_name || null, trial4_event_id || null, parseInt(min_trials) || 0]`
);

// Update UPDATE
code = code.replace(
  `const { name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id } = req.body;
    await pool.query(
      \`UPDATE regional_championships 
       SET name=$1, year=$2, season=$3, region=$4, discipline=$5, 
           trial1_name=$6, trial1_event_id=$7, 
           trial2_name=$8, trial2_event_id=$9, 
           trial3_name=$10, trial3_event_id=$11, 
           trial4_name=$12, trial4_event_id=$13`,
  `const { name, year, season, region, discipline, trial1_name, trial1_event_id, trial2_name, trial2_event_id, trial3_name, trial3_event_id, trial4_name, trial4_event_id, min_trials } = req.body;
    await pool.query(
      \`UPDATE regional_championships 
       SET name=$1, year=$2, season=$3, region=$4, discipline=$5, 
           trial1_name=$6, trial1_event_id=$7, 
           trial2_name=$8, trial2_event_id=$9, 
           trial3_name=$10, trial3_event_id=$11, 
           trial4_name=$12, trial4_event_id=$13,
           min_trials=$15`
);

code = code.replace(
  `[name, parseInt(year) || new Date().getFullYear(), season, region, discipline, trial1_name || null, trial1_event_id || null, trial2_name || null, trial2_event_id || null, trial3_name || null, trial3_event_id || null, trial4_name || null, trial4_event_id || null, req.params.id]`,
  `[name, parseInt(year) || new Date().getFullYear(), season, region, discipline, trial1_name || null, trial1_event_id || null, trial2_name || null, trial2_event_id || null, trial3_name || null, trial3_event_id || null, trial4_name || null, trial4_event_id || null, req.params.id, parseInt(min_trials) || 0]`
);

fs.writeFileSync('server.ts', code);
