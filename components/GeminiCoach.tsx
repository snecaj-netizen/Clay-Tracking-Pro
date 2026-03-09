
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Competition } from '../types';

interface GeminiCoachProps {
  competitions: Competition[];
}

const GeminiCoach: React.FC<GeminiCoachProps> = ({ competitions }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);

  const checkAndOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        setNeedsKey(false);
        // After selection, we try to get advice again
        getCoachAdvice();
      } catch (err) {
        console.error("Error opening key selector:", err);
      }
    } else {
      alert("Il selettore di chiavi API è disponibile solo nell'ambiente AI Studio.");
    }
  };

  const getCoachAdvice = async () => {
    // Filtriamo solo le sessioni concluse per l'analisi
    const completedOnes = competitions.filter(c => c.totalScore > 0);
    
    if (completedOnes.length === 0) {
      setAdvice("Ho bisogno di almeno un risultato salvato per poterti dare dei consigli tecnici.");
      return;
    }

    setLoading(true);
    setNeedsKey(false);
    
    try {
      // Access API key from server first, fallback to env variables
      let apiKey = '';
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const res = await fetch('/api/gemini-key', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            apiKey = data.key;
          }
        }
      } catch (e) {
        console.error("Failed to fetch API key from server", e);
      }

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
      
      // Sort and take last 5 completed sessions
      const lastFive = [...completedOnes]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .reverse();
      
      const resultsSummary = lastFive.map(c => {
        const score = c.totalScore || 0;
        const targets = c.totalTargets || 25;
        const avg = typeof c.averagePerSeries === 'number' ? c.averagePerSeries : (score / (targets / 25));
        return `- ${c.name} (${c.discipline}): ${score}/${targets} (Media: ${avg.toFixed(1)})`;
      }).join('\n');

      const prompt = `
        Agisci come un coach esperto internazionale di Tiro a Volo (Sporting e Compak).
        Analizza i miei ultimi risultati reali:
        ${resultsSummary}
        
        Considerando che le discipline sono CK (Compak), SP (Sporting), ES (English Sporting) e PC (Percorso Caccia).
        Fornisci 3 consigli tecnici brevi e motivazionali in italiano per migliorare la mia media. 
        Sii specifico ma conciso. Usa un tono professionale e incoraggiante.
        Formatta la risposta con punti elenco.
      `;

      // Using gemini-3-flash-preview as per guidelines
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const text = response.text;
      if (!text) {
        throw new Error("Il coach non ha restituito alcun consiglio. Riprova.");
      }
      
      setAdvice(text);
    } catch (error: any) {
      console.error("Gemini Coach Error Details:", error);
      let userMessage = "Impossibile connettersi al coach AI al momento.";
      
      if (error.message?.includes("API Key")) {
        userMessage = "Errore di configurazione: Chiave API mancante.";
      } else if (error.message?.includes("model")) {
        userMessage = "Il modello AI non è al momento disponibile.";
      } else {
        userMessage = `Errore: ${error.message || "Connessione fallita."}`;
      }
      
      setAdvice(userMessage);
    } finally {
      setLoading(false);
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
          <h3 className="text-xl font-black text-white tracking-tight uppercase">Analisi Coach AI</h3>
        </div>

        {needsKey ? (
          <div className="flex flex-col items-start gap-4 animate-in fade-in duration-500">
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl">
              <p className="text-orange-200 text-xs font-bold mb-1 uppercase tracking-tight">Configurazione Richiesta</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Per usare il Coach AI fuori dall'editor, è necessario selezionare una chiave API valida (progetto Google Cloud a pagamento).
              </p>
            </div>
            <button 
              onClick={checkAndOpenKeySelector}
              className="bg-orange-600 hover:bg-orange-500 text-white font-black py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <i className="fas fa-key"></i> CONFIGURA COACH AI
            </button>
          </div>
        ) : advice ? (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="prose prose-invert prose-orange max-w-none text-slate-300 whitespace-pre-line text-sm leading-relaxed">
              {advice}
            </div>
            <button 
              onClick={() => setAdvice(null)}
              className="text-orange-500 text-xs font-bold uppercase tracking-widest hover:text-orange-400 transition-colors"
            >
              Aggiorna Analisi
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-slate-400 text-sm max-w-md">
              Il Coach Gemini analizzerà i tuoi ultimi 5 risultati reali per identificare trend e fornirti suggerimenti tecnici personalizzati.
            </p>
            <button 
              onClick={getCoachAdvice}
              disabled={loading}
              className="bg-white hover:bg-orange-50 text-slate-950 font-black py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> ANALISI IN CORSO...
                </>
              ) : (
                <>
                  CHIEDI AL COACH <i className="fas fa-arrow-right"></i>
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
