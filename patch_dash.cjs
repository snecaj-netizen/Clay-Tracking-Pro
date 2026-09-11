const fs = require('fs');
let code = fs.readFileSync('components/Dashboard.tsx', 'utf-8');

code = code.replace(
  `<span>Prove: <b className="text-slate-300 font-bold">{mine.participatedCount}/4</b></span>`,
  `<span>Prove: <b className="text-slate-300 font-bold">{mine.participatedCount}/{[rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length}</b></span>`
);

code = code.replace(
  `Disputa almeno <b>3 prove</b> per qualificarti alla finale.`,
  `Disputa almeno <b>{rc.min_trials || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3))} {rc.min_trials === 1 || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 && !rc.min_trials) ? 'prova' : 'prove'}</b> per qualificarti.`
);

fs.writeFileSync('components/Dashboard.tsx', code);
