import React, { useState, useEffect } from 'react';
import { Competition, Discipline, getSeriesLayout } from '../types';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardAIReportProps {
  competitions: Competition[];
}

const DashboardAIReport: React.FC<DashboardAIReportProps> = ({ competitions }) => {
  const { t } = useLanguage();
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const generateReport = async (signal?: AbortSignal) => {
    // Filtriamo solo le gare (non allenamenti) concluse
    const completedComps = competitions.filter(c => c.discipline !== Discipline.TRAINING && c.totalScore > 0);
    
    if (completedComps.length === 0) {
      setReport(t('no_completed_competitions_for_report'));
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Sessione scaduta');

      // Sort and take last 10 completed competitions
      const lastComps = [...completedComps]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .reverse();
      
      const resultsSummary = lastComps.map(c => {
        const score = c.totalScore || 0;
        const targets = c.totalTargets || 25;
        const layoutObj = getSeriesLayout(c.discipline);
        const tps = layoutObj.layout.reduce((a, b) => a + b, 0);
        const avg = typeof c.averagePerSeries === 'number' ? c.averagePerSeries : (score / (targets / tps));
        return `- ${c.name} (${c.discipline}, ${t('level')}: ${c.level}): ${score}/${targets} (${t('average')}: ${avg.toFixed(1)}) - ${t('position_label')}: ${c.position || 'N/D'}`;
      }).join('\n');

      const prompt = `
        ${t('ai_analyst_role')}
        ${t('ai_analyst_prompt_prefix')}
        ${resultsSummary}
        
        ${t('ai_analyst_prompt_suffix')}
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
        throw new Error(errorData.error || t('report_generation_error'));
      }

      const data = await response.json();

      if (data.text) {
        setReport(data.text);
      } else {
        setError(t('report_generation_error'));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Error generating report:", err);
      setError(err.message || t('generic_generation_error'));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    // Generate report automatically if we have completed competitions, no report yet, and the panel is open
    const completedComps = competitions.filter(c => c.discipline !== Discipline.TRAINING && c.totalScore > 0);
    if (isOpen && completedComps.length > 0 && !report && !loading && !error) {
      generateReport(controller.signal);
    }
    return () => controller.abort();
  }, [competitions, isOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      
      <div className="flex items-center justify-between relative z-10 cursor-pointer" onClick={toggleOpen}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
            <i className="fas fa-robot text-purple-400 text-lg"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{t('ai_report_title')}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('ai_report_subtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isOpen && (
            <button 
              onClick={(e) => { e.stopPropagation(); generateReport(); }}
              disabled={loading}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <><i className="fas fa-circle-notch fa-spin"></i> {t('analyzing_short')}...</>
              ) : (
                <><i className="fas fa-sync-alt"></i> {t('update_label')}</>
              )}
            </button>
          )}
          <button 
            className="text-slate-400 hover:text-white transition-colors p-2"
            aria-label={isOpen ? t('close_report') : t('open_report')}
          >
            <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} transition-transform duration-300`}></i>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="relative z-10 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {error ? (
            <div className="bg-red-950/30 p-4 rounded-xl border border-red-900/50 text-red-400 text-sm flex items-start gap-3">
              <i className="fas fa-exclamation-triangle mt-0.5"></i>
              <p>{error}</p>
            </div>
          ) : loading && !report ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-purple-400 animate-pulse">{t('analyzing_wait')}</p>
            </div>
          ) : report ? (
            <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-purple-400 prose-a:text-purple-400">
              <div className="markdown-body text-slate-300 text-sm leading-relaxed">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/30 p-6 rounded-2xl border border-dashed border-slate-800 text-center">
              <i className="fas fa-chart-line text-slate-600 text-3xl mb-3"></i>
              <p className="text-sm font-bold text-slate-500">{t('insufficient_data')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardAIReport;
