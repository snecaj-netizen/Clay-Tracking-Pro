const fs = require('fs');
let code = fs.readFileSync('components/Dashboard.tsx', 'utf-8');

code = code.replace(
  `const champInfoRows = [`,
  `const trialsCount = [champ.trial1_event_id, champ.trial2_event_id, champ.trial3_event_id, champ.trial4_event_id].filter(Boolean).length;
      const requiredTrials = champ.min_trials && champ.min_trials > 0 ? champ.min_trials : (trialsCount === 1 ? 1 : (champ.season === 'Invernale' ? 2 : 3));
      const champInfoRows = [`
);

fs.writeFileSync('components/Dashboard.tsx', code);
