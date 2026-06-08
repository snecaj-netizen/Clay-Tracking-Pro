
import React, { useState } from 'react';
import { Competition, Discipline, getSeriesLayout } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface GeminiCoachProps {
  competitions: Competition[];
}

const GeminiCoach: React.FC<GeminiCoachProps> = ({ competitions }) => {
  const { t } = useLanguage();
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCoachAdvice = async (signal?: AbortSignal) => {
    // Includiamo sia le gare concluse che quelle future/in corso
    const relevantComps = competitions.filter(c => c.totalTargets > 0);
    
    if (relevantComps.length === 0) {
      setAdvice(t('ai_coach_no_comps_error'));
      return;
    }

    setLoading(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Sessione scaduta');
      
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Sort and take last 8 sessions (mix of past and future)
      const lastEight = [...relevantComps]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
        .reverse();
      
      const resultsSummary = lastEight.map(c => {
        const score = c.totalScore || 0;
        const targets = c.totalTargets || 25;
        const isUpcoming = new Date(c.date) >= now || (c.totalScore === 0 && c.totalTargets > 0);
        const status = isUpcoming ? t('upcoming_tag') : t('concluded_tag');
        
        if (isUpcoming) {
          return `- ${status} ${c.date}: ${c.name} (${c.discipline}), Obiettivo: ${targets} piattelli.`;
        }

        const layoutObj = getSeriesLayout(c.discipline as Discipline);
        const tps = layoutObj.layout.reduce((a, b) => a + b, 0);
        const avg = typeof c.averagePerSeries === 'number' ? c.averagePerSeries : (score / (targets / tps));
        return `- ${status} ${c.date}: ${c.name} (${c.discipline}): ${score}/${targets} (Media: ${avg.toFixed(1)})`;
      }).join('\n');

      const prompt = `
        ${t('ai_coach_role')}
        Data odierna: ${todayStr}

        ${t('ai_coach_prompt_prefix')}
        ${resultsSummary}
        
        ${t('ai_coach_disciplines_note')}
        
        Fornisci 3 consigli tecnici brevi e motivazionali:
        ${t('ai_coach_instruction_1')}
        ${t('ai_coach_instruction_2')}
        ${t('ai_coach_instruction_3')}

        ${t('ai_coach_format_note')}
      `;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('ai_coach_generic_error'));
      }

      const data = await response.json();
      const text = data.text;
      if (!text) {
        throw new Error(t('ai_coach_no_response_error'));
      }
      
      setAdvice(text);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Gemini Coach Error Details:", error);
      setAdvice(`${t('error_label')}: ${error.message || t('connection_failed')}`);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-orange-900/30 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 text-orange-600/10 text-9xl transition-transform group-hover:scale-110 duration-1000">
        <i className="fas fa-user-tie"></i>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-600/40">
            <i className="fas fa-robot"></i>
          </div>
          <h3 className="text-xl font-black text-white tracking-tight uppercase">{t('ai_coach_title')}</h3>
        </div>

        {advice ? (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="prose prose-invert prose-orange max-w-none text-slate-300 whitespace-pre-line text-sm leading-relaxed">
              {advice}
            </div>
            <button 
              onClick={() => setAdvice(null)}
              className="text-orange-500 text-xs font-bold uppercase tracking-widest hover:text-orange-400 transition-colors"
            >
              {t('ai_coach_refresh')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-slate-400 text-sm max-w-md">
              {t('ai_coach_desc')}
            </p>
            <button 
              onClick={() => getCoachAdvice()}
              disabled={loading}
              className="bg-white hover:bg-orange-50 text-slate-950 font-black py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> {t('ai_coach_loading')}
                </>
              ) : (
                <>
                  {t('ai_coach_btn')} <i className="fas fa-arrow-right"></i>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeminiCoach;
