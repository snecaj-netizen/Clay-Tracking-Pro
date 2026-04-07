import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-orange-500" />
              Gestione Batterie
            </h2>
            <p className="text-gray-500">{event.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Controls Sidebar */}
          <div className="w-full md:w-80 p-6 border-r border-gray-100 bg-gray-50/50 space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-500" />
                Generazione Automatica
              </h3>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Numero Campi</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={fieldsCount}
                  onChange={e => setFieldsCount(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Orario Inizio</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200 disabled:opacity-50"
              >
                {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Genera Casualmente'}
              </button>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200"
              >
                <Save className="w-5 h-5" />
                Salva Modifiche
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Squads Grid */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            {isLoading && squads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <RefreshCw className="w-12 h-12 animate-spin mb-4" />
                <p>Caricamento batterie...</p>
              </div>
            ) : squads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                <Users className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Nessuna batteria generata</p>
                <p className="text-sm">Usa i controlli a sinistra per iniziare</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {squads.map((squad, sIdx) => (
                  <div key={squad.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                      <div>
                        <h4 className="font-bold">Batteria {squad.squad_number}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" /> Campo {squad.field_number}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {squad.start_time}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-bold bg-orange-500 px-2 py-1 rounded">
                        {squad.members.length}/6
                      </div>
                    </div>
                    <div className="p-2 space-y-1 bg-gray-50 min-h-[240px]">
                      {squad.members.map((member, mIdx) => (
                        <div key={member.registration_id} className="flex items-center gap-2 p-2 bg-white border border-gray-100 rounded-lg shadow-sm group">
                          <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-bold text-gray-500">
                            {member.position}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {member.category} • {member.society}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {sIdx > 0 && (
                              <button
                                onClick={() => moveMember(sIdx, mIdx, sIdx - 1)}
                                className="p-1 hover:bg-orange-50 text-orange-500 rounded"
                                title="Sposta in batteria precedente"
                              >
                                <ArrowRight className="w-3 h-3 rotate-180" />
                              </button>
                            )}
                            {sIdx < squads.length - 1 && (
                              <button
                                onClick={() => moveMember(sIdx, mIdx, sIdx + 1)}
                                className="p-1 hover:bg-orange-50 text-orange-500 rounded"
                                title="Sposta in batteria successiva"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {squad.members.length === 0 && (
                        <div className="flex items-center justify-center h-full text-gray-300 text-xs italic py-10">
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
      </motion.div>
    </div>
  );
};
