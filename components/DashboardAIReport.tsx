import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Competition, Discipline, getSeriesLayout } from '../types';
import ReactMarkdown from 'react-markdown';

interface DashboardAIReportProps {
  competitions: Competition[];
}

const DashboardAIReport: React.FC<DashboardAIReportProps> = ({ competitions }) => {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const checkAndOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        setNeedsKey(false);
        generateReport();
      } catch (err) {
        console.error("Error opening key selector:", err);
      }
    } else {
      alert("Il selettore di chiavi API è disponibile solo nell'ambiente AI Studio.");
    }
  };

  const generateReport = async (signal?: AbortSignal) => {
    // Filtriamo solo le gare (non allenamenti) concluse
    const completedComps = competitions.filter(c => c.discipline !== Discipline.TRAINING && c.totalScore > 0);
    
    if (completedComps.length === 0) {
      setReport("Non ci sono gare concluse sufficienti per generare un report. Registra i risultati delle tue gare per ottenere un'analisi.");
      return;
    }

    setLoading(true);
    setNeedsKey(false);
    setError(null);
    
    try {
      let apiKey = '';
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const res = await fetch('/api/gemini-key', {
            headers: { 'Authorization': `Bearer ${token}` },
            signal
          });
          if (res.ok) {
            const data = await res.json();
            apiKey = data.key;
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.error("Failed to fetch API key from server", e);
      }

      if (signal?.aborted) return;

      if (!apiKey) {
        const rawKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
        apiKey = typeof rawKey === 'string' ? rawKey.trim() : rawKey;
      } else {
        apiKey = apiKey.trim();
      }
      
      if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        setNeedsKey(true);
        setLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
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
        return `- ${c.name} (${c.discipline}, Livello: ${c.level}): ${score}/${targets} (Media: ${avg.toFixed(1)}) - Posizione: ${c.position || 'N/D'}`;
      }).join('\n');

      const prompt = `
        Agisci come un analista sportivo esperto di Tiro a Volo.
        Analizza le prestazioni del tiratore basandoti su queste ultime gare concluse:
        ${resultsSummary}
        
        Crea un breve report (massimo 3-4 paragrafi) che includa:
        1. Un'analisi generale del trend di rendimento.
        2. Punti di forza evidenziati dai risultati.
        3. Aree di miglioramento suggerite.
        
        Usa un tono professionale, analitico ma incoraggiante. Formatta la risposta in Markdown, usando grassetti per evidenziare i concetti chiave.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (signal?.aborted) return;

      if (response.text) {
        setReport(response.text);
      } else {
        setError("Impossibile generare il report al momento.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Error generating report:", err);
      if (err.message && err.message.includes("API key not valid")) {
        setNeedsKey(true);
      } else {
        setError("Si è verificato un errore durante la generazione del report.");
      }
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
    if (isOpen && completedComps.length > 0 && !report && !loading && !needsKey && !error) {
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
            <h3 className="text-sm font-black text-white uppercase tracking-wider">AI Performance Report</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Analisi Gare Concluse</p>
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
                <><i className="fas fa-circle-notch fa-spin"></i> Analisi...</>
              ) : (
                <><i className="fas fa-sync-alt"></i> Aggiorna</>
              )}
            </button>
          )}
          <button 
            className="text-slate-400 hover:text-white transition-colors p-2"
            aria-label={isOpen ? "Chiudi report" : "Apri report"}
          >
            <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} transition-transform duration-300`}></i>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="relative z-10 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {needsKey ? (
            <div className="bg-slate-950/50 p-6 rounded-2xl border border-orange-500/30 text-center">
              <i className="fas fa-key text-orange-500 text-3xl mb-3"></i>
              <h4 className="text-white font-bold mb-2">Chiave API Richiesta</h4>
              <p className="text-sm text-slate-400 mb-4">
                Per generare il report AI è necessaria una chiave API Gemini valida.
              </p>
              <button 
                onClick={checkAndOpenKeySelector}
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg active:scale-95 text-sm"
              >
                Seleziona Chiave API
              </button>
            </div>
          ) : error ? (
            <div className="bg-red-950/30 p-4 rounded-xl border border-red-900/50 text-red-400 text-sm flex items-start gap-3">
              <i className="fas fa-exclamation-triangle mt-0.5"></i>
              <p>{error}</p>
            </div>
          ) : loading && !report ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-purple-400 animate-pulse">L'IA sta analizzando le tue prestazioni...</p>
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
              <p className="text-sm font-bold text-slate-500">Nessun dato sufficiente per l'analisi.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardAIReport;
