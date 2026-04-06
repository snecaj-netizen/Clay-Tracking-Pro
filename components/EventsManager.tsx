import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { SocietyEvent, Discipline } from '../types';
import SocietySearch from './SocietySearch';
import EventResultsManager from './EventResultsManager';
import { EventRegistrationModal } from './EventRegistrationModal';
import { EventSquadManager } from './EventSquadManager';
import { EventManagementDetail } from './EventManagementDetail';

interface EventsManagerProps {
  user: any;
  token: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  societies: any[];
  onParticipate?: (event: SocietyEvent) => void;
  onCreateTeam?: (event: SocietyEvent) => void;
  restrictToSociety?: boolean;
  initialEventId?: string | null;
  onInitialEventHandled?: () => void;
  initialViewMode?: 'list' | 'calendar' | 'results' | 'managed';
  onInitialViewModeHandled?: () => void;
  hideViewSwitcher?: boolean;
  filterRegistrationOpen?: boolean;
  appSettings?: any;
  onCreateEventTrigger?: number;
  onToggleFAB?: (hide: boolean) => void;
}

const EventsManager: React.FC<EventsManagerProps> = ({ user, token, triggerConfirm, triggerToast, societies, onParticipate, onCreateTeam, restrictToSociety, initialEventId, onInitialEventHandled, initialViewMode = 'list', onInitialViewModeHandled, hideViewSwitcher = false, filterRegistrationOpen = false, appSettings, onCreateEventTrigger, onToggleFAB }) => {
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SocietyEvent | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'results' | 'managed'>(initialViewMode as any);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SocietyEvent | null>(null);
  const [managingResultsEvent, setManagingResultsEvent] = useState<SocietyEvent | null>(null);
  const [viewingResultsEvent, setViewingResultsEvent] = useState<SocietyEvent | null>(null);
  const [registeringEvent, setRegisteringEvent] = useState<SocietyEvent | null>(null);
  const [managingSquadsEvent, setManagingSquadsEvent] = useState<SocietyEvent | null>(null);
  const [managingEventDetail, setManagingEventDetail] = useState<SocietyEvent | null>(null);
  const [refreshDetailVersion, setRefreshDetailVersion] = useState(0);
  const [initialManagementTab, setInitialManagementTab] = useState<'registrations' | 'squads' | 'results'>('registrations');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  
  const resultsAccess = appSettings?.event_results_access || {};

  useEffect(() => {
    if (onToggleFAB) {
      onToggleFAB(!!managingEventDetail);
    }
    return () => {
      if (onToggleFAB) onToggleFAB(false);
    };
  }, [managingEventDetail, onToggleFAB]);

  const checkAccess = (access: any, userSociety: string | undefined) => {
    if (typeof access === 'boolean') return access;
    if (!access?.enabled) return false;
    if (access.accessType === 'all') return true;
    if (access.accessType === 'specific' && Array.isArray(access.allowedSocieties)) {
      return access.allowedSocieties.some((s: string) => s?.trim().toLowerCase() === userSociety?.trim().toLowerCase());
    }
    return false;
  };

  const hasSocietaAccess = user?.role === 'admin' || checkAccess(resultsAccess.societa, user?.society);
  const hasTiratoriAccess = user?.role === 'admin' || checkAccess(resultsAccess.tiratori, user?.society);

  const [showFilters, setShowFilters] = useState(false);
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  
  const hasActiveFilters = filterSociety !== '' || filterDiscipline !== '' || filterMonth !== '';

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
      onInitialViewModeHandled?.();
    }
  }, [initialViewMode, onInitialViewModeHandled]);

  useEffect(() => {
    if (initialEventId && events.length > 0) {
      const event = events.find(e => e.id === initialEventId);
      if (event) {
        setSelectedEvent(event);
        if (onInitialEventHandled) onInitialEventHandled();
      }
    }
  }, [initialEventId, events, onInitialEventHandled]);

  useEffect(() => {
    if (onCreateEventTrigger && onCreateEventTrigger > 0) {
      resetForm();
      setShowForm(true);
    }
  }, [onCreateEventTrigger]);

  const nextUpcomingEventId = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixDaysFromNow = new Date(today);
    sixDaysFromNow.setDate(today.getDate() + 6);
    
    const futureEvents = events.filter(ev => {
      const start = new Date(ev.start_date);
      start.setHours(0, 0, 0, 0);
      return start > today && start <= sixDaysFromNow;
    });
    
    if (futureEvents.length === 0) return null;
    
    futureEvents.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    return futureEvents[0].id;
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    const filtered = events.filter(ev => {
      // For results view, only show events that have results or are validated
      if (viewMode === 'results') {
        const canViewResults = user?.role === 'admin' || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess);
        if (!canViewResults) return false;
        if (ev.status !== 'validated' && (!ev.result_count || Number(ev.result_count) === 0)) return false;
      }
      
      // Society users can see all results, but only their own events in other views if restricted
      if (viewMode !== 'results' && restrictToSociety && user?.role === 'society') {
        const userSociety = (user.society || '').toLowerCase().trim();
        const eventLocation = (ev.location || '').toLowerCase().trim();
        const isCreator = Number(ev.created_by) === Number(user.id);
        if (eventLocation !== userSociety && !isCreator) return false;
      }
      
      if (filterSociety && ev.location?.toLowerCase().trim() !== filterSociety.toLowerCase().trim()) return false;
      if (filterDiscipline && ev.discipline !== filterDiscipline) return false;
      if (filterMonth) {
        const evMonth = new Date(ev.start_date).toISOString().slice(0, 7);
        if (evMonth !== filterMonth) return false;
      }
      if (filterRegistrationOpen && !ev.is_management_enabled) return false;
      return true;
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return filtered.sort((a, b) => {
      const startA = new Date(a.start_date);
      startA.setHours(0, 0, 0, 0);
      const endA = new Date(a.end_date);
      endA.setHours(0, 0, 0, 0);
      const isOngoingA = today >= startA && today <= endA;

      const startB = new Date(b.start_date);
      startB.setHours(0, 0, 0, 0);
      const endB = new Date(b.end_date);
      endB.setHours(0, 0, 0, 0);
      const isOngoingB = today >= startB && today <= endB;

      if (isOngoingA && !isOngoingB) return -1;
      if (!isOngoingA && isOngoingB) return 1;

      const isNextA = a.id === nextUpcomingEventId;
      const isNextB = b.id === nextUpcomingEventId;

      if (isNextA && !isNextB) return -1;
      if (!isNextA && isNextB) return 1;

      const isPastA = endA.getTime() < today.getTime();
      const isPastB = endB.getTime() < today.getTime();

      if (!isPastA && isPastB) return -1;
      if (isPastA && !isPastB) return 1;

      // If both are past, sort descending (newest past event first)
      if (isPastA && isPastB) {
        return startB.getTime() - startA.getTime();
      }

      // If both are future, sort ascending (closest future event first)
      return startA.getTime() - startB.getTime();
    });
  }, [events, filterSociety, filterDiscipline, filterMonth, restrictToSociety, user, nextUpcomingEventId, viewMode, hasSocietaAccess, hasTiratoriAccess, filterRegistrationOpen]);

  const managedEvents = React.useMemo(() => {
    console.log('EventsManager: Calculating managedEvents', { user, eventsCount: events.length });
    if (!user) {
      console.log('EventsManager: No user, returning empty managedEvents');
      return [];
    }

    // Societies should always be able to see their own managed events
    // even if they don't have general results access
    
    const userSociety = (user.society || '').toLowerCase().trim();
    const userId = Number(user.id);

    const filtered = events.filter(ev => {
      if (user.role === 'admin') return true;
      
      const isCreator = Number(ev.created_by) === userId;
      const eventLocation = (ev.location || '').toLowerCase().trim();
      const isSocietyLocation = userSociety !== '' && eventLocation === userSociety;
      
      return isCreator || isSocietyLocation;
    });

    console.log('EventsManager: managedEvents filtered count:', filtered.length);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return filtered.sort((a, b) => {
      const startA = new Date(a.start_date);
      startA.setHours(0, 0, 0, 0);
      const endA = new Date(a.end_date || a.start_date);
      endA.setHours(0, 0, 0, 0);

      const startB = new Date(b.start_date);
      startB.setHours(0, 0, 0, 0);
      const endB = new Date(b.end_date || b.start_date);
      endB.setHours(0, 0, 0, 0);

      const isPastA = endA < today;
      const isPastB = endB < today;

      // If one is past and the other is not, non-past comes first
      if (!isPastA && isPastB) return -1;
      if (isPastA && !isPastB) return 1;

      // If both are past, sort descending (newest past event first)
      if (isPastA && isPastB) {
        return startB.getTime() - startA.getTime();
      }

      // If both are future, sort ascending (closest future event first)
      return startA.getTime() - startB.getTime();
    });
  }, [events, user, hasSocietaAccess]);

  const handleQuickRegister = async (event: SocietyEvent) => {
    if (!user) {
      triggerToast?.('Devi essere loggato per iscriverti', 'error');
      return;
    }

    // Se non ha il telefono, apriamo il modal completo
    if (!user.phone) {
      setRegisteringEvent(event);
      return;
    }

    triggerConfirm(
      'Iscrizione Rapida',
      `Vuoi iscriverti alla gara "${event.name}"? Verranno usati i tuoi dati di profilo predefiniti.`,
      async () => {
        try {
          const response = await fetch(`/api/events/${event.id}/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              registration_day: 'Giorno1',
              registration_type: 'Iscrizione per Categoria',
              shotgun_brand: 'Beretta',
              shotgun_model: '',
              cartridge_brand: 'Fiocchi',
              cartridge_model: '',
              shooting_session: 'Mattina',
              notes: 'Iscrizione rapida',
              phone: user.phone
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante la registrazione');
          }

          triggerToast?.('Iscrizione completata!', 'success');
          fetchEvents();
          if (selectedEvent?.id === event.id) setSelectedEvent(null);
        } catch (err: any) {
          triggerToast?.(err.message, 'error');
        }
      },
      'Conferma Iscrizione'
    );
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const calendarDays = React.useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const totalSlots = Math.ceil((days + firstDay) / 7) * 7;
    
    const calendar = [];
    for (let i = 0; i < totalSlots; i++) {
      const dayNum = i - firstDay + 1;
      if (dayNum > 0 && dayNum <= days) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        calendar.push({ day: dayNum, date: dateStr, isCurrentMonth: true });
      } else {
        calendar.push({ day: null, date: null, isCurrentMonth: false });
      }
    }
    return calendar;
  }, [currentMonth]);

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
    setSelectedDay(null);
  };

  const renderResultsHeader = () => {
    const isAdmin = user?.role === 'admin';
    const isSociety = user?.role === 'society';
    const showTabs = isAdmin || (isSociety && hasSocietaAccess);

    return (
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-500 flex items-center justify-center text-lg">
              <i className="fas fa-trophy"></i>
            </div>
            Classifiche e Risultati
          </h2>
          <p className="text-slate-500 text-sm font-medium ml-13">
            Consulta i risultati ufficiali delle gare concluse e visualizza i dettagli dei punteggi.
          </p>
        </div>

        {showTabs && (
          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800 w-fit">
            <button 
              onClick={() => setViewMode('results')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'results' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-poll"></i> Risultati
            </button>
            <button 
              onClick={() => setViewMode('managed')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'managed' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-tasks"></i> Gestione
              {managedEvents.length > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${viewMode === 'managed' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  {managedEvents.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderManagedView = () => {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderResultsHeader()}

        {managedEvents.length === 0 ? (
          <div className="py-24 text-center bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-slate-800/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center text-slate-700 text-3xl shadow-inner">
                <i className="fas fa-calendar-times"></i>
              </div>
              <div className="max-w-md mx-auto px-6">
                <h4 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-2">Nessuna gara da gestire</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Qui appariranno le gare organizzate dalla tua società o quelle di cui sei amministratore.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {managedEvents.map(ev => {
              const isPast = isPastEvent(ev);
              return (
                <div key={ev.id} className={`rounded-[2rem] border p-8 transition-all group shadow-2xl relative overflow-hidden flex flex-col h-full ${isPast ? 'bg-slate-950/30 border-slate-700 opacity-60 grayscale hover:opacity-80' : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50'}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-600/10 transition-colors"></div>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                            {ev.discipline}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${ev.status === 'validated' ? 'bg-green-600/20 text-green-400 border-green-500/20' : 'bg-orange-600/20 text-orange-400 border-orange-500/20'}`}>
                            {ev.status === 'validated' ? 'Conclusa' : 'In Corso'}
                          </span>
                          {isPast && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-slate-700">
                              Passata
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight line-clamp-2 group-hover:text-indigo-400 transition-colors leading-tight">{ev.name}</h3>
                        <div className="flex flex-col gap-1 mt-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <i className="fas fa-calendar-alt text-indigo-500/50 w-4"></i>
                            {new Date(ev.start_date || '').toLocaleDateString('it-IT')}
                          </p>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <i className="fas fa-map-marker-alt text-indigo-500/50 w-4"></i>
                            {ev.location || 'Campo N.D.'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 text-center flex flex-col items-center justify-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Iscritti</div>
                        <div className="text-2xl font-black text-white">{ev.registration_count || 0}</div>
                      </div>
                      <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 text-center flex flex-col items-center justify-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Piattelli</div>
                        <div className="text-2xl font-black text-white">{ev.targets}</div>
                      </div>
                    </div>

                    <div className="mt-auto space-y-3">
                      {!ev.is_management_enabled && user?.role !== 'admin' && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 mb-2">
                          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest text-center flex items-center justify-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i>
                            In attesa di attivazione Admin
                          </p>
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          if (!ev.is_management_enabled && user?.role !== 'admin') {
                            triggerToast?.('Questa gara non è stata ancora attivata dall\'amministratore.', 'info');
                            return;
                          }
                          setInitialManagementTab('registrations');
                          setManagingEventDetail(ev);
                        }}
                        disabled={!ev.is_management_enabled && user?.role !== 'admin'}
                        className={`w-full py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3 ${
                          !ev.is_management_enabled && user?.role !== 'admin'
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700'
                            : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                        }`}
                      >
                        <i className="fas fa-users-cog text-sm"></i>
                        Gestione Gara
                      </button>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => {
                            if (!ev.is_management_enabled && user?.role !== 'admin') {
                              triggerToast?.('Questa gara non è stata ancora attivata dall\'amministratore.', 'info');
                              return;
                            }
                            setInitialManagementTab('results');
                            setManagingEventDetail(ev);
                          }}
                          disabled={!ev.is_management_enabled && user?.role !== 'admin'}
                          className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border flex items-center justify-center gap-2 ${
                            !ev.is_management_enabled && user?.role !== 'admin'
                              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                              : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
                          }`}
                        >
                          <i className="fas fa-trophy"></i>
                          Classifica
                        </button>
                        {(user?.role === 'admin' || (user?.role === 'society' && ev.location === user?.society)) && (
                          <button 
                            onClick={() => handleEdit(ev)}
                            className="py-3 rounded-2xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all active:scale-95 border border-slate-700 flex items-center justify-center gap-2"
                          >
                            <i className="fas fa-edit"></i>
                            Modifica
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const isDateInRange = (dateStr: string, ev: SocietyEvent) => {
    const check = new Date(dateStr).getTime();
    const start = new Date(ev.start_date).getTime();
    const end = new Date(ev.end_date).getTime();
    return check >= start && check <= end;
  };

  const eventsByDate = React.useMemo(() => {
    const map: Record<string, SocietyEvent[]> = {};
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      filteredEvents.forEach(ev => {
        if (isDateInRange(dateStr, ev)) {
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(ev);
        }
      });
    }
    return map;
  }, [filteredEvents, currentMonth]);

  const isPastEvent = (ev: SocietyEvent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(ev.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate.getTime() < today.getTime();
  };

  const isOngoingEvent = (ev: SocietyEvent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(ev.start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(ev.end_date);
    endDate.setHours(0, 0, 0, 0);
    return today >= startDate && today <= endDate;
  };

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('Regionale');
  const [visibility, setVisibility] = useState('Gara di Società');
  const [discipline, setDiscipline] = useState<Discipline>(Discipline.CK);
  const [location, setLocation] = useState(user?.role === 'society' ? user.society : '');
  const [targets, setTargets] = useState<number>(50);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [registrationLink, setRegistrationLink] = useState('');
  const [rankingPreferenceOverride, setRankingPreferenceOverride] = useState<'categoria' | 'qualifica' | null>(null);
  const [hasSocietyRanking, setHasSocietyRanking] = useState(false);
  const [hasTeamRanking, setHasTeamRanking] = useState(false);

  const fetchEvents = async (signal?: AbortSignal) => {
    console.log('EventsManager: fetchEvents called', { hasToken: !!token });
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      console.log('EventsManager: fetchEvents response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('EventsManager: fetchEvents data received, count:', data.length);
        setEvents(data);
      } else {
        console.error('EventsManager: fetchEvents failed with status:', res.status);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal);
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (managingResultsEvent) {
      const updated = events.find(e => e.id === managingResultsEvent.id);
      if (updated) setManagingResultsEvent(updated);
    }
    if (viewingResultsEvent) {
      const updated = events.find(e => e.id === viewingResultsEvent.id);
      if (updated) setViewingResultsEvent(updated);
    }
  }, [events]);

  const handleEdit = (ev: SocietyEvent) => {
    setEditingEvent(ev);
    setName(ev.name);
    setType(ev.type);
    setVisibility(ev.visibility);
    setDiscipline(ev.discipline as Discipline);
    setLocation(ev.location);
    setTargets(ev.targets);
    setStartDate(ev.start_date);
    setEndDate(ev.end_date);
    setCost(ev.cost || '');
    setNotes(ev.notes || '');
    setPosterUrl(ev.poster_url || '');
    setRegistrationLink(ev.registration_link || '');
    setRankingPreferenceOverride(ev.ranking_preference_override || null);
    setHasSocietyRanking(ev.has_society_ranking || false);
    setHasTeamRanking(ev.has_team_ranking || false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReopen = async (eventId: string) => {
    triggerConfirm(
      'Riapri Gara',
      'Sei sicuro di voler riaprire questa gara? La società potrà nuovamente modificare i risultati.',
      async () => {
        try {
          const res = await fetch(`/api/events/${eventId}/reopen`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchEvents();
          } else {
            const err = await res.json();
            if (triggerToast) {
              triggerToast(err.error || 'Errore durante la riapertura della gara', 'error');
            }
          }
        } catch (err) {
          console.error('Error reopening event:', err);
          if (triggerToast) {
            triggerToast('Errore durante la riapertura della gara', 'error');
          }
        }
      },
      'Riapri',
      'primary'
    );
  };

  const resetForm = () => {
    setEditingEvent(null);
    setName('');
    setType('Regionale');
    setVisibility('Gara di Società');
    setDiscipline(Discipline.CK);
    setLocation(user?.role === 'society' ? user.society : '');
    setTargets(50);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setCost('');
    setNotes('');
    setPosterUrl('');
    setRegistrationLink('');
    setRankingPreferenceOverride(null);
    setHasSocietyRanking(false);
    setHasTeamRanking(false);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const eventData = {
      id: editingEvent ? editingEvent.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now().toString(36)),
      name,
      type,
      visibility,
      discipline,
      location,
      targets,
      start_date: startDate,
      end_date: endDate,
      cost,
      notes,
      poster_url: posterUrl,
      registration_link: registrationLink,
      ranking_preference_override: rankingPreferenceOverride,
      has_society_ranking: hasSocietyRanking,
      has_team_ranking: hasTeamRanking
    };

    try {
      const res = await fetch(editingEvent ? `/api/events/${editingEvent.id}` : '/api/events', {
        method: editingEvent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      if (res.ok) {
        fetchEvents();
        resetForm();
      } else {
        const errorData = await res.json();
        if (triggerToast) {
          triggerToast(`Errore: ${errorData.error || res.statusText}`, 'error');
        } else {
          console.error(`Errore: ${errorData.error || res.statusText}`);
        }
      }
    } catch (err) {
      console.error('Error saving event:', err);
      if (triggerToast) {
        triggerToast('Errore di rete nel salvataggio.', 'error');
      }
    }
  };

  const handleDelete = (id: string) => {
    triggerConfirm(
      'Elimina Evento',
      'Sei sicuro di voler eliminare questo evento?',
      async () => {
        try {
          const res = await fetch(`/api/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setEvents(events.filter(e => e.id !== id));
          } else {
            const errorData = await res.json();
            if (triggerToast) {
              triggerToast(`Errore: ${errorData.error || res.statusText}`, 'error');
            }
          }
        } catch (err) {
          console.error('Error deleting event:', err);
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        if (triggerToast) {
          triggerToast('Il file è troppo grande. Dimensione massima: 5MB', 'error');
        }
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportExcel = () => {
    if (filteredEvents.length === 0) {
      if (triggerToast) {
        triggerToast('Nessun evento da esportare.', 'info');
      }
      return;
    }

    const exportData = filteredEvents.map(ev => ({
      'Nome Gara': ev.name,
      'Tipologia': ev.type,
      'Visibilità': ev.visibility,
      'Disciplina': ev.discipline,
      'Società': ev.location,
      'Piattelli': ev.targets,
      'Data Inizio': ev.start_date,
      'Data Fine': ev.end_date,
      'Costo': ev.cost || '',
      'Note': ev.notes || '',
      'Link Iscrizione': ev.registration_link || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eventi');
    XLSX.writeFile(wb, 'esportazione_eventi.xlsx');
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          if (triggerToast) {
            triggerToast('Il file Excel è vuoto.', 'error');
          }
          return;
        }

        const parseExcelDate = (dateVal: any) => {
          if (!dateVal) return new Date().toISOString().split('T')[0];
          if (dateVal instanceof Date) {
            const d = new Date(dateVal.getTime() - dateVal.getTimezoneOffset() * 60000);
            return d.toISOString().split('T')[0];
          }
          if (typeof dateVal === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
            const parts = dateVal.split(/[\/\-]/);
            if (parts.length === 3 && parts[2].length === 4) {
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString().split('T')[0];
            }
          }
          return new Date().toISOString().split('T')[0];
        };

        const importedEvents = data.map(row => ({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now().toString(36)),
          name: row['Nome Gara'] || 'Gara senza nome',
          type: row['Tipologia'] || 'Regionale',
          visibility: row['Visibilità'] || 'Pubblica',
          discipline: row['Disciplina'] || Discipline.CK,
          location: row['Società'] || '',
          targets: parseInt(row['Piattelli']) || 50,
          start_date: parseExcelDate(row['Data Inizio']),
          end_date: parseExcelDate(row['Data Fine'] || row['Data Inizio']),
          cost: row['Costo']?.toString() || '',
          notes: row['Note'] || '',
          registration_link: row['Link Iscrizione'] || ''
        }));

        triggerConfirm(
          'Importa',
          `Sei sicuro di voler importare ${importedEvents.length} gare dal file Excel?`,
          async () => {
            setLoading(true);
            try {
              for (const ev of importedEvents) {
                await fetch('/api/events', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(ev)
                });
              }
              fetchEvents();
              if (triggerToast) {
                triggerToast('Importazione completata con successo!', 'success');
              }
            } catch (err) {
              console.error('Error importing events:', err);
              if (triggerToast) {
                triggerToast('Errore durante l\'importazione di alcune gare.', 'error');
              }
            } finally {
              setLoading(false);
            }
          },
          'Importa',
          'primary'
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        if (triggerToast) {
          triggerToast('Errore nella lettura del file Excel. Assicurati che il formato sia corretto.', 'error');
        }
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleBulkDelete = () => {
    if (selectedEvents.length === 0) return;
    triggerConfirm(
      'Elimina Gare',
      `Sei sicuro di voler eliminare ${selectedEvents.length} gare selezionate?`,
      async () => {
        setLoading(true);
        try {
          for (const id of selectedEvents) {
            await fetch(`/api/events/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
          fetchEvents();
          setSelectedEvents([]);
        } catch (err) {
          console.error('Error deleting events:', err);
          if (triggerToast) {
            triggerToast('Errore durante l\'eliminazione delle gare.', 'error');
          }
        } finally {
          setLoading(false);
        }
      },
      'Elimina',
      'danger'
    );
  };

  if (loading) return <div className="p-8 text-center text-slate-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  const renderCalendarView = () => {
    const today = new Date().toISOString().split('T')[0];
    const monthName = currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    return (
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Calendar Column */}
        <div className="w-full lg:w-7/12 xl:w-1/2 bg-slate-900/40 rounded-[2rem] p-6 border border-slate-800/50 shadow-2xl overflow-hidden backdrop-blur-sm relative h-fit">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">{monthName.split(' ')[0]}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">{monthName.split(' ')[1]}</p>
            </div>
            <div className="flex gap-1.5 bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800">
              <button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white hover:bg-orange-600 transition-all active:scale-90"><i className="fas fa-chevron-left text-xs"></i></button>
              <button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white hover:bg-orange-600 transition-all active:scale-90"><i className="fas fa-chevron-right text-xs"></i></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4 relative z-10">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-black text-slate-500 uppercase tracking-[0.2em] py-2">
                {day.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 relative z-10">
            {calendarDays.map((slot, idx) => {
              const dayEvents = slot.date ? eventsByDate[slot.date] : null;
              const isToday = slot.date === today;
              const isSelected = slot.date === selectedDay;
              
              let highlightClass = 'bg-slate-900/40 border-slate-800/60 hover:border-slate-600 hover:bg-slate-800/60';
              let glowClass = '';
              
              if (dayEvents && dayEvents.length > 0) {
                const hasComp = dayEvents.some(e => e.discipline !== Discipline.TRAINING);
                const hasOngoing = dayEvents.some(e => {
                  const compDate = new Date(e.start_date);
                  compDate.setHours(0, 0, 0, 0);
                  const endDate = e.end_date ? new Date(e.end_date) : compDate;
                  endDate.setHours(0, 0, 0, 0);
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  return todayDate >= compDate && todayDate <= endDate;
                });
                const hasNextUpcoming = dayEvents.some(e => e.id === nextUpcomingEventId);

                if (hasOngoing) {
                  highlightClass = 'bg-orange-950/40 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] text-orange-500 z-10';
                  glowClass = 'animate-pulse';
                } else if (hasNextUpcoming) {
                  highlightClass = 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-emerald-500 z-10';
                } else {
                  highlightClass = hasComp 
                    ? 'bg-orange-600/10 border-orange-500/30 text-orange-500' 
                    : 'bg-blue-600/10 border-blue-500/30 text-blue-400';
                  glowClass = hasComp ? 'shadow-[0_0_15px_rgba(234,88,12,0.1)]' : 'shadow-[0_0_15px_rgba(59,130,246,0.1)]';
                }
              }

              return (
                <div 
                  key={idx} 
                  onClick={() => slot.date && setSelectedDay(slot.date)}
                  className={`aspect-square rounded-xl sm:rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all border ${!slot.isCurrentMonth ? 'opacity-0 pointer-events-none' : ''} ${isSelected ? 'border-orange-600 bg-orange-600/20 scale-105 z-10' : highlightClass} ${glowClass}`}
                >
                  <span className={`font-black ${isToday ? 'text-white bg-orange-600 w-7 h-7 sm:w-9 sm:h-9 text-sm sm:text-base flex items-center justify-center rounded-full shadow-lg shadow-orange-600/20' : isSelected ? 'text-white text-base sm:text-lg' : 'text-slate-300 text-sm sm:text-base'}`}>
                    {slot.day}
                  </span>
                  {dayEvents && dayEvents.length > 0 && !isToday && (
                    <div className="absolute bottom-1.5 sm:bottom-2 flex gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${dayEvents.some(c => c.discipline !== Discipline.TRAINING) ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Details Column */}
        <div className="w-full lg:w-5/12 xl:w-1/2 flex flex-col">
          {selectedDay ? (
            <div className="bg-slate-900/40 rounded-[2rem] p-6 border border-slate-800/50 shadow-xl h-full animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/50">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">
                    Eventi del Giorno
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    {new Date(selectedDay).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setSelectedDay(null)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"><i className="fas fa-times text-xs"></i></button>
              </div>
              
              {!eventsByDate[selectedDay] || eventsByDate[selectedDay].length === 0 ? (
                <div className="bg-slate-950/30 p-8 rounded-2xl border border-dashed border-slate-800 text-center flex flex-col items-center justify-center h-48">
                  <i className="fas fa-calendar-times text-slate-700 text-3xl mb-3"></i>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nessun evento registrato</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {eventsByDate[selectedDay].map(ev => {
                    const past = isPastEvent(ev);
                    const ongoing = isOngoingEvent(ev);
                    const isNext = ev.id === nextUpcomingEventId;
                    
                    return (
                    <div 
                      key={ev.id} 
                      onClick={() => setSelectedEvent(ev)}
                      className={`border rounded-2xl p-4 relative flex flex-col gap-4 cursor-pointer transition-all group shadow-sm hover:shadow-md overflow-hidden ${past ? 'bg-slate-950/30 border-slate-800/50 opacity-60 grayscale hover:opacity-80' : ongoing ? 'bg-orange-900/10 border-orange-500/30 hover:bg-orange-900/20' : isNext ? 'bg-slate-900/80 border-slate-700 hover:bg-slate-800' : 'bg-slate-950/50 border-slate-800 hover:bg-slate-900/50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {ongoing && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-orange-500 text-white animate-pulse shadow-lg shadow-orange-500/20">
                                IN CORSO
                              </span>
                            )}
                            {isNext && !ongoing && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-slate-700 text-white shadow-lg">
                                PROSSIMA GARA
                              </span>
                            )}
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${ev.discipline === Discipline.TRAINING ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-orange-900/30 text-orange-500 border border-orange-900/50'}`}>
                              {ev.discipline.split(' ')[0]}
                            </span>
                            {ev.start_date !== ev.end_date && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-purple-900/30 text-purple-400 border border-purple-900/50">
                                Multigiorno
                              </span>
                            )}
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${ev.visibility === 'Pubblica' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                              {ev.visibility}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-white truncate group-hover:text-orange-500 transition-colors uppercase italic tracking-tight">{ev.name}</h3>
                          <p className="text-[10px] text-slate-400 mt-1 truncate">
                            <i className="fas fa-map-marker-alt mr-1"></i>
                            {ev.location}
                            {societies.find(s => s.name === ev.location)?.code && (
                              <span className="text-orange-500 ml-1">({societies.find(s => s.name === ev.location)?.code})</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-white leading-none">{ev.targets}</div>
                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Piattelli</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-3 border-t border-slate-800/50">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-calendar-alt text-slate-600"></i>
                          <span>{new Date(ev.start_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <i className="fas fa-tag text-slate-600"></i>
                          <span>{ev.type}</span>
                        </div>
                      </div>

                      <div className="absolute top-0 right-0 w-16 h-16 bg-orange-600/5 rounded-full blur-2xl -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/20 rounded-[2rem] p-6 border border-slate-800/30 h-full flex flex-col items-center justify-center text-center min-h-[300px] lg:min-h-0">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <i className="fas fa-hand-pointer text-slate-600 text-2xl"></i>
              </div>
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Seleziona una data</h4>
              <p className="text-xs text-slate-500 max-w-[200px]">Clicca su un giorno del calendario per visualizzare i dettagli degli eventi.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {managingEventDetail ? (
        <EventManagementDetail 
          event={managingEventDetail} 
          onClose={() => setManagingEventDetail(null)} 
          initialTab={initialManagementTab}
          user={user}
          token={token}
          triggerConfirm={triggerConfirm}
          triggerToast={triggerToast}
          societies={societies}
          setManagingResultsEvent={setManagingResultsEvent}
          setViewingResultsEvent={setViewingResultsEvent}
          onRegisterShooter={() => setRegisteringEvent(managingEventDetail)}
          refreshVersion={refreshDetailVersion}
        />
      ) : (
        <>
          <div className="sticky top-16 sm:top-[104px] z-30 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 border-b border-slate-900/50 shadow-2xl transition-all">
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <i className={`fas ${viewMode === 'results' ? 'fa-trophy' : 'fa-calendar-alt'} text-orange-500`}></i> 
                    {viewMode === 'results' ? 'Risultati Gare' : (restrictToSociety ? 'Gestione delle tue Gare' : 'Gestione Eventi')}
                  </h2>
                  {!showForm && viewMode !== 'results' && (
                    <p className="text-slate-400 text-[9px] sm:text-xs mt-0.5 leading-tight max-w-2xl">
                      {restrictToSociety 
                        ? "In questa sezione puoi gestire le iscrizioni dei tuoi tiratori, formare le squadre per le competizioni e monitorare le gare a cui partecipa la tua società."
                        : "Calendario ufficiale delle competizioni. Esplora le gare pubbliche organizzate dalle società, consulta i programmi e segui i risultati in tempo reale."}
                    </p>
                  )}
                </div>
                
                {!showForm && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {user?.role === 'admin' && (
                      <div className="hidden sm:flex items-center gap-2">
                        <button 
                          onClick={handleExportExcel}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-black uppercase transition-all active:scale-95"
                          title="Esporta Excel"
                        >
                          <i className="fas fa-file-excel"></i> Esporta
                        </button>
                        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-black uppercase transition-all active:scale-95 cursor-pointer" title="Importa Excel">
                          <i className="fas fa-file-import"></i> Importa
                          <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
                        </label>
                      </div>
                    )}
                    
                    {(user?.role === 'admin' || user?.role === 'society') && viewMode !== 'results' && (
                      <button 
                        onClick={() => {
                          resetForm();
                          setShowForm(true);
                        }}
                        className="hidden items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-500 text-[10px] sm:text-xs font-black uppercase transition-all shadow-lg shadow-orange-600/20 active:scale-95"
                      >
                        <i className="fas fa-plus"></i> <span className="hidden sm:inline">Nuovo Evento</span>
                      </button>
                    )}
                    
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[9px] sm:text-xs font-black uppercase transition-all border relative ${showFilters || hasActiveFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
                    >
                      <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'}`}></i> Filtri
                      {hasActiveFilters && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                      )}
                    </button>

                    {!hideViewSwitcher && (
                      <div className="flex bg-slate-900 p-0.5 sm:p-1 rounded-xl border border-slate-800 shrink-0">
                        <button 
                          onClick={() => setViewMode('list')} 
                          className={`flex items-center justify-center w-8 sm:w-auto sm:px-3 h-7 sm:h-9 rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                          title="Elenco"
                        >
                          <i className="fas fa-list"></i>
                          <span className="hidden sm:inline ml-2">Elenco</span>
                        </button>
                        <button 
                          onClick={() => setViewMode('calendar')} 
                          className={`flex items-center justify-center w-8 sm:w-auto sm:px-3 h-7 sm:h-9 rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                          title="Calendario"
                        >
                          <i className="fas fa-calendar-alt"></i>
                          <span className="hidden sm:inline ml-2">Calendario</span>
                        </button>
                        {(user?.role === 'admin' || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess)) && (
                          <button 
                            onClick={() => setViewMode('results')} 
                            className={`flex items-center justify-center w-8 sm:w-auto sm:px-3 h-7 sm:h-9 rounded-lg text-[9px] sm:text-[10px] font-black uppercase transition-all ${viewMode === 'results' || viewMode === 'managed' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                            title="Risultati"
                          >
                            <i className="fas fa-trophy"></i>
                            <span className="hidden sm:inline ml-2">Risultati</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

      <div className="pt-4">
        {!showForm && showFilters && (
          <div className={`grid grid-cols-1 ${restrictToSociety && user?.role === 'society' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4 mb-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 animate-in zoom-in-95 duration-300`}>
            {!(restrictToSociety && user?.role === 'society') && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società TAV</label>
                <SocietySearch 
                  value={filterSociety}
                  onChange={setFilterSociety}
                  societies={societies}
                  placeholder="Tutte le società"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
              <div className="relative group">
                <select 
                  value={filterDiscipline} 
                  onChange={e => setFilterDiscipline(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                >
                  <option value="">Tutte le discipline</option>
                  {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <i className="fas fa-chevron-down text-[10px]"></i>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mese</label>
              <div className="relative group">
                <input 
                  type="month" 
                  value={filterMonth} 
                  onChange={e => setFilterMonth(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                  style={{ colorScheme: 'dark' }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <i className="fas fa-calendar-alt text-xs"></i>
                </div>
              </div>
            </div>

            <div className={`${restrictToSociety && user?.role === 'society' ? 'sm:col-span-2' : 'sm:col-span-3'} flex justify-end`}>
              <button 
                onClick={() => { setFilterSociety(''); setFilterDiscipline(''); setFilterMonth(''); }}
                className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
              >
                Resetta Filtri
              </button>
            </div>
          </div>
        )}
      
      {showForm && createPortal(
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <i className="fas fa-calendar-plus text-orange-500"></i>
                  {editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}
                </h3>
                <button 
                  onClick={resetForm}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto no-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Titolo / Nome Gara *</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipologia *</label>
                      <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                        <option value="Regionale">Regionale</option>
                        <option value="Nazionale">Nazionale</option>
                        <option value="Internazionale">Internazionale</option>
                        <option value="Allenamento">Allenamento</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Visibilità *</label>
                      <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                        <option value="Gara di Società">Gara di Società (Solo propri tiratori)</option>
                        <option value="Pubblica">Pubblica (Tutti)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina *</label>
                      <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                        {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Campo / TAV *</label>
                      {user?.role === 'admin' ? (
                        <SocietySearch 
                          value={location}
                          onChange={setLocation}
                          societies={societies}
                          placeholder="Seleziona Società"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all"
                        />
                      ) : (
                        <input type="text" value={location} disabled className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed" />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Piattelli Gara *</label>
                      <input type="number" required min="25" step="25" value={targets} onChange={(e) => setTargets(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Inizio *</label>
                      <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Fine *</label>
                      <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Costo (€)</label>
                      <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Link Iscrizione</label>
                      <input type="url" placeholder="https://..." value={registrationLink} onChange={(e) => setRegistrationLink(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Locandina / Programma</label>
                      <div className="flex items-center gap-4">
                        <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl px-4 py-3 text-center transition-all">
                          <span className="text-sm font-bold text-white"><i className="fas fa-upload mr-2"></i> Carica File (Max 5MB)</span>
                          <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                        </label>
                        {posterUrl && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center bg-slate-900">
                            {posterUrl.startsWith('data:application/pdf') ? (
                              <i className="fas fa-file-pdf text-2xl text-red-500"></i>
                            ) : (
                              <img src={posterUrl} alt="Locandina" className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-full space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Note</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all resize-none"></textarea>
                    </div>

                    {/* Ranking Preference Override */}
                    {type !== 'Allenamento' && (
                      <div className="col-span-full p-4 bg-orange-600/10 rounded-2xl border border-orange-500/20 space-y-4">
                        <div className="flex items-center gap-3 text-orange-500">
                          <i className="fas fa-exclamation-triangle"></i>
                          <h4 className="text-xs font-black uppercase tracking-widest">Precedenza Classifica (Override Evento)</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          Seleziona un'opzione per forzare la classifica di questa gara a prescindere dalla scelta del tiratore. 
                          Se impostato su "NESSUNO", verrà rispettata la scelta individuale di ogni tiratore.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setRankingPreferenceOverride(null)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              rankingPreferenceOverride === null 
                                ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-orange-500/50'
                            }`}
                          >
                            Nessuno
                          </button>
                          <button
                            type="button"
                            onClick={() => setRankingPreferenceOverride('categoria')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              rankingPreferenceOverride === 'categoria' 
                                ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-orange-500/50'
                            }`}
                          >
                            Forza Categoria
                          </button>
                          <button
                            type="button"
                            onClick={() => setRankingPreferenceOverride('qualifica')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              rankingPreferenceOverride === 'qualifica' 
                                ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-orange-500/50'
                            }`}
                          >
                            Forza Qualifica
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Classifica Società Toggle */}
                    <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                      <input
                        type="checkbox"
                        id="hasSocietyRanking"
                        checked={hasSocietyRanking}
                        onChange={(e) => setHasSocietyRanking(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 bg-slate-950"
                      />
                      <label htmlFor="hasSocietyRanking" className="text-sm font-bold text-slate-300">
                        Abilita Classifica per Società
                        <p className="text-xs font-normal text-slate-500 mt-1">
                          Calcola una classifica aggiuntiva sommando i 3 migliori risultati per ogni società.
                        </p>
                      </label>
                    </div>

                    {/* Classifica Squadre Toggle */}
                    <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                      <input
                        type="checkbox"
                        id="hasTeamRanking"
                        checked={hasTeamRanking}
                        onChange={(e) => setHasTeamRanking(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 bg-slate-950"
                      />
                      <label htmlFor="hasTeamRanking" className="text-sm font-bold text-slate-300">
                        Abilita Classifica Squadre
                        <p className="text-xs font-normal text-slate-500 mt-1">
                          Permette di creare squadre di 3 o 6 tiratori durante l'inserimento dei risultati.
                        </p>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
                    <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl text-xs font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
                      Annulla
                    </button>
                    <button type="submit" className="px-6 py-3 rounded-xl text-xs font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
                      {editingEvent ? 'Aggiorna' : 'Salva'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

        {viewMode === 'managed' ? (
          renderManagedView()
        ) : viewMode === 'calendar' ? (
          renderCalendarView()
        ) : viewMode === 'results' ? (
        <div className="space-y-6">
          {renderResultsHeader()}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-slate-950/30 rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-700 text-2xl">
                  <i className="fas fa-clipboard-list"></i>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nessun risultato disponibile</p>
                  <p className="text-slate-600 text-xs mt-1">Le classifiche verranno pubblicate al termine delle gare.</p>
                </div>
              </div>
            ) : (
              filteredEvents.map(ev => {
                const isAdmin = user?.role === 'admin';
                const isSocietyOwner = user?.role === 'society' && (ev.location === user?.society || ev.created_by === user?.id);
                const canManage = isAdmin || (isSocietyOwner && ev.status !== 'validated');
                
                return (
                  <div 
                    key={ev.id} 
                    onClick={() => {
                      const isAdmin = user?.role === 'admin';
                      const isSocietyOwner = user?.role === 'society' && (ev.location === user?.society || ev.created_by === user?.id);
                      const canManage = isAdmin || (isSocietyOwner && hasSocietaAccess && ev.status !== 'validated');
                      const canView = isAdmin || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess);

                      if (canManage) {
                        setManagingResultsEvent(ev);
                      } else if (canView) {
                        setViewingResultsEvent(ev);
                      }
                    }}
                    className={`group relative bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden hover:border-orange-500/50 transition-all duration-300 ${((user?.role === 'admin') || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess)) ? 'cursor-pointer hover:shadow-2xl hover:shadow-orange-500/10' : 'opacity-75 cursor-default'}`}
                  >
                    {/* Results Badge */}
                    {Number(ev.result_count) > 0 && (
                      <div className="absolute top-4 right-4 z-10">
                        <div className="bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg shadow-orange-500/20 flex items-center gap-1 animate-pulse">
                          <i className="fas fa-check-circle"></i>
                          RISULTATI CARICATI
                        </div>
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="font-black text-white text-xl group-hover:text-orange-500 transition-colors uppercase tracking-tight leading-tight mb-1">{ev.name}</h3>
                          <div className="flex flex-col gap-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <i className="fas fa-map-marker-alt text-orange-500/50 w-3"></i> {ev.location || 'Campo N.D.'}
                            </p>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-all shadow-lg">
                          <i className="fas fa-chevron-right"></i>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-slate-950/50 rounded-2xl p-3 border border-slate-800/50">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Data Gara</p>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            <i className="far fa-calendar text-orange-500"></i>
                            {new Date(ev.start_date || '').toLocaleDateString('it-IT')}
                          </p>
                        </div>
                        <div className="bg-slate-950/50 rounded-2xl p-3 border border-slate-800/50">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Stato</p>
                          <div className="flex items-center gap-2">
                            {ev.status === 'validated' ? (
                              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                                <i className="fas fa-check-circle"></i> Convalidata
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                                <i className="fas fa-clock"></i> In Corso
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                        <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          {ev.discipline}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {isAdmin && ev.status === 'validated' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReopen(ev.id);
                              }}
                              className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-500 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-600/5"
                              title="Riapri per modifica"
                            >
                              <i className="fas fa-unlock text-xs"></i>
                            </button>
                          )}
                          <button className="text-orange-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                            {canManage ? 'Gestisci' : 'Vedi Classifica'}
                            <i className="fas fa-arrow-right"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-orange-500/10 transition-colors"></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {user?.role === 'admin' && filteredEvents.length > 0 && (
            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer group px-2">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="peer sr-only"
                    checked={selectedEvents.length === filteredEvents.length && filteredEvents.length > 0}
                    onChange={() => {
                      if (selectedEvents.length === filteredEvents.length) {
                        setSelectedEvents([]);
                      } else {
                        setSelectedEvents(filteredEvents.map(e => e.id));
                      }
                    }}
                  />
                  <div className="w-5 h-5 rounded border-2 border-slate-600 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center">
                    <i className="fas fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">
                  Seleziona Tutti
                </span>
              </label>

              {selectedEvents.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <i className="fas fa-trash-alt"></i>
                  Elimina Selezionati ({selectedEvents.length})
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-600 italic text-sm bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                Nessun evento trovato.
              </div>
            ) : (
              filteredEvents.map(ev => {
                const past = isPastEvent(ev);
                const ongoing = isOngoingEvent(ev);
                const isNext = ev.id === nextUpcomingEventId;
                const isSelected = selectedEvents.includes(ev.id);
                
                return (
                <div 
                  key={ev.id} 
                  onClick={() => setSelectedEvent(ev)}
                  className={`border rounded-2xl p-4 relative flex flex-col gap-4 cursor-pointer transition-all group shadow-sm hover:shadow-md overflow-hidden ${isSelected ? 'ring-2 ring-orange-500 border-orange-500' : ''} ${past ? 'bg-slate-950/30 border-slate-700 opacity-60 grayscale hover:opacity-80' : ongoing ? 'bg-orange-900/10 border-orange-500/30 hover:bg-orange-900/20' : isNext ? 'bg-slate-900/80 border-slate-600 hover:bg-slate-800' : 'bg-slate-950/50 border-slate-700 hover:bg-slate-900/50'}`}
                >
                  {user?.role === 'admin' && (
                    <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
                      <label className="relative flex items-center justify-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="peer sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEvents([...selectedEvents, ev.id]);
                            } else {
                              setSelectedEvents(selectedEvents.filter(id => id !== ev.id));
                            }
                          }}
                        />
                        <div className="w-6 h-6 rounded-lg border-2 border-slate-600 bg-slate-900/80 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center backdrop-blur-sm">
                          <i className="fas fa-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {ongoing && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-orange-500 text-white animate-pulse shadow-lg shadow-orange-500/20">
                            IN CORSO
                          </span>
                        )}
                        {isNext && !ongoing && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-slate-700 text-white shadow-lg">
                            PROSSIMA GARA
                          </span>
                        )}
                        {past && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-slate-800 text-slate-400 border border-slate-700">
                            PASSATA
                          </span>
                        )}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${ev.discipline === Discipline.TRAINING ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-orange-900/30 text-orange-500 border border-orange-900/50'}`}>
                          {ev.discipline.split(' ')[0]}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${ev.visibility === 'Pubblica' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {ev.visibility}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-white truncate group-hover:text-orange-500 transition-colors uppercase italic tracking-tight">{ev.name}</h3>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">
                        <i className="fas fa-map-marker-alt mr-1"></i>
                        {ev.location}
                        {societies.find(s => s.name === ev.location)?.code && (
                          <span className="text-orange-500 ml-1">({societies.find(s => s.name === ev.location)?.code})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-3 border-t border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-calendar-alt text-slate-600"></i>
                      <span>{new Date(ev.start_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right shrink-0 flex items-center gap-1.5">
                        <div className="text-sm font-black text-white leading-none">{ev.targets}</div>
                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest pt-0.5">Piattelli</div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-0 right-0 w-16 h-16 bg-orange-600/5 rounded-full blur-2xl -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="relative min-h-[160px] bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 flex items-end p-4 sm:p-6 overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
              
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg z-20"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
              
              <div className="relative z-10 w-full pr-10 sm:pr-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${selectedEvent.discipline === Discipline.TRAINING ? 'bg-blue-900/40 text-blue-400 border border-blue-900/50' : 'bg-orange-900/40 text-orange-500 border border-orange-900/50'}`}>
                    {selectedEvent.discipline}
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${selectedEvent.visibility === 'Pubblica' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {selectedEvent.visibility}
                  </span>
                </div>
                <h2 
                  onClick={() => {
                    const canManage = user?.role === 'admin' || (user?.role === 'society' && hasSocietaAccess && (selectedEvent.location === user?.society || selectedEvent.created_by === user?.id));
                    const canView = user?.role === 'admin' || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess);
                    
                    if (canManage) {
                      setManagingResultsEvent(selectedEvent);
                      setSelectedEvent(null);
                    } else if (canView) {
                      setViewingResultsEvent(selectedEvent);
                      setSelectedEvent(null);
                    }
                  }}
                  className={`text-xl sm:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter break-words transition-colors ${((user?.role === 'admin') || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess)) ? 'cursor-pointer hover:text-orange-500' : ''}`}
                >
                  {selectedEvent.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <i className="fas fa-map-marker-alt text-orange-500"></i> 
                  {selectedEvent.location}
                  {societies.find(s => s.name === selectedEvent.location)?.code && (
                    <span className="text-orange-500 ml-1">({societies.find(s => s.name === selectedEvent.location)?.code})</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data Inizio</p>
                  <p className="text-sm font-bold text-white">{new Date(selectedEvent.start_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data Fine</p>
                  <p className="text-sm font-bold text-white">{new Date(selectedEvent.end_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipologia</p>
                  <p className="text-sm font-bold text-white">{selectedEvent.type}</p>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Piattelli</p>
                  <p className="text-sm font-bold text-white">{selectedEvent.targets} Bersagli</p>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Costo Iscrizione</p>
                  <p className="text-sm font-bold text-white">{selectedEvent.cost ? `€ ${parseFloat(selectedEvent.cost).toFixed(2)}` : 'Non specificato'}</p>
                </div>
              </div>

              {selectedEvent.notes && (
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Note e Informazioni</p>
                  <p className="text-sm text-slate-300 leading-relaxed italic">{selectedEvent.notes}</p>
                </div>
              )}

              {selectedEvent.registration_link && (selectedEvent.is_management_enabled || user?.role === 'admin') && (
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Iscrizione Online</p>
                    <p className="text-sm text-slate-300">Clicca sul pulsante per iscriverti alla gara.</p>
                  </div>
                  <a 
                    href={selectedEvent.registration_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 whitespace-nowrap active:scale-95"
                  >
                    <i className="fas fa-external-link-alt"></i> Iscriviti Ora
                  </a>
                </div>
              )}

              {selectedEvent.poster_url && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Locandina / Programma</p>
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video relative group">
                    {selectedEvent.poster_url.startsWith('data:application/pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                        <i className="fas fa-file-pdf text-5xl text-red-500"></i>
                        <span className="text-xs font-bold text-slate-400">Documento PDF</span>
                      </div>
                    ) : (
                      <img src={selectedEvent.poster_url} alt="Locandina" className="w-full h-full object-cover" />
                    )}
                    <a 
                      href={selectedEvent.poster_url} 
                      download={`Locandina_${selectedEvent.name.replace(/\s+/g, '_')}`}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white font-black uppercase text-xs tracking-widest"
                    >
                      <i className="fas fa-download text-xl"></i> Scarica File
                    </a>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 pt-6 border-t border-slate-800">
                {onParticipate && user?.role !== 'society' && (
                  <button 
                    onClick={() => {
                      onParticipate(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 active:scale-95 text-[9px] font-black uppercase tracking-widest"
                    title={user?.role === 'admin' ? 'Aggiungi a un tiratore' : 'Aggiungi alle mie gare'}
                  >
                    <i className="fas fa-calendar-plus"></i> Aggiungi
                  </button>
                )}

                {(user?.role === 'admin' || user?.role === 'society') && onCreateTeam && !isPastEvent(selectedEvent) && (
                  <button 
                    onClick={() => {
                      onCreateTeam(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95 text-[9px] font-black uppercase tracking-widest"
                    title="Crea Squadra"
                  >
                    <i className="fas fa-users"></i> Squadra
                  </button>
                )}
                
                {/* Classifica Button - Hidden if access is blocked */}
                {((user?.role === 'admin') || 
                  (user?.role === 'society' && hasSocietaAccess) || 
                  (user?.role === 'user' && hasTiratoriAccess)) && (
                  <button 
                    onClick={() => {
                      setViewingResultsEvent(selectedEvent);
                      setSelectedEvent(null);
                    }} 
                    className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-700 hover:text-white transition-all border border-slate-700 active:scale-95 text-[9px] font-black uppercase tracking-widest"
                    title="Classifica"
                  >
                    <i className="fas fa-trophy"></i> Classifica
                  </button>
                )}

                {/* Iscriviti Button for Shooters */}
                {(user?.role === 'user' || user?.role === 'admin') && !isPastEvent(selectedEvent) && (
                  <>
                    {!(selectedEvent.is_management_enabled || user?.role === 'admin') ? (
                      <div className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-slate-800/50 text-slate-500 flex items-center justify-center gap-2 border border-slate-800 text-[9px] font-black uppercase tracking-widest cursor-default">
                        <i className="fas fa-lock"></i> Iscrizioni non attive
                      </div>
                    ) : selectedEvent.is_registered ? (
                      <div className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-green-900/30 text-green-500 flex items-center justify-center gap-2 border border-green-900/50 text-[9px] font-black uppercase tracking-widest cursor-default">
                        <i className="fas fa-check-circle"></i> Già Iscritto
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            handleQuickRegister(selectedEvent);
                          }}
                          className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-green-600 text-white flex items-center justify-center gap-2 hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-600/20 text-[9px] font-black uppercase tracking-widest"
                        >
                          <i className="fas fa-bolt"></i> Iscr. Rapida
                        </button>
                        <button 
                          onClick={() => {
                            setRegisteringEvent(selectedEvent);
                            setSelectedEvent(null);
                          }}
                          className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-700 hover:text-white transition-all border border-slate-700 active:scale-95 text-[9px] font-black uppercase tracking-widest"
                        >
                          <i className="fas fa-list-ul"></i> Iscr. Dettagliata
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* Gestione Batterie Button for Societies/Admins */}
                {(user?.role === 'admin' || (user?.role === 'society' && hasSocietaAccess && (selectedEvent.location === user?.society || selectedEvent.created_by === user?.id))) && !isPastEvent(selectedEvent) && (
                  <button 
                    onClick={() => {
                      if (!selectedEvent.is_management_enabled && user?.role !== 'admin') {
                        triggerToast?.('Questa gara non è stata ancora attivata dall\'amministratore.', 'info');
                        return;
                      }
                      setManagingEventDetail(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    disabled={!selectedEvent.is_management_enabled && user?.role !== 'admin'}
                    className={`flex-1 min-w-[120px] h-9 px-3 rounded-xl text-white flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-[9px] font-black uppercase tracking-widest ${
                      !selectedEvent.is_management_enabled && user?.role !== 'admin'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                    }`}
                    title="Gestione Iscritti e Batterie"
                  >
                    <i className="fas fa-tasks"></i> Gestisci
                  </button>
                )}

                {(user?.role === 'admin' || (user?.role === 'society' && hasSocietaAccess) || (user?.role === 'user' && hasTiratoriAccess)) && (
                  <button 
                    onClick={() => {
                      const isAdmin = user?.role === 'admin';
                      const isSocietyOwner = user?.role === 'society' && (selectedEvent.location === user?.society || selectedEvent.created_by === user?.id);
                      const canManage = isAdmin || (isSocietyOwner && hasSocietaAccess && selectedEvent.status !== 'validated');
                      
                      if (canManage) {
                        setManagingResultsEvent(selectedEvent);
                      } else {
                        setViewingResultsEvent(selectedEvent);
                      }
                      setSelectedEvent(null);
                    }} 
                    className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-orange-600 text-white flex items-center justify-center gap-2 hover:bg-orange-500 transition-all active:scale-95 text-[9px] font-black uppercase tracking-widest"
                    title={user?.role === 'admin' || (user?.role === 'society' && (selectedEvent.location === user?.society || selectedEvent.created_by === user?.id)) ? "Gestisci Risultati" : "Vedi Risultati"}
                  >
                    <i className="fas fa-list-ol"></i> Risultati
                  </button>
                )}

                {(user?.role === 'admin' || (user?.role === 'society' && selectedEvent.location === user?.society)) && (
                  <>
                    <button 
                      onClick={() => {
                        handleEdit(selectedEvent);
                        setSelectedEvent(null);
                      }} 
                      className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-orange-600 text-white flex items-center justify-center gap-2 hover:bg-orange-500 transition-all active:scale-95 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-orange-600/20"
                      title="Modifica"
                    >
                      <i className="fas fa-edit"></i> Modifica
                    </button>
                    <button 
                      onClick={() => {
                        handleDelete(selectedEvent.id);
                        setSelectedEvent(null);
                      }} 
                      className="flex-1 min-w-[120px] h-9 px-3 rounded-xl bg-red-600 text-white flex items-center justify-center gap-2 hover:bg-red-500 transition-all active:scale-95 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20"
                      title="Elimina"
                    >
                      <i className="fas fa-trash-alt"></i> Elimina
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </>
  )}
      
      {managingResultsEvent && createPortal(
        <EventResultsManager
          event={managingResultsEvent}
          token={token}
          user={user}
          onClose={() => setManagingResultsEvent(null)}
          triggerConfirm={triggerConfirm}
          triggerToast={triggerToast}
          onEventUpdate={fetchEvents}
          societies={societies}
        />,
        document.body
      )}

      {viewingResultsEvent && createPortal(
        <EventResultsManager
          event={viewingResultsEvent}
          token={token}
          user={user}
          onClose={() => setViewingResultsEvent(null)}
          readOnly={true}
          triggerConfirm={triggerConfirm}
          triggerToast={triggerToast}
          societies={societies}
        />,
        document.body
      )}

      {registeringEvent && createPortal(
        <EventRegistrationModal
          event={registeringEvent}
          user={user}
          onClose={() => setRegisteringEvent(null)}
          onSuccess={() => {
            if (triggerToast) triggerToast('Iscrizione completata con successo!', 'success');
            fetchEvents();
            setRefreshDetailVersion(v => v + 1);
          }}
        />,
        document.body
      )}

      {managingSquadsEvent && createPortal(
        <EventSquadManager
          event={managingSquadsEvent}
          onClose={() => setManagingSquadsEvent(null)}
        />,
        document.body
      )}

    </div>
  );
};

export default EventsManager;
