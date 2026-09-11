const fs = require('fs');
let code = fs.readFileSync('components/admin/RegionalChampionships.tsx', 'utf-8');

code = code.replace(
  `setFormDiscipline(Discipline.FO);`,
  `setFormDiscipline(Discipline.FO);\n    setFormMinTrials(0);`
);

code = code.replace(
  `setFormDiscipline(rc.discipline);`,
  `setFormDiscipline(rc.discipline);\n    setFormMinTrials(rc.min_trials || 0);`
);

code = code.replace(
  `discipline: formDiscipline,`,
  `discipline: formDiscipline,\n      min_trials: formMinTrials,`
);

// Add the form input for min_trials after discipline.
const disciplineInputHtml = `<div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Disciplina</label>
                  <select 
                    value={formDiscipline}
                    onChange={(e) => setFormDiscipline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>`;

const newInputs = disciplineInputHtml + `
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block" title="Lascia 0 per default o prova unica">N. Prove Minime per Qualificazione</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0 (Automatico)"
                    value={formMinTrials === 0 ? '' : formMinTrials}
                    onChange={(e) => setFormMinTrials(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>`;

code = code.replace(disciplineInputHtml, newInputs);

fs.writeFileSync('components/admin/RegionalChampionships.tsx', code);
