import React, { useState, useMemo, useCallback } from 'react';
import ShooterSearch from '../ShooterSearch';
import SocietySearch from '../SocietySearch';
import { useAdmin } from '../../contexts/AdminContext';
import { useUI } from '../../contexts/UIContext';

interface TeamManagementProps {
  currentUser: any;
  token: string;
  fetchAllResults: () => void;
}

// Team Card Component
const TeamCard = React.memo(({ 
  team, 
  editingScore, 
  onSetEditingScore, 
  onUpdateScore, 
  onSetSelectedTeamForSheet, 
  onEditTeam, 
  onDeleteTeam 
}: { 
  team: any, 
  editingScore: any, 
  onSetEditingScore: (score: any) => void, 
  onUpdateScore: (teamId: number, userId: number, score: number) => void, 
  onSetSelectedTeamForSheet: (team: any, action?: 'print' | 'download') => void, 
  onEditTeam: (team: any) => void, 
  onDeleteTeam: (id: number) => void 
}) => {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden group hover:border-orange-500/30 transition-all flex flex-col">
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/30 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors truncate">{team.name}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <i className="fas fa-calendar-alt text-orange-500/50"></i> {team.date}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <i className="fas fa-bullseye text-orange-500/50"></i> {team.discipline}
            </span>
            {team.competition_name && (
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 truncate max-w-[150px]">
                <i className="fas fa-trophy text-orange-500/50"></i> {team.competition_name}
              </span>
            )}
            {team.location && (
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <i className="fas fa-map-marker-alt text-orange-500/50"></i> {team.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 ml-2">
          <button 
            onClick={() => onSetSelectedTeamForSheet(team, 'print')}
            className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-500 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg"
            title="Stampa Statino"
          >
            <i className="fas fa-print text-[10px]"></i>
          </button>
          <button 
            onClick={() => onSetSelectedTeamForSheet(team, 'download')}
            className="w-8 h-8 rounded-lg bg-green-600/10 text-green-500 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-lg"
            title="Scarico Statino (PDF)"
          >
            <i className="fas fa-file-download text-[10px]"></i>
          </button>
          <button 
            onClick={() => onEditTeam(team)}
            className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all shadow-lg"
          >
            <i className="fas fa-edit text-[10px]"></i>
          </button>
          <button 
            onClick={() => onDeleteTeam(team.id)}
            className="w-8 h-8 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-lg"
          >
            <i className="fas fa-trash-alt text-[10px]"></i>
          </button>
        </div>
      </div>
      
      <div className="p-3 flex-1">
        <div className="grid grid-cols-1 gap-2">
          {team.members.map((member: any) => (
            <div key={member.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-black text-orange-500">
                  {member.surname?.[0] || ''}{member.name?.[0] || ''}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-white truncate">{member.surname} {member.name}</p>
                    {member.rte_score && (
                      <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Rating RTE (Proiezione su 100)">
                        {(parseFloat(member.rte_score) * 4).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold truncate">
                    {member.category || 'N/A'} / {member.qualification || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingScore?.teamId === team.id && editingScore?.userId === member.id ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      autoFocus
                      defaultValue={member.score || 0}
                      onBlur={(e) => onUpdateScore(team.id, member.id, Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onUpdateScore(team.id, member.id, Number((e.target as HTMLInputElement).value));
                        if (e.key === 'Escape') onSetEditingScore(null);
                      }}
                      className="w-12 bg-slate-950 border border-orange-500 rounded-lg px-1.5 py-0.5 text-xs text-white text-center outline-none"
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => onSetEditingScore({ teamId: team.id, userId: member.id, score: member.score || 0 })}
                    className="flex items-baseline gap-1 cursor-pointer hover:bg-slate-800 px-1.5 py-0.5 rounded-lg transition-all"
                  >
                    <span className="text-sm font-black text-orange-500">{member.score || 0}</span>
                    <span className="text-[9px] font-bold text-slate-600">/ {team.targets || 100}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-3 bg-slate-900/50 border-t border-slate-800/50 flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Totale Squadra</span>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-white">
            {team.members.reduce((acc: number, m: any) => acc + (m.score || 0), 0)}
          </span>
          <span className="text-[10px] font-bold text-slate-600">/ {team.targets * team.size}</span>
        </div>
      </div>
    </div>
  );
});

const TeamManagement: React.FC<TeamManagementProps> = ({
  currentUser, token, fetchAllResults
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const {
    societies, teamStats, setTeamStats, teams, setTeams, events, loading, backgroundLoading,
    showTeamForm, setShowTeamForm, newTeamName, setNewTeamName, newTeamSize, setNewTeamSize, newTeamEventId, setNewTeamEventId,
    newTeamCompetitionName, setNewTeamCompetitionName, newTeamDiscipline, setNewTeamDiscipline, newTeamSociety, setNewTeamSociety,
    newTeamLocation, setNewTeamLocation, newTeamDate, setNewTeamDate, newTeamTargets, setNewTeamTargets,
    selectedShooterIds, setSelectedShooterIds, editingTeam, setEditingTeam, editingScore, setEditingScore,
    allUsers: shooters, setSelectedTeamForSheet, setSelectedTeamSheetAction, filterDiscipline: statsFilterDiscipline, setFilterDiscipline: setStatsFilterDiscipline, fetchTeams, fetchTeamStats
  } = useAdmin();

  const filteredTeamStats = useMemo(() => {
    let filtered = teamStats;
    if (statsFilterDiscipline) {
      filtered = teamStats.filter(s => s.discipline === statsFilterDiscipline);
    }
    return [...filtered].sort((a, b) => {
      const rteA = a.avg_score ? parseFloat(a.avg_score) * 4 : 0;
      const rteB = b.avg_score ? parseFloat(b.avg_score) * 4 : 0;
      return rteB - rteA;
    });
  }, [teamStats, statsFilterDiscipline]);

  const statsDisciplines = useMemo(() => {
    return Array.from(new Set(teamStats.map(s => s.discipline))).sort();
  }, [teamStats]);

  const handleEditTeam = useCallback((team: any) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamSize(team.size);
    setNewTeamEventId(team.event_id);
    setNewTeamCompetitionName(team.competition_name);
    setNewTeamDiscipline(team.discipline);
    setNewTeamSociety(team.society);
    setNewTeamLocation(team.location);
    setNewTeamDate(team.date);
    setNewTeamTargets(team.targets);
    setSelectedShooterIds(team.members.map((m: any) => m.id));
    setShowTeamForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setEditingTeam, setNewTeamName, setNewTeamSize, setNewTeamEventId, setNewTeamCompetitionName, setNewTeamDiscipline, setNewTeamSociety, setNewTeamLocation, setNewTeamDate, setNewTeamTargets, setSelectedShooterIds, setShowTeamForm]);

  const [teamSubTab, setTeamSubTab] = useState<'list' | 'stats'>('list');
  const [shooterSearch, setShooterSearch] = useState('');

  const filteredShooters = useMemo(() => {
    if (!shooterSearch) return shooters;
    const term = shooterSearch.toLowerCase();
    return shooters.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.surname.toLowerCase().includes(term) ||
      (s.shooter_code && s.shooter_code.toLowerCase().includes(term))
    );
  }, [shooters, shooterSearch]);

  const handleSetSelectedTeamForSheet = (team: any, action?: 'print' | 'download') => {
    setSelectedTeamSheetAction(action || null);
    setSelectedTeamForSheet(team);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShooterIds.length !== newTeamSize) {
      triggerToast?.(`Seleziona esattamente ${newTeamSize} tiratori`, 'error');
      return;
    }

    const endpoint = editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams';
    const method = editingTeam ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: newTeamName,
          size: newTeamSize,
          event_id: newTeamEventId,
          competition_name: newTeamCompetitionName,
          discipline: newTeamDiscipline,
          society: newTeamSociety,
          location: newTeamLocation,
          date: newTeamDate,
          targets: newTeamTargets,
          memberIds: selectedShooterIds
        }),
      });

      if (!res.ok) throw new Error('Errore durante il salvataggio della squadra');
      
      setShowTeamForm(false);
      setEditingTeam(null);
      setNewTeamName('');
      setSelectedShooterIds([]);
      fetchTeams();
      fetchTeamStats();
      fetchAllResults();
      triggerToast?.('Squadra salvata con successo!', 'success');
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    }
  };

  const handleDeleteTeam = (id: number) => {
    triggerConfirm(
      'Elimina Squadra',
      'Sei sicuro di voler eliminare questa squadra? L\'azione è irreversibile.',
      async () => {
        try {
          const res = await fetch(`/api/teams/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          fetchTeams();
          fetchTeamStats();
          triggerToast?.('Squadra eliminata', 'success');
        } catch (err: any) {
          triggerToast?.(err.message, 'error');
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleUpdateScore = async (teamId: number, userId: number, score: number) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}/score`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ score }),
      });

      if (!res.ok) throw new Error('Errore durante l\'aggiornamento del punteggio');
      
      setEditingScore(null);
      fetchTeams(undefined, true);
      fetchTeamStats();
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <i className="fas fa-users-cog text-orange-500"></i> Squadre
            {(loading || backgroundLoading) && <i className="fas fa-circle-notch fa-spin text-orange-500 text-xs ml-2"></i>}
          </h2>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button 
              onClick={() => setTeamSubTab('list')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${teamSubTab === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Lista
            </button>
            <button 
              onClick={() => setTeamSubTab('stats')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${teamSubTab === 'stats' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Statistiche
            </button>
          </div>
        </div>
      </div>

      {teamSubTab === 'stats' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Ranking Squadre</h3>
              <div className="group relative">
                <i className="fas fa-info-circle text-xs text-slate-600 cursor-help hover:text-orange-500 transition-colors p-1"></i>
                <div className="absolute top-full left-0 mt-1 w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl hidden group-hover:block pointer-events-none z-[100] text-[10px] font-medium text-slate-400 normal-case tracking-normal leading-relaxed">
                  <p className="mb-1 text-white font-bold">Rating Tecnico di Eccellenza (RTE)</p>
                  Media dei <span className="text-white">migliori 5 risultati</span> (ultimi 12 mesi). 
                  Il valore è proiettato su <span className="text-orange-500 font-bold">100 piattelli</span> per facilitare la composizione della squadra.
                </div>
              </div>
            </div>
            <select 
              value={statsFilterDiscipline}
              onChange={(e) => setStatsFilterDiscipline(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase outline-none focus:border-orange-500 transition-all"
            >
              <option value="">Tutte le Discipline</option>
              {statsDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {filteredTeamStats.map((stat, idx) => (
              <div key={`${stat.name}-${stat.discipline}`} className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3 flex items-center justify-between group hover:border-orange-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                      {stat.surname} {stat.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stat.discipline}</p>
                      <span className="text-[8px] text-slate-600 font-bold px-1.5 py-0.5 bg-slate-900 rounded uppercase">
                        {stat.category} / {stat.qualification}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-base font-black text-orange-500">
                      {(parseFloat(stat.avg_score) * 4).toFixed(2)}
                    </span>
                    <span className="text-[9px] font-bold text-slate-600">RTE</span>
                  </div>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">{stat.total_competitions} Gare</p>
                </div>
              </div>
            ))}
            {filteredTeamStats.length === 0 && (
              <div className="py-12 text-center text-slate-600 italic text-sm">Nessuna statistica disponibile.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {showTeamForm ? (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 mb-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  {editingTeam ? 'Modifica Squadra' : 'Nuova Squadra'}
                </h3>
                <button onClick={() => { setShowTeamForm(false); setEditingTeam(null); }} className="text-slate-500 hover:text-white transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <form onSubmit={handleCreateTeam} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Squadra</label>
                    <input type="text" required value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" placeholder="es. Roma Team A" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dimensione</label>
                    <select value={newTeamSize} onChange={e => setNewTeamSize(Number(e.target.value) as 3 | 6)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                      <option value={3}>3 Tiratori</option>
                      <option value={6}>6 Tiratori</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Gara (Opzionale)</label>
                    <select 
                      value={newTeamEventId || ''} 
                      onChange={e => {
                        const id = e.target.value;
                        setNewTeamEventId(id || null);
                        if (id) {
                          const ev = events.find(ev => String(ev.id) === id);
                          if (ev) {
                            setNewTeamCompetitionName(ev.name);
                            setNewTeamDiscipline(ev.discipline);
                            setNewTeamLocation(ev.location);
                            setNewTeamDate(ev.start_date ? ev.start_date.split('T')[0] : new Date().toISOString().split('T')[0]);
                          }
                        }
                      }} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="">Nessuna gara specifica</option>
                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.discipline})</option>)}
                    </select>
                  </div>
                  {!newTeamEventId && (
                    <>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Competizione</label>
                        <input type="text" required value={newTeamCompetitionName} onChange={e => setNewTeamCompetitionName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                        <input type="text" required value={newTeamDiscipline} onChange={e => setNewTeamDiscipline(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società TAV</label>
                        <SocietySearch 
                          value={newTeamSociety}
                          onChange={setNewTeamSociety}
                          societies={societies}
                          placeholder="Seleziona..."
                          disabled={currentUser?.role === 'society'}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data</label>
                        <input type="date" required value={newTeamDate} onChange={e => setNewTeamDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Piattelli Totali</label>
                        <input type="number" required value={newTeamTargets} onChange={e => setNewTeamTargets(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seleziona Tiratori ({selectedShooterIds.length}/{newTeamSize})</label>
                    <div className="relative">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
                      <input 
                        type="text" 
                        placeholder="Cerca tiratore..." 
                        value={shooterSearch}
                        onChange={e => setShooterSearch(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-[10px] text-white focus:border-orange-600 outline-none transition-all w-40"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-2 bg-slate-900 rounded-2xl border border-slate-800 custom-scrollbar">
                    {filteredShooters.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedShooterIds(prev => 
                            prev.includes(s.id) ? prev.filter(id => id !== s.id) : (prev.length < newTeamSize ? [...prev, s.id] : prev)
                          );
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedShooterIds.includes(s.id) ? 'bg-orange-600/20 border-orange-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${selectedShooterIds.includes(s.id) ? 'bg-orange-600 text-white' : 'bg-slate-900 text-slate-600'}`}>
                          {s.surname?.[0] || ''}{s.name?.[0] || ''}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{s.surname} {s.name}</p>
                          <p className="text-[9px] opacity-60 truncate">{s.category} / {s.qualification}</p>
                        </div>
                        {selectedShooterIds.includes(s.id) && <i className="fas fa-check-circle text-orange-500"></i>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowTeamForm(false); setEditingTeam(null); }} className="px-6 py-2 rounded-xl text-xs font-black uppercase bg-slate-800 text-white hover:bg-slate-700 transition-all">Annulla</button>
                  <button type="submit" className="px-6 py-2 rounded-xl text-xs font-black uppercase bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20 transition-all">
                    {editingTeam ? 'Salva Modifiche' : 'Crea Squadra'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {teams.map(team => (
                <TeamCard 
                  key={team.id} 
                  team={team} 
                  editingScore={editingScore} 
                  onSetEditingScore={setEditingScore} 
                  onUpdateScore={handleUpdateScore} 
                  onSetSelectedTeamForSheet={handleSetSelectedTeamForSheet} 
                  onEditTeam={handleEditTeam} 
                  onDeleteTeam={handleDeleteTeam} 
                />
              ))}
              {teams.length === 0 && (
                <div className="col-span-full py-20 text-center bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
                  <i className="fas fa-users text-4xl text-slate-800 mb-4"></i>
                  <p className="text-slate-500 font-bold">Nessuna squadra creata.</p>
                  <button onClick={() => setShowTeamForm(true)} className="mt-4 text-orange-500 font-black uppercase text-xs hover:underline">Crea la prima squadra</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
