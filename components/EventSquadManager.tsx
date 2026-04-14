import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, RefreshCw, Save, Clock, Target, ArrowRight } from 'lucide-react';
import { SocietyEvent, EventSquad } from '../types';

interface EventSquadManagerProps {
  event: SocietyEvent;
  onClose: () => void;
}

export const EventSquadManager: React.FC<EventSquadManagerProps> = ({
  event,
  onClose
}) => {
  const [squads, setSquads] = useState<EventSquad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fieldsCount, setFieldsCount] = useState(2);
  const [startTime, setStartTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);

  const fetchSquads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${event.id}/squads`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!response.ok) throw new Error('Errore nel caricamento delle batterie');
      const data = await response.json();
      setSquads(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSquads();
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
      await fetchSquads();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
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
      await fetchSquads();
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
      // Update positions
      newSquads[fromSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      newSquads[toSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      setSquads(newSquads);
    } else {
      alert('La batteria di destinazione è piena (max 6 tiratori)');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Users className="w-6 h-6 text-orange-500" />
              Gestione Batterie
            </h2>
            <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">{event.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg border border-slate-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Controls Sidebar */}
          <div className="w-full md:w-80 p-6 sm:p-8 border-r border-slate-800 bg-slate-950/30 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-500" />
                Generazione Automatica
              </h3>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Numero Campi</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={fieldsCount}
                  onChange={e => setFieldsCount(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Orario Inizio</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-orange-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Genera Casualmente'}
              </button>
            </div>

            <div className="pt-6 border-t border-slate-800">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full py-4 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-lg border border-slate-700"
              >
                <Save className="w-5 h-5" />
                Salva Modifiche
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 text-red-500 border border-red-800 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}
          </div>

          {/* Squads Grid */}
          <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-950/50 custom-scrollbar">
            {isLoading && squads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <RefreshCw className="w-12 h-12 animate-spin mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">Caricamento batterie...</p>
              </div>
            ) : squads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                <Users className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-black uppercase tracking-tight text-white">Nessuna batteria generata</p>
                <p className="text-xs uppercase tracking-widest mt-2">Usa i controlli a sinistra per iniziare</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {squads.map((squad, sIdx) => (
                  <div key={squad.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-orange-500/30 transition-all group/squad">
                    <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-white uppercase tracking-tight text-sm">Batteria {squad.squad_number}</h4>
                        <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-orange-500" /> Campo {squad.field_number}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-500" /> {squad.start_time}
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] font-black bg-orange-600 text-white px-2 py-1 rounded-lg shadow-lg shadow-orange-600/20">
                        {squad.members.length}/6
                      </div>
                    </div>
                    <div className="p-2 space-y-1 min-h-[240px]">
                      {squad.members.map((member, mIdx) => (
                        <div key={member.registration_id} className="flex items-center gap-3 p-2 bg-slate-950 border border-slate-800 rounded-xl shadow-sm group/member hover:border-slate-700 transition-all">
                          <div className="w-6 h-6 flex items-center justify-center bg-slate-900 rounded-lg text-[10px] font-black text-slate-400 border border-slate-800">
                            {member.position}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white truncate uppercase tracking-tight">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-widest">
                              {member.category} • {member.society}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                            {sIdx > 0 && (
                              <button
                                onClick={() => moveMember(sIdx, mIdx, sIdx - 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-900 hover:bg-orange-600 text-orange-500 hover:text-white rounded-lg transition-all border border-slate-800"
                                title="Sposta in batteria precedente"
                              >
                                <ArrowRight className="w-3 h-3 rotate-180" />
                              </button>
                            )}
                            {sIdx < squads.length - 1 && (
                              <button
                                onClick={() => moveMember(sIdx, mIdx, sIdx + 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-900 hover:bg-orange-600 text-orange-500 hover:text-white rounded-lg transition-all border border-slate-800"
                                title="Sposta in batteria successiva"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {squad.members.length === 0 && (
                        <div className="flex items-center justify-center h-full text-slate-600 text-[10px] font-black uppercase tracking-widest italic py-10">
                          Batteria vuota
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
