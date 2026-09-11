const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// The logic needs to calculate the minimum trials.
// If rc.min_trials is set and > 0, we use it.
// If it is 0, we can use the old logic (season Invernale = 2, otherwise 3) OR if configured trials == 1, then 1.
// Let's create a robust check:
const replacementLogic = `
      const configuredTrialsCount = [rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length;
      let requiredTrials = rc.min_trials && rc.min_trials > 0 ? rc.min_trials : 
                           (configuredTrialsCount === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3));
      const isClassified = participatedCount >= requiredTrials;
`;

code = code.replace(
  `const isClassified = participatedCount >= (rc.season === 'Invernale' ? 2 : 3);`,
  replacementLogic
);
code = code.replace(
  `const isClassified = participatedCount >= (rc.season === 'Invernale' ? 2 : 3);`,
  replacementLogic
);

// We also need to fix the 'discardedTrialIdx' logic which checks 'if ((rc.season === 'Invernale' && participatedCount === 3) || participatedCount === 4)'
// The discarded trial logic should apply if participatedCount > requiredTrials.
// It discards the worst score (highest penalties).
// Actually, it usually discards just ONE worst score if they participated in more than the required amount.
// Wait, the current logic is: "if ((rc.season === 'Invernale' && participatedCount === 3) || participatedCount === 4) {"
// This effectively means "if (participatedCount === requiredTrials + 1)".
// Let's replace it with: "if (participatedCount > requiredTrials && requiredTrials > 0) {"

code = code.replace(
  `if ((rc.season === 'Invernale' && participatedCount === 3) || participatedCount === 4) {`,
  `if (participatedCount > requiredTrials && requiredTrials > 0) {`
);
code = code.replace(
  `if ((rc.season === 'Invernale' && participatedCount === 3) || participatedCount === 4) {`,
  `if (participatedCount > requiredTrials && requiredTrials > 0) {`
);

fs.writeFileSync('server.ts', code);
