const fs = require('fs');
let code = fs.readFileSync('components/admin/RegionalChampionships.tsx', 'utf-8');

code = code.replace(
  `const champInfoRows = [`,
  `const trialsCount = [champ.trial1_event_id, champ.trial2_event_id, champ.trial3_event_id, champ.trial4_event_id].filter(Boolean).length;
        const requiredTrials = champ.min_trials && champ.min_trials > 0 ? champ.min_trials : (trialsCount === 1 ? 1 : (champ.season === 'Invernale' ? 2 : 3));
        const champInfoRows = [`
);

code = code.replace(
  `['Regolamento Campionato:', 'Sono necessarie almeno 3 prove su 4 per il computo finale. Nel caso si effettuino tutte e 4 le prove, la prova peggiore (penalità più alta) viene scartata.'],`,
  `['Regolamento Campionato:', \`Sono necessarie almeno \${requiredTrials} prove su \${trialsCount} per il computo finale. Nel caso si effettuino più di \${requiredTrials} prove, le prove peggiori vengono scartate.\`],`
);

code = code.replace(
  `shootersBodyRows.push([\`⚠️ TESSERATI NON CLASSIFICATI (Meno di 3 prove completate)\`]);`,
  `shootersBodyRows.push([\`⚠️ TESSERATI NON CLASSIFICATI (Meno di \${requiredTrials} prove completate)\`]);`
);

// We need to define requiredTrials for the DOM rendering part.
// Search for: const groupedRankings = rankingData?.groupedRankings || {};
code = code.replace(
  `const groupedRankings = rankingData?.groupedRankings || {};`,
  `const groupedRankings = rankingData?.groupedRankings || {};
    const rc = rankingData?.championship || {};
    const trialsCountUI = [rc.trial1_event_id, rc.trial2_event_id, rc.trial3_event_id, rc.trial4_event_id].filter(Boolean).length;
    const requiredTrialsUI = rc.min_trials && rc.min_trials > 0 ? rc.min_trials : (trialsCountUI === 1 ? 1 : (rc.season === 'Invernale' ? 2 : 3));`
);

code = code.replace(
  `<li>Sono previste 4 prove regionali. Per entrare in classifica finale è necessario disputare <b>almeno 3 prove</b>.</li>
            <li>Se un tiratore effettua tutte e 4 le prove, <b>il peggior punteggio (penalità più alta) viene scartato</b>.</li>`,
  `<li>Sono previste {trialsCountUI} prove regionali. Per entrare in classifica finale è necessario disputare <b>almeno {requiredTrialsUI} {requiredTrialsUI === 1 ? 'prova' : 'prove'}</b>.</li>
            <li>Se un tiratore effettua più delle prove richieste, <b>i punteggi peggiori vengono scartati</b>.</li>`
);

code = code.replace(
  `{s.participatedCount}/3 prove`,
  `{s.participatedCount}/{requiredTrialsUI} prove`
);

code = code.replace(
  `{soc.participatedCount}/3 prove`,
  `{soc.participatedCount}/{requiredTrialsUI} prove`
);

code = code.replace(
  `Tiratori Iscritti in Attesa di Qualificazione (meno di 3 prove):`,
  `Tiratori Iscritti in Attesa di Qualificazione (meno prove di quelle richieste):`
);

fs.writeFileSync('components/admin/RegionalChampionships.tsx', code);
