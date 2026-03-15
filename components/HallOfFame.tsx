import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Discipline, Challenge, ChallengeMode, ChallengeRankingEntry } from '../types';

interface HallOfFameProps {
  user: any;
  token: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
}

const HallOfFame: React.FC<HallOfFameProps> = ({ user, token, triggerConfirm }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [ranking, setRanking] = useState<ChallengeRankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingCategory, setRankingCategory] = useState<string>('Tutte');
  const [rankingQualification, setRankingQualification] = useState<string>('Tutte');

  // Form state
  const [name, setName] = useState('');
  const [societyId, setSocietyId] = useState<number | ''>('');
  const [discipline, setDiscipline] = useState<Discipline>(Discipline.FO);
  const [mode, setMode] = useState<ChallengeMode>(ChallengeMode.BEST_SCORE);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [prize, setPrize] = useState('');

  useEffect(() => {
    fetchChallenges();
    fetchSocieties();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setChallenges(data);
    } catch (err) {
      console.error('Error fetching challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocieties = async () => {
    try {
      const res = await fetch('/api/societies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSocieties(data);
    } catch (err) {
      console.error('Error fetching societies:', err);
    }
  };

  const fetchRanking = async (challengeId: string) => {
    setRankingLoading(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ranking`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRanking(data);
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setRankingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!societyId || !name || !endDate || !prize) return;

    try {
      const endpoint = editingChallenge ? `/api/admin/challenges/${editingChallenge.id}` : '/api/admin/challenges';
      const method = editingChallenge ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          societyId,
          name,
          discipline,
          mode,
          startDate,
          endDate,
          prize
        })
      });

      if (res.ok) {
        setShowForm(false);
        setEditingChallenge(null);
        resetForm();
        fetchChallenges();
      }
    } catch (err) {
      console.error('Error saving challenge:', err);
    }
  };

  const handleEdit = (c: Challenge) => {
    setEditingChallenge(c);
    setName(c.name);
    setSocietyId(c.societyId);
    setDiscipline(c.discipline);
    setMode(c.mode);
    setStartDate(c.startDate);
    setEndDate(c.endDate);
    setPrize(c.prize);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    triggerConfirm(
      'Elimina Sfida',
      'Sei sicuro di voler eliminare questa sfida? Questa azione non può essere annullata.',
      async () => {
        try {
          const res = await fetch(`/api/admin/challenges/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) fetchChallenges();
        } catch (err) {
          console.error('Error deleting challenge:', err);
        }
      },
      'Elimina',
      'danger'
    );
  };

  const resetForm = () => {
    setName('');
    setSocietyId('');
    setDiscipline(Discipline.FO);
    setMode(ChallengeMode.BEST_SCORE);
    setStartDate('');
    setEndDate('');
    setPrize('');
    setEditingChallenge(null);
  };

  const categories = ['Tutte', ...Array.from(new Set(ranking.map(r => r.category)))].filter(c => c !== 'N/D');
  const qualifications = ['Tutte', ...Array.from(new Set(ranking.map(r => r.qualification)))].filter(q => q !== 'N/D');
  
  const filteredRanking = ranking.filter(r => {
    const matchCat = rankingCategory === 'Tutte' || r.category === rankingCategory;
    const matchQual = rankingQualification === 'Tutte' || r.qualification === rankingQualification;
    return matchCat && matchQual;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">
            <i className="fas fa-trophy text-orange-500 mr-2"></i> Hall of Fame
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Sfide e Contest tra Tiratori</p>
        </div>
        {user?.role === 'admin' && (
          <button 
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${showForm ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20'}`}
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'}`}></i>
            {showForm ? 'Annulla' : 'Crea Sfida'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-6 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <i className="fas fa-edit text-orange-500"></i> {editingChallenge ? 'Modifica Sfida' : 'Dettagli Nuova Sfida'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società Ospitante *</label>
              <select 
                required
                value={societyId}
                onChange={(e) => setSocietyId(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all appearance-none"
              >
                <option value="">Seleziona Società</option>
                {societies.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Sfida *</label>
              <input 
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es: Trofeo d'Estate"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina *</label>
              <select 
                required
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as Discipline)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all appearance-none"
              >
                {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Modalità Classifica *</label>
              <select 
                required
                value={mode}
                onChange={(e) => setMode(e.target.value as ChallengeMode)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all appearance-none"
              >
                {Object.values(ChallengeMode).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Inizio</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Fine *</label>
              <input 
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Premio in Palio *</label>
              <input 
                required
                type="text"
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder="Es: 500 Cartucce + Trofeo"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-4">
              {editingChallenge && (
                <button 
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-800 text-slate-400 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-700 transition-all"
                >
                  Annulla
                </button>
              )}
              <button 
                type="submit"
                className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-orange-500 transition-all shadow-xl shadow-orange-600/20 active:scale-95"
              >
                {editingChallenge ? 'Salva Modifiche' : 'Pubblica Sfida'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {challenges.length === 0 ? (
          <div className="col-span-full bg-slate-900/50 border border-slate-800 border-dashed rounded-3xl p-20 text-center">
            <i className="fas fa-ghost text-slate-700 text-4xl mb-4"></i>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nessuna sfida creata</p>
          </div>
        ) : (
          challenges.map(c => (
            <div 
              key={c.id}
              onClick={() => {
                setSelectedChallenge(c);
                fetchRanking(c.id);
              }}
              className="group relative bg-slate-950 border border-slate-800 rounded-[2rem] p-6 cursor-pointer transition-all hover:scale-[1.02] hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10 active:scale-95"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black px-3 py-1 rounded-full bg-orange-900/30 text-orange-500 border border-orange-900/50 uppercase tracking-widest">
                  {c.discipline}
                </span>
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                      className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center border border-slate-700/50"
                      title="Modifica"
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center border border-red-900/30"
                      title="Elimina"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                )}
              </div>
              
              <h4 className="text-xl font-black text-white uppercase italic leading-tight mb-2 group-hover:text-orange-500 transition-colors">{c.name}</h4>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6">
                <i className="fas fa-map-marker-alt mr-1 text-orange-500"></i> {c.societyName}
              </p>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Premio</span>
                  <span className="text-sm font-black text-emerald-500 uppercase truncate">{c.prize}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Scadenza</span>
                  <span className="text-sm font-black text-slate-300 uppercase">
                    {new Date(c.endDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Modalità</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{c.mode}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 group-hover:bg-orange-600 group-hover:text-white transition-all">
                  <i className="fas fa-chevron-right text-xs"></i>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Challenge Details Modal */}
      {selectedChallenge && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSelectedChallenge(null)}>
          <div className="relative w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8 border-b border-slate-800 relative">
              <button 
                onClick={() => setSelectedChallenge(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg z-20"
              >
                <i className="fas fa-times text-lg"></i>
              </button>

              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-orange-600 text-white uppercase tracking-widest shadow-lg shadow-orange-600/20">
                    {selectedChallenge.mode}
                  </span>
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-widest">
                    {selectedChallenge.discipline}
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">{selectedChallenge.name}</h2>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                  <span><i className="fas fa-map-marker-alt text-orange-500 mr-2"></i> {selectedChallenge.societyName}</span>
                  <span><i className="fas fa-calendar-alt text-orange-500 mr-2"></i> {new Date(selectedChallenge.startDate).toLocaleDateString()} - {new Date(selectedChallenge.endDate).toLocaleDateString()}</span>
                  <span><i className="fas fa-trophy text-emerald-500 mr-2"></i> {selectedChallenge.prize}</span>
                </div>
              </div>
            </div>

            {/* Modal Content - Ranking */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 no-scrollbar">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-list-ol text-orange-500"></i> Classifica Real-Time
                </h3>
                
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Categoria:</span>
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
                      {categories.map(cat => (
                        <button 
                          key={cat}
                          onClick={() => setRankingCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${rankingCategory === cat ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Qualifica:</span>
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
                      {qualifications.map(qual => (
                        <button 
                          key={qual}
                          onClick={() => setRankingQualification(qual)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${rankingQualification === qual ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {qual}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {rankingLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Calcolo risultati in corso...</p>
                </div>
              ) : filteredRanking.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                  <i className="fas fa-bullseye text-slate-800 text-4xl mb-4"></i>
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nessun risultato trovato per questa sfida</p>
                  <p className="text-[10px] text-slate-600 mt-2 italic">Nota: Partecipano solo i tiratori iscritti a {selectedChallenge.societyName} che hanno gareggiato presso la stessa società.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredRanking.map((entry, index) => (
                    <div 
                      key={entry.userId}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:bg-slate-900/30 ${index === 0 ? 'bg-orange-600/5 border-orange-500/30' : 'bg-slate-900/10 border-slate-800/50'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-xl ${index === 0 ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : index === 1 ? 'bg-slate-400 text-slate-900' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-black text-white uppercase italic truncate">{entry.userName} {entry.userSurname}</h4>
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                            {entry.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          <span><i className="fas fa-medal mr-1 text-slate-600"></i> {entry.qualification}</span>
                          <span><i className="fas fa-calendar-check mr-1 text-slate-600"></i> {entry.competitionCount} Gare</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-2xl font-black italic leading-none ${index === 0 ? 'text-orange-500' : 'text-white'}`}>
                          {entry.value}
                        </div>
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">
                          {selectedChallenge.mode === ChallengeMode.TOTAL_HITS ? 'Piattelli' : 
                           selectedChallenge.mode === ChallengeMode.ACCURACY ? '%' : 
                           selectedChallenge.mode === ChallengeMode.PARTICIPATION ? 'Gare' :
                           selectedChallenge.mode === ChallengeMode.PERFECT_SERIES ? 'Serie' :
                           selectedChallenge.mode === ChallengeMode.CONSISTENCY ? 'Deviazione' :
                           selectedChallenge.mode.includes('Media') ? 'Media' : 'Punti'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HallOfFame;

