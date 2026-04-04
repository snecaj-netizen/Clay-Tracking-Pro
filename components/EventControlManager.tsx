import React, { useState, useEffect, useMemo } from 'react';
import { SocietyEvent } from '../types';
import { Search, Calendar, MapPin, CheckCircle2, XCircle, Loader2, Settings2 } from 'lucide-react';

interface EventControlManagerProps {
  token: string;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  triggerConfirm?: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'primary' | 'danger') => void;
}

export const EventControlManager: React.FC<EventControlManagerProps> = ({ token, triggerToast, triggerConfirm }) => {
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  const handleToggleManagement = async (eventId: string, currentStatus: boolean) => {
    if (!currentStatus) {
      if (triggerConfirm) {
        triggerConfirm(
          'Attiva Gestione',
          'Sei sicuro di voler attivare la gestione per questa gara? Questa operazione abiliterà il sistema di iscrizioni e classifiche.',
          () => executeToggle(eventId, currentStatus),
          'Attiva',
          'primary'
        );
        return;
      } else {
        const confirmed = window.confirm('Sei sicuro di voler attivare la gestione per questa gara?');
        if (!confirmed) return;
      }
    }

    executeToggle(eventId, currentStatus);
  };

  const executeToggle = async (eventId: string, currentStatus: boolean) => {
    setTogglingId(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/toggle-management`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !currentStatus })
      });

      if (res.ok) {
        setEvents(events.map(ev => 
          ev.id === eventId ? { ...ev, is_management_enabled: !currentStatus } : ev
        ));
        triggerToast?.(`Gara ${!currentStatus ? 'attivata' : 'disattivata'} con successo!`, 'success');
      } else {
        const err = await res.json();
        triggerToast?.(err.error || 'Errore durante l\'operazione', 'error');
      }
    } catch (err) {
      console.error('Error toggling management:', err);
      triggerToast?.('Errore di rete', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    const filtered = events.filter(ev => 
      ev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const futureEvents = filtered.filter(ev => new Date(ev.start_date) >= now);
    const pastEvents = filtered.filter(ev => new Date(ev.start_date) < now);

    // Future: closest to today first
    futureEvents.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    
    // Past: most recent first
    pastEvents.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

    return [...futureEvents, ...pastEvents];
  }, [events, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-500 flex items-center justify-center text-lg">
              <Settings2 className="w-5 h-5" />
            </div>
            Attivazione Gare
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Seleziona le gare in cui abilitare il sistema di iscrizioni, batterie e classifiche.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Cerca gara o società..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Caricamento gare...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map(ev => (
            <div 
              key={ev.id} 
              className={`bg-slate-900/50 border rounded-3xl p-6 transition-all duration-300 ${
                ev.is_management_enabled 
                  ? 'border-green-500/30 bg-green-500/5 shadow-lg shadow-green-500/5' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-700">
                      {ev.discipline}
                    </span>
                    {ev.is_management_enabled && (
                      <span className="px-2 py-0.5 rounded bg-green-500/10 text-[9px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Attiva
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-2">{ev.name}</h3>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                      <Calendar className="w-3 h-3 text-orange-500/50" />
                      {new Date(ev.start_date).toLocaleDateString('it-IT')}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                      <MapPin className="w-3 h-3 text-orange-500/50" />
                      {ev.location}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleToggleManagement(ev.id, !!ev.is_management_enabled)}
                disabled={togglingId === ev.id}
                className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  ev.is_management_enabled
                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
                    : 'bg-green-600 text-white shadow-lg shadow-green-600/20 hover:bg-green-500'
                } disabled:opacity-50`}
              >
                {togglingId === ev.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : ev.is_management_enabled ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    Disattiva Gestione
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Attiva Gestione
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="text-center py-24 bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-800/50">
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Nessuna gara trovata</p>
        </div>
      )}
    </div>
  );
};
