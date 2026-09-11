const fs = require('fs');
let code = fs.readFileSync('components/Dashboard.tsx', 'utf-8');

const trialsCountVar = `const trialsCount = [rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length;
        const requiredTrials = rc.min_trials && rc.min_trials > 0 ? rc.min_trials : (trialsCount === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3));`;

// Add variables inside generatePDF if they aren't there
code = code.replace(
  `const rc = selectedRegionalRanking.championship;
        const groupedRankings = selectedRegionalRanking.groupedRankings || {};`,
  `const rc = selectedRegionalRanking.championship;
        const groupedRankings = selectedRegionalRanking.groupedRankings || {};
        const trialsCount = [rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length;
        const requiredTrials = rc.min_trials && rc.min_trials > 0 ? rc.min_trials : (trialsCount === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3));`
);

code = code.replace(
  `['Regolamento Campionato:', 'Sono necessarie almeno 3 prove su 4 per il computo finale. Nel caso si effettuino tutte e 4 le prove, la prova peggiore (penalità più alta) viene scartata.'],`,
  `['Regolamento Campionato:', \`Sono necessarie almeno \${requiredTrials} prove su \${trialsCount} per il computo finale. Nel caso si effettuino più di \${requiredTrials} prove, le prove peggiori vengono scartate.\`],`
);

code = code.replace(
  `shootersBodyRows.push([\`⚠️ TESSERATI NON CLASSIFICATI (Meno di 3 prove completate)\`]);`,
  `shootersBodyRows.push([\`⚠️ TESSERATI NON CLASSIFICATI (Meno di \${requiredTrials} prove completate)\`]);`
);

code = code.replace(
  `Devi disputare almeno 3 prove per qualificarti.`,
  `Devi disputare almeno {rc.min_trials || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3))} {rc.min_trials === 1 || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 && !rc.min_trials) ? 'prova' : 'prove'} per qualificarti.`
);

code = code.replace(
  `<li>Sono previste 4 prove regionali. Per entrare in classifica finale è necessario disputare <b>almeno 3 prove</b>.</li>
                      <li>Se un tiratore effettua tutte e 4 le prove, <b>il peggior punteggio (penalità più alta) viene scartato</b>.</li>`,
  `<li>Sono previste {[rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length} prove regionali. Per entrare in classifica finale è necessario disputare <b>almeno {rc.min_trials || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3))} prove</b>.</li>
                      <li>Se un tiratore effettua più delle prove richieste, <b>i punteggi peggiori vengono scartati</b>.</li>`
);

code = code.replace(
  `<li>Come per l'individuale, le società devono disputare <b>almeno 3 prove</b> per qualificarsi al campionato. Qualora partecipino a tutte le 4 prove, viene applicato lo <b>scarto della peggiore prestazione</b> (punteggio più basso o penalità più alta).</li>`,
  `<li>Come per l'individuale, le società devono disputare <b>almeno {rc.min_trials || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3))} prove</b> per qualificarsi al campionato. Qualora partecipino a più prove di quelle minime, viene applicato lo <b>scarto della peggiore prestazione</b>.</li>`
);

code = code.replace(
  `{s.participatedCount}/3 prove`,
  `{s.participatedCount}/{rc.min_trials || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3))} prove`
);

code = code.replace(
  `{soc.participatedCount}/3 prove`,
  `{soc.participatedCount}/{rc.min_trials || ([rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3))} prove`
);

code = code.replace(
  `Tiratori Iscritti in Attesa di Qualificazione (meno di 3 prove):`,
  `Tiratori Iscritti in Attesa di Qualificazione (meno prove di quelle richieste):`
);

fs.writeFileSync('components/Dashboard.tsx', code);
