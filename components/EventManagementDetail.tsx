import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, RefreshCw, Save, Clock, Target, ArrowRight, 
  ChevronLeft, Mail, Phone, Shield, User, Calendar,
  Download, Trash2, Edit3, Search
} from 'lucide-react';
import { SocietyEvent, EventSquad, EventRegistration } from '../types';

interface EventManagementDetailProps {
  event: SocietyEvent;
  onClose: () => void;
  initialTab?: 'registrations' | 'squads' | 'results';
  user?: any;
  token?: string;
  triggerConfirm?: any;
  triggerToast?: any;
  societies?: any[];
  setManagingResultsEvent?: (ev: SocietyEvent | null) => void;
  setViewingResultsEvent?: (ev: SocietyEvent | null) => void;
}

export const EventManagementDetail: React.FC<EventManagementDetailProps> = ({
  event,
  onClose,
  initialTab = 'registrations',
  user,
  token,
  triggerConfirm,
  triggerToast,
  societies = [],
  setManagingResultsEvent,
  setViewingResultsEvent
}) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'squads' | 'results'>(initialTab);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [squads, setSquads] = useState<EventSquad[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fieldsCount, setFieldsCount] = useState(2);
  const [startTime, setStartTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [regRes, squadRes, resultsRes] = await Promise.all([
        fetch(`/api/events/${event.id}/registrations`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/squads`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/results`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        })
      ]);

      if (!regRes.ok || !squadRes.ok || !resultsRes.ok) throw new Error('Errore nel caricamento dei dati');

      const [regData, squadData, resultsData] = await Promise.all([
        regRes.json(), 
        squadRes.json(),
        resultsRes.json()
      ]);
      setRegistrations(regData);
      setSquads(squadData);
      setResults(resultsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [event.id]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${event.id}/squads/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ fieldsCount, startTime })
      });
      if (!response.ok) throw new Error('Errore nella generazione delle batterie');
      await fetchData();
      setActiveTab('squads');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSquads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${event.id}/squads/update-members`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ squads })
      });
      if (!response.ok) throw new Error('Errore nel salvataggio delle batterie');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const moveMember = (fromSquadIndex: number, fromMemberIndex: number, toSquadIndex: number) => {
    const newSquads = JSON.parse(JSON.stringify(squads));
    const [member] = newSquads[fromSquadIndex].members.splice(fromMemberIndex, 1);
    
    if (newSquads[toSquadIndex].members.length < 6 || fromSquadIndex === toSquadIndex) {
      newSquads[toSquadIndex].members.push(member);
      newSquads[fromSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      newSquads[toSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      setSquads(newSquads);
    } else {
      alert('La batteria di destinazione è piena (max 6 tiratori)');
    }
  };

  const filteredRegistrations = registrations.filter(reg => 
    `${reg.first_name} ${reg.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.shooter_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold uppercase tracking-widest">Torna alle Gare</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest border border-orange-500/20">
                Gestione Gara
              </span>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                ID: {event.id}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-none">
              {event.name}
            </h1>
            <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              {new Date(event.start_date).toLocaleDateString('it-IT')} - {event.location}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'registrations' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Iscritti ({registrations.length})
            </button>
            <button
              onClick={() => setActiveTab('squads')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'squads' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Batterie ({squads.length})
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'results' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Classifiche
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'registrations' ? (
          <div className="space-y-6">
            {/* Registrations Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Cerca tiratore o codice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={fetchData}
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Aggiorna</span>
                </button>
                <button 
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + "Nome,Cognome,Codice,Societa,Categoria,Qualifica,Email,Telefono\n"
                      + registrations.map(r => `${r.first_name},${r.last_name},${r.shooter_code},${r.society},${r.category},${r.qualification},${r.email},${r.phone}`).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `iscritti_${event.name.replace(/\s+/g, '_')}.csv`);
                    document.body.appendChild(link);
                    link.click();
                  }}
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Export CSV</span>
                </button>
              </div>
            </div>

            {/* Registrations Table */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-bottom border-slate-800 bg-slate-900/50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiratore</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Codice</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Società</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dettagli</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Contatti</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredRegistrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-white uppercase tracking-tight">{reg.first_name} {reg.last_name}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{reg.registration_day}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-400">{reg.shooter_code || 'N/D'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-300 uppercase">{reg.society || 'N/D'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {reg.category}
                              </span>
                              {reg.qualification && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                                  {reg.qualification}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 italic truncate max-w-[150px]">
                              {reg.shotgun_brand} {reg.shotgun_model}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {reg.email && (
                              <div className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors">
                                <Mail className="w-3 h-3" />
                                <span className="text-[10px] font-medium">{reg.email}</span>
                              </div>
                            )}
                            {reg.phone && (
                              <div className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors">
                                <Phone className="w-3 h-3" />
                                <span className="text-[10px] font-medium">{reg.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'squads' ? (
          <div className="space-y-8">
            {/* Squads Controls */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Numero Campi</label>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <button
                          key={n}
                          onClick={() => setFieldsCount(n)}
                          className={`w-10 h-10 rounded-xl font-black text-xs transition-all border ${
                            fieldsCount === n 
                              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Orario Inizio</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <input 
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || registrations.length === 0}
                    className="flex-1 lg:flex-none px-8 py-4 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    Genera Batterie
                  </button>
                  <button
                    onClick={handleSaveSquads}
                    disabled={squads.length === 0}
                    className="flex-1 lg:flex-none px-8 py-4 rounded-2xl bg-slate-800 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Salva Modifiche
                  </button>
                </div>
              </div>
            </div>

            {/* Squads Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {squads.map((squad, sIdx) => (
                <div key={squad.id} className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all group">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Batteria {squad.squad_number}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{squad.start_time}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:border-orange-500/30 group-hover:text-orange-500 transition-all">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {squad.members.map((member, mIdx) => (
                      <div 
                        key={member.registration_id}
                        className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl group/member"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded bg-slate-900 text-[10px] font-black text-slate-500 flex items-center justify-center border border-slate-800">
                            {member.position}
                          </span>
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                            {member.first_name} {member.last_name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                          {squads.length > 1 && (
                            <select 
                              onChange={(e) => moveMember(sIdx, mIdx, parseInt(e.target.value))}
                              className="bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 rounded px-1 py-0.5 focus:outline-none"
                              value={sIdx}
                            >
                              {squads.map((_, idx) => (
                                <option key={idx} value={idx}>Sposta in B{idx + 1}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                    {Array.from({ length: 6 - squad.members.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-10 border border-dashed border-slate-800/50 rounded-xl flex items-center justify-center">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Posto Libero</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-orange-600/10 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner border border-orange-500/20">
                <i className="fas fa-trophy"></i>
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Gestione Classifiche e Risultati</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Utilizza il sistema avanzato per inserire i punteggi, gestire le categorie, le qualifiche e generare le classifiche ufficiali in PDF.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {(user?.role === 'admin' || (user?.role === 'society' && (event.location === user?.society || event.created_by === user?.id) && event.status !== 'validated')) ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={() => {
                        setManagingResultsEvent?.(event);
                      }}
                      className="px-8 py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20 flex items-center gap-3 group"
                    >
                      <i className="fas fa-edit group-hover:rotate-12 transition-transform"></i>
                      Gestisci Risultati
                    </button>
                    {user?.role === 'admin' && event.status === 'validated' && (
                      <button
                        onClick={() => {
                          triggerConfirm?.(
                            'Riapri Classifica',
                            'Sei sicuro di voler riaprire questa classifica per modifiche? Lo stato tornerà a "In Corso".',
                            async () => {
                              try {
                                const res = await fetch(`/api/events/${event.id}/reopen`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  triggerToast?.('Classifica riaperta con successo', 'success');
                                  // The parent should refresh
                                } else {
                                  triggerToast?.('Errore durante la riapertura', 'error');
                                }
                              } catch (error) {
                                triggerToast?.('Errore di rete', 'error');
                              }
                            }
                          );
                        }}
                        className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 flex items-center gap-3 group"
                      >
                        <i className="fas fa-unlock group-hover:-rotate-12 transition-transform"></i>
                        Riapri Classifica
                      </button>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setViewingResultsEvent?.(event);
                      onClose();
                    }}
                    className="px-8 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center gap-3 group"
                  >
                    <i className="fas fa-eye group-hover:scale-110 transition-transform"></i>
                    Vedi Classifica
                  </button>
                )}
              </div>
            </div>

            {results.length > 0 && (
              <div className="bg-slate-900/30 border border-slate-800/50 rounded-3xl p-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <i className="fas fa-info-circle text-orange-500"></i>
                  Riepilogo Risultati Caricati
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Tiratori con Risultato</p>
                    <p className="text-2xl font-black text-white">{results.filter(r => !r.is_registered_only).length}</p>
                  </div>
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Punteggio Massimo</p>
                    <p className="text-2xl font-black text-orange-500">{Math.max(...results.filter(r => !r.is_registered_only).map(r => r.totalscore || 0), 0)}</p>
                  </div>
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Stato Gara</p>
                    <p className="text-sm font-bold text-white uppercase tracking-tight">
                      {event.status === 'validated' ? 'Convalidata' : 'In Corso'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
