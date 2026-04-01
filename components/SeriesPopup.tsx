import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
      const completedSeriesCount = updatedScores.filter(s => s > 0).length || 1;
      const averagePerSeries = totalScore / completedSeriesCount;

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

  return createPortal(
    <div className="fixed inset-0 z-[1050] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 w-full max-w-md sm:max-w-lg md:max-w-xl shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 sm:mb-5">
          <div>
            <h3 className="text-xl sm:text-lg font-black text-white uppercase tracking-tight">Serie {seriesIndex + 1}</h3>
            <p className="text-xs sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{competition.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
            <i className="fas fa-times sm:text-sm"></i>
          </button>
        </div>

        <div className="space-y-6 sm:space-y-5">
          <div className="flex items-center justify-between bg-slate-950/50 p-4 sm:p-3 rounded-2xl sm:rounded-xl border border-slate-800/50">
            <span className="text-xs sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Totale Serie</span>
            <input 
              type="number" 
              min="0" 
              max={targetsPerSeries} 
              value={score} 
              onChange={(e) => handleScoreChange(e.target.value)} 
              onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
              className="w-24 sm:w-20 bg-slate-900 border border-slate-700 rounded-xl sm:rounded-lg px-3 py-2 sm:py-1.5 text-center text-2xl sm:text-xl font-black text-white focus:border-orange-600 outline-none transition-all" 
            />
          </div>

          <div className="space-y-4 sm:space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Dettaglio Piattelli</label>
              <div className="h-[1px] flex-1 bg-slate-800"></div>
            </div>
            
            <div className={`grid grid-cols-1 ${seriesLayoutObj.label === 'Piazzola' ? '' : 'sm:grid-cols-2'} gap-3 sm:gap-4`}>
              {seriesLayoutObj.layout.map((targetCount, pedanaIdx) => {
                const startIndex = seriesLayoutObj.layout.slice(0, pedanaIdx).reduce((a, b) => a + b, 0);
                return (
                  <div key={pedanaIdx} className="flex items-center gap-3 sm:gap-2 bg-slate-950/30 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none border border-slate-800/30 sm:border-none">
                    <span className="text-[10px] sm:text-[9px] font-bold text-slate-500 w-14 sm:w-12 uppercase tracking-widest shrink-0">{seriesLayoutObj.label} {pedanaIdx + 1}</span>
                    <div className="flex flex-nowrap overflow-x-auto custom-scrollbar pb-1 pt-1 gap-2 sm:gap-1.5 w-full">
                      {Array.from({ length: targetCount }).map((_, targetOffset) => {
                        const targetIdx = startIndex + targetOffset;
                        const isHit = detailedScore[targetIdx];
                        return (
                          <div key={targetIdx} className="flex flex-col items-center gap-1 shrink-0">
                            <span className="text-[8px] text-slate-500 font-bold">{targetIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleDetailedScoreChange(targetIdx)}
                              className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full border-2 transition-all active:scale-90 ${isHit ? 'bg-[#a3e635] border-[#65a30d] shadow-[0_0_10px_rgba(163,230,53,0.2)]' : 'bg-[#ef4444] border-[#b91c1c] shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
                              title={`Piattello ${targetIdx + 1}: ${isHit ? 'Colpito' : 'Mancato'}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 sm:pt-3 border-t border-slate-800/50 flex gap-3 sm:gap-2">
            <button 
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 sm:py-2.5 rounded-xl sm:rounded-lg transition-all active:scale-95 text-xs sm:text-[10px] uppercase tracking-widest"
            >
              Annulla
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] bg-orange-600 hover:bg-orange-500 text-white font-black py-4 sm:py-2.5 rounded-xl sm:rounded-lg shadow-lg shadow-orange-600/20 transition-all active:scale-95 text-xs sm:text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
              Salva Serie
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SeriesPopup;
