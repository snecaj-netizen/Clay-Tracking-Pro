const fs = require('fs');
let code = fs.readFileSync('components/admin/RegionalChampionships.tsx', 'utf-8');

code = code.replace(
  `const rc = rankingData.championship;
    const groupedRankings = rankingData.groupedRankings || {};`,
  `const rc = rankingData.championship;
    const groupedRankings = rankingData.groupedRankings || {};
    const trialsCountUI = [rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length;
    const requiredTrialsUI = rc.min_trials && rc.min_trials > 0 ? rc.min_trials : (trialsCountUI === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3));`
);

fs.writeFileSync('components/admin/RegionalChampionships.tsx', code);
