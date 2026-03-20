import React, { useState, useEffect } from 'react';
import { Competition, getSeriesLayout } from '../types';

interface SeriesPopupProps {
  competition: Competition;
  seriesIndex: number;
  onClose: () => void;
  onSave: (updatedComp: Competition) => void;
}

const SeriesPopup: React.FC<SeriesPopupProps> = ({ competition, seriesIndex, onClose, onSave }) => {
  const seriesLayoutObj = getSeriesLayout(competition.discipline);
  const targetsPerSeries = seriesLayoutObj.layout.reduce((a, b) => a + b, 0);

  const [score, setScore] = useState<number>(competition.scores[seriesIndex] || 0);
  const [detailedScore, setDetailedScore] = useState<boolean[]>(() => {
    if (competition.detailedScores && competition.detailedScores[seriesIndex] && competition.detailedScores[seriesIndex].length === targetsPerSeries) {
      return [...competition.detailedScores[seriesIndex]];
    } else {
      const initial = Array(targetsPerSeries).fill(false);
      for (let i = 0; i < (competition.scores[seriesIndex] || 0); i++) {
        initial[i] = true;
      }
      return initial;
    }
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleDetailedScoreChange = (targetIdx: number) => {
    const newDetailed = [...detailedScore];
    newDetailed[targetIdx] = !newDetailed[targetIdx];
    setDetailedScore(newDetailed);
    
    // Update total score for this series
    const newTotal = newDetailed.filter(Boolean).length;
    setScore(newTotal);
  };

  const handleScoreChange = (val: string) => {
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0 && num <= targetsPerSeries) {
      setScore(num);
      // Update detailed scores to match the new total (simple fill)
      const newDetailed = Array(targetsPerSeries).fill(false);
      for (let i = 0; i < num; i++) {
        newDetailed[i] = true;
      }
      setDetailedScore(newDetailed);
    } else if (val === '') {
      setScore(0);
      setDetailedScore(Array(targetsPerSeries).fill(false));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedScores = [...competition.scores];
      updatedScores[seriesIndex] = score;

      const updatedDetailedScores = competition.detailedScores ? [...competition.detailedScores] : Array(competition.scores.length).fill([]);
      updatedDetailedScores[seriesIndex] = detailedScore;

      const totalScore = updatedScores.reduce((a, b) => a + b, 0);
      const averagePerSeries = updatedScores.length > 0 ? totalScore / updatedScores.length : 0;

      const updatedComp: Competition = {
        ...competition,
        scores: updatedScores,
        detailedScores: updatedDetailedScores,
        totalScore,
        averagePerSeries
      };

      await onSave(updatedComp);
      onClose();
    } catch (error) {
      console.error("Error saving series:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Serie {seriesIndex + 1}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{competition.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Totale Serie</span>
            <input 
              type="number" 
              min="0" 
              max={targetsPerSeries} 
              value={score} 
              onChange={(e) => handleScoreChange(e.target.value)} 
              onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
              className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-2xl font-black text-white focus:border-orange-600 outline-none transition-all" 
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dettaglio Piattelli</label>
              <div className="h-[1px] flex-1 bg-slate-800"></div>
            </div>
            
            <div className="flex flex-col gap-3">
              {seriesLayoutObj.layout.map((targetCount, pedanaIdx) => {
                const startIndex = seriesLayoutObj.layout.slice(0, pedanaIdx).reduce((a, b) => a + b, 0);
                return (
                  <div key={pedanaIdx} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 w-12 uppercase tracking-widest">{seriesLayoutObj.label} {pedanaIdx + 1}</span>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: targetCount }).map((_, targetOffset) => {
                        const targetIdx = startIndex + targetOffset;
                        const isHit = detailedScore[targetIdx];
                        return (
                          <button
                            key={targetIdx}
                            type="button"
                            onClick={() => handleDetailedScoreChange(targetIdx)}
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all active:scale-90 ${isHit ? 'bg-[#a3e635] border-[#65a30d] shadow-[0_0_10px_rgba(163,230,53,0.2)]' : 'bg-[#ef4444] border-[#b91c1c] shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
                            title={`Piattello ${targetIdx + 1}: ${isHit ? 'Colpito' : 'Mancato'}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/50 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
            >
              Annulla
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
              Salva Serie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeriesPopup;
