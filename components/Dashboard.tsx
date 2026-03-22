
import React, { useState } from 'react';
import { Competition, Discipline } from '../types';
import StatsCharts from './StatsCharts';
import ShareCard from './ShareCard';

interface DashboardProps {
  competitions: Competition[];
  onAddClick: () => void;
  onCoachClick: () => void;
  user?: any;
}

const Dashboard: React.FC<DashboardProps> = ({ competitions, onAddClick, onCoachClick, user }) => {
  const [shareData, setShareData] = useState<{ comp: Competition, isPerfect?: boolean } | null>(null);
  
  // Filtriamo solo le gare REALI (punteggio > 0) per le statistiche
  const upcomingCompetitions = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    return competitions
      .filter(c => {
        const compDate = new Date(c.date);
        compDate.setHours(0, 0, 0, 0);
        // Upcoming if date is today or future AND totalScore is 0 (not yet completed)
        return compDate >= now && c.totalScore === 0;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [competitions]);

  const compStats = React.useMemo(() => {
    const gare = competitions.filter(c => c.discipline !== Discipline.TRAINING && c.totalScore > 0);
    if (gare.length === 0) return null;

    const totalHits = gare.reduce((acc, c) => acc + c.totalScore, 0);
    const totalCompletedSeries = gare.reduce((acc, c) => acc + c.scores.filter(s => s > 0).length, 0);
    const avg = totalCompletedSeries > 0 ? (totalHits / totalCompletedSeries) : 0;
    
    const gareWithPosition = gare.filter(c => c.position && c.position > 0);
    let bestPlacementComp = null;
    
    if (gareWithPosition.length > 0) {
      bestPlacementComp = gareWithPosition.reduce((best, current) => {
        if (!best) return current;
        if (current.position! < best.position!) return current;
        if (current.position === best.position) {
          return current.totalScore > best.totalScore ? current : best;
        }
        return best;
      }, null as Competition | null);
    }
    
    return { count: gare.length, avg, bestPlacementComp };
  }, [competitions]);

  const trainingStats = React.useMemo(() => {
    const allenamenti = competitions.filter(c => c.discipline === Discipline.TRAINING && c.totalScore > 0);
    if (allenamenti.length === 0) return null;

    const totalHits = allenamenti.reduce((acc, c) => acc + c.totalScore, 0);
    const totalCompletedSeries = allenamenti.reduce((acc, c) => acc + c.scores.filter(s => s > 0).length, 0);
    const avg = totalCompletedSeries > 0 ? (totalHits / totalCompletedSeries) : 0;
    const totalSeries = allenamenti.reduce((acc, c) => acc + c.scores.filter(s => s > 0).length, 0);
    
    return { count: allenamenti.length, avg, totalSeries };
  }, [competitions]);

  const financial = React.useMemo(() => {
    // I costi e le vincite rimangono calcolati su tutto, 
    // assumendo che una gara pianificata possa avere già un costo d'iscrizione
    const totalCost = competitions.reduce((acc, c) => acc + (c.cost || 0), 0);
    const totalWin = competitions.reduce((acc, c) => acc + (c.win || 0), 0);
    return { totalCost, totalWin, balance: totalWin - totalCost };
  }, [competitions]);

  if (competitions.length === 0) {
    return (
      <div className="bg-slate-900 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center">
        <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-bullseye text-3xl text-slate-600"></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {user?.role === 'society' ? `Benvenuta, ${user.name}` : 'Benvenuto, Tiratore'}
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm mx-auto">
          {user?.role === 'society' 
            ? 'I tuoi tiratori non hanno ancora registrato risultati.' 
            : 'Inizia a registrare i tuoi risultati per sbloccare le statistiche avanzate.'}
        </p>
        {user?.role !== 'society' && (
          <button onClick={onAddClick} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg">
            Aggiungi Risultato
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Report Gare (Prestazioni in Gara) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 ml-2">
          <i className="fas fa-trophy text-orange-500"></i>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Prestazioni in Gara</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Gare Concluse</p>
            <h3 className="text-3xl font-black text-white">{compStats?.count || 0}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl border-l-4 border-l-orange-600">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Media Gara /25</p>
            <h3 className="text-3xl font-black text-orange-500">{compStats?.avg.toFixed(2) || '0.00'}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl relative group">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Migliore Posizionamento</p>
            {compStats?.bestPlacementComp ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-3xl font-black text-white">{compStats.bestPlacementComp.position}°</h3>
                    <span className="text-xs font-bold text-slate-400 uppercase">Posto</span>
                  </div>
                  <button 
                    onClick={() => setShareData({ comp: compStats.bestPlacementComp! })}
                    className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                    title="Condividi"
                  >
                    <i className="fas fa-share-alt text-xs"></i>
                  </button>
                </div>
                <div className="mt-1">
                  <p className="text-[10px] font-bold text-orange-500 uppercase truncate" title={compStats.bestPlacementComp.name}>
                    {compStats.bestPlacementComp.name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Media: <span className="text-white font-bold">{compStats.bestPlacementComp.averagePerSeries.toFixed(2)}</span> /25
                  </p>
                </div>
              </div>
            ) : (
              <h3 className="text-3xl font-black text-slate-700">-</h3>
            )}
          </div>
        </div>
      </div>

      {/* 2. Statistiche Allenamento */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 ml-2">
          <i className="fas fa-dumbbell text-blue-500"></i>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Statistiche Allenamento</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl border-l-4 border-l-blue-600">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Media Pratica /25</p>
            <h3 className="text-3xl font-black text-blue-500">{trainingStats?.avg.toFixed(2) || '0.00'}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Serie Concluse</p>
            <h3 className="text-3xl font-black text-white">{trainingStats?.totalSeries || 0}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Sessioni Finite</p>
            <h3 className="text-3xl font-black text-white">{trainingStats?.count || 0}</h3>
          </div>
        </div>
      </div>

      {/* 3. Grafici Statistici */}
      <StatsCharts competitions={competitions} />

      {/* 4. Bilancio Generale (Bilancio Finanziario) */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 mb-6">
          <i className="fas fa-wallet text-slate-500"></i>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Bilancio Generale</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          <div className="bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-600 min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1 leading-tight">Costi Totali</p>
            <p className="text-xs sm:text-xl font-black text-red-500 break-words">€{financial.totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-600 min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1 leading-tight">Vincite Gare</p>
            <p className="text-xs sm:text-xl font-black text-green-500 break-words">€{financial.totalWin.toFixed(2)}</p>
          </div>
          <div className="bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-600 min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1 leading-tight">Saldo Netto</p>
            <p className={`text-xs sm:text-xl font-black break-words ${financial.balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
              {financial.balance >= 0 ? '+' : ''}€{financial.balance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Prossimi Appuntamenti */}
      {upcomingCompetitions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <div className="flex items-center gap-2">
              <i className="fas fa-calendar-check text-emerald-500 animate-pulse"></i>
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Prossimi Appuntamenti</h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {upcomingCompetitions.length} {upcomingCompetitions.length === 1 ? 'EVENTO' : 'EVENTI'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingCompetitions.slice(0, 4).map(comp => {
              const d = new Date(comp.date);
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={comp.id} className={`group relative bg-slate-900 p-5 rounded-2xl border ${isToday ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10'} shadow-xl overflow-hidden transition-all hover:border-emerald-500/30`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${comp.discipline === Discipline.TRAINING ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                          {comp.discipline === Discipline.TRAINING ? 'Allenamento' : 'Gara'}
                        </span>
                        {isToday && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Oggi</span>}
                      </div>
                      <h4 className="text-lg font-black text-white leading-tight group-hover:text-emerald-400 transition-colors">{comp.name}</h4>
                      {user?.role === 'society' && comp.userName && (
                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-tighter">
                          Tiratore: {comp.userSurname} {comp.userName}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <i className="fas fa-location-dot text-slate-500"></i>
                        {comp.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{d.getDate()}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{d.toLocaleString('it-IT', { month: 'short' })}</p>
                    </div>
                  </div>
                  {comp.notes && (
                    <p className="mt-3 text-[10px] text-slate-500 italic line-clamp-1 border-t border-slate-800/50 pt-2">
                      "{comp.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Analisi Coach AI - CTA to Full Page */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-xl overflow-hidden relative group cursor-pointer hover:border-orange-600/50 transition-all" onClick={onCoachClick}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-orange-600/20 transition-all"></div>
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="w-20 h-20 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20 shrink-0">
            <i className="fas fa-user-tie text-3xl"></i>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
              {user?.role === 'society' ? 'Hai bisogno di un\'analisi di squadra?' : 'Vuoi migliorare la tua tecnica?'}
            </h3>
            <p className="text-slate-400 text-sm font-medium mb-4">
              {user?.role === 'society' 
                ? 'Il tuo Consulente AI ha analizzato i nuovi dati agonistici. Scopri i trend e ricevi consigli strategici.' 
                : 'Il tuo Coach AI ha analizzato le tue ultime prestazioni. Chiedigli consigli personalizzati o un piano di allenamento.'}
            </p>
            <button className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95">
              Parla con il Coach <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>
      {shareData && (
        <ShareCard
          competition={shareData.comp}
          user={user}
          isPerfectSeries={shareData.isPerfect}
          onClose={() => setShareData(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
