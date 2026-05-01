import React, { useState, useEffect, useMemo } from 'react';
import { SocietyEvent } from '../types';
import { Search, Calendar, MapPin, CheckCircle2, XCircle, Loader2, Settings2 } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface EventControlManagerProps {
  token: string;
}

export const EventControlManager: React.FC<EventControlManagerProps> = ({ token }) => {
  const { triggerToast, triggerConfirm } = useUI();
  const { t, language } = useLanguage();
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
    if (togglingId) return;

    const performToggle = async () => {
      console.log(`Starting toggle for event ${eventId}, current status: ${currentStatus}`);
      setTogglingId(eventId);
      
      const timeoutId = setTimeout(() => {
        console.warn(`Toggle operation for event ${eventId} timed out after 15s`);
        setTogglingId(prev => prev === eventId ? null : prev);
      }, 15000);

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
          const updatedEvent = await res.json();
          setEvents(prev => prev.map(ev => 
            ev.id === eventId ? { ...ev, is_management_enabled: updatedEvent.is_management_enabled } : ev
          ));
          triggerToast?.(t('event_management_toggled_success').replace('{{status}}', updatedEvent.is_management_enabled ? t('activated') : t('deactivated')), 'success');
        } else {
          let errorMsg = t('operation_error');
          try {
            const err = await res.json();
            errorMsg = err.error || errorMsg;
          } catch (e) {
            if (res.status === 403) errorMsg = t('validate_permission_error');
          }
          console.error(`Toggle error for ${eventId}:`, errorMsg);
          triggerToast?.(errorMsg, 'error');
        }
      } catch (err) {
        console.error(`Network error toggling management for ${eventId}:`, err);
        triggerToast?.(t('connection_error'), 'error');
      } finally {
        clearTimeout(timeoutId);
        setTogglingId(null);
      }
    };

    if (!currentStatus) {
      if (triggerConfirm) {
        triggerConfirm(
          t('activate_management_title'),
          t('activate_management_confirm'),
          performToggle,
          t('activate_btn'),
          'primary'
        );
      } else if (window.confirm(t('activate_management_confirm'))) {
        performToggle();
      }
    } else {
      performToggle();
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
            {t('activation_title')}
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {t('activation_subtitle')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="bg-slate-900/60 p-1 rounded-xl border border-slate-800 flex items-center shrink-0">
            <div className="px-3 py-1 border-r border-slate-800">
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none">{t('total')}</p>
              <p className="text-xs font-black text-white mt-1 leading-none">{events.length}</p>
            </div>
            <div className="px-3 py-1 border-r border-slate-800">
              <p className="text-[8px] text-orange-500 font-black uppercase tracking-widest leading-none">{t('active_monitoring_label')}</p>
              <p className="text-xs font-black text-white mt-1 leading-none">{events.filter(e => e.is_management_enabled).length}</p>
            </div>
            <button 
              onClick={fetchEvents}
              disabled={loading}
              className="px-3 py-1 text-slate-500 hover:text-orange-500 transition-colors disabled:opacity-50"
              title={t('refresh')}
            >
              <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder={t('search_event_society_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors text-white"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t('loading_events')}</p>
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
                      {t(ev.discipline)}
                    </span>
                    {ev.is_management_enabled && (
                      <span className="px-2 py-0.5 rounded bg-green-500/10 text-[9px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {t('active_tag')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-2">{ev.name}</h3>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                      <Calendar className="w-3 h-3 text-orange-500/50" />
                      {(() => {
                        const start = new Date(ev.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US');
                        const end = ev.end_date ? new Date(ev.end_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US') : null;
                        return end && end !== start ? `${start} - ${end}` : start;
                      })()}
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
                    {t('deactivate_management_btn')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('activate_management_btn')}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="text-center py-24 bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-800/50">
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">{t('no_events_found')}</p>
        </div>
      )}
    </div>
  );
};
