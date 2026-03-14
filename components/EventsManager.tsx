import React, { useState, useEffect } from 'react';
import { SocietyEvent, Discipline } from '../types';

interface EventsManagerProps {
  user: any;
  token: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  societies: any[];
  onParticipate?: (event: SocietyEvent) => void;
  onCreateTeam?: (event: SocietyEvent) => void;
}

const EventsManager: React.FC<EventsManagerProps> = ({ user, token, triggerConfirm, societies, onParticipate, onCreateTeam }) => {
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SocietyEvent | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SocietyEvent | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const filteredEvents = React.useMemo(() => {
    return events.filter(ev => {
      if (filterSociety && ev.location !== filterSociety) return false;
      if (filterDiscipline && ev.discipline !== filterDiscipline) return false;
      if (filterMonth) {
        const evMonth = new Date(ev.start_date).toISOString().slice(0, 7);
        if (evMonth !== filterMonth) return false;
      }
      return true;
    });
  }, [events, filterSociety, filterDiscipline, filterMonth]);

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

  const fetchEvents = async () => {
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
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const eventData = {
      id: editingEvent ? editingEvent.id : crypto.randomUUID(),
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
      poster_url: posterUrl
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
        alert(`Errore: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error saving event:', err);
      alert('Errore di rete nel salvataggio.');
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
            alert(`Errore: ${errorData.error || res.statusText}`);
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
        alert('Il file è troppo grande. Dimensione massima: 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  const hasActiveFilters = filterSociety !== '' || filterDiscipline !== '' || filterMonth !== '';

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

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 relative z-10">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest py-2">
                {day}
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

                if (hasOngoing) {
                  highlightClass = 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/50';
                  glowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.2)]';
                } else if (hasComp) {
                  highlightClass = 'bg-orange-900/30 border-orange-500/50 text-orange-400 hover:bg-orange-900/50';
                  glowClass = 'shadow-[0_0_15px_rgba(249,115,22,0.2)]';
                } else {
                  highlightClass = 'bg-blue-900/30 border-blue-500/50 text-blue-400 hover:bg-blue-900/50';
                }
              } else if (isToday) {
                highlightClass = 'bg-slate-800/80 border-slate-600 text-white';
              }

              if (isSelected) {
                highlightClass = 'bg-white text-slate-900 border-white scale-105 z-10';
                glowClass = 'shadow-[0_0_20px_rgba(255,255,255,0.3)]';
              }

              return (
                <div 
                  key={idx} 
                  onClick={() => slot.date && setSelectedDay(slot.date)}
                  className={`
                    aspect-square rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center relative transition-all duration-300
                    ${slot.isCurrentMonth ? 'cursor-pointer' : 'opacity-20 pointer-events-none'}
                    ${highlightClass} ${glowClass}
                  `}
                >
                  {slot.day && (
                    <>
                      <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-slate-900' : (isToday && (!dayEvents || dayEvents.length === 0) ? 'text-white' : '')}`}>
                        {slot.day}
                      </span>
                      {dayEvents && dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-1 absolute bottom-1.5 sm:bottom-2">
                          {dayEvents.slice(0, 3).map((e, i) => (
                            <span key={i} className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-slate-900' : (e.discipline === Discipline.TRAINING ? 'bg-blue-400' : 'bg-orange-500')}`}></span>
                          ))}
                          {dayEvents.length > 3 && <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-slate-900' : 'bg-slate-400'}`}></span>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Details Column */}
        <div className="w-full lg:w-5/12 xl:w-1/2">
          {selectedDay ? (
            <div className="bg-slate-900/40 rounded-[2rem] p-6 border border-slate-800/50 shadow-2xl h-full backdrop-blur-sm animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/50">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {new Date(selectedDay).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {selectedDay === today && <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">Oggi</span>}
                </div>
                <button onClick={() => setSelectedDay(null)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"><i className="fas fa-times text-xs"></i></button>
              </div>
              
              {!eventsByDate[selectedDay] || eventsByDate[selectedDay].length === 0 ? (
                <div className="bg-slate-950/30 p-8 rounded-2xl border border-dashed border-slate-800 text-center flex flex-col items-center justify-center h-48">
                  <i className="fas fa-calendar-times text-slate-700 text-3xl mb-3"></i>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nessun evento registrato</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {eventsByDate[selectedDay].map(ev => (
                    <div 
                      key={ev.id} 
                      onClick={() => setSelectedEvent(ev)}
                      className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 relative flex flex-col gap-4 cursor-pointer hover:bg-slate-900/50 transition-all group shadow-sm hover:shadow-md overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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
                            {user?.role === 'admin' && ev.is_from_competition && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-amber-900/30 text-amber-500 border border-amber-900/50">
                                <i className="fas fa-history mr-1"></i> Registrata
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-black text-white truncate group-hover:text-orange-500 transition-colors uppercase italic tracking-tight">{ev.name}</h3>
                          <p className="text-[10px] text-slate-400 mt-1 truncate"><i className="fas fa-map-marker-alt mr-1"></i>{ev.location}</p>
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
                  ))}
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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <i className="fas fa-calendar-alt text-orange-500"></i> Gestione Eventi
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-start sm:justify-end">
          {!showForm && (
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
              <button onClick={() => setViewMode('list')} className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}><i className="fas fa-list text-sm"></i> <span>Lista</span></button>
              <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}><i className="fas fa-calendar-alt text-sm"></i> <span>Calendario</span></button>
            </div>
          )}
          {!showForm && (
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all flex items-center gap-1.5 shrink-0 border ${showFilters || hasActiveFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
            >
              <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'} text-sm`}></i>
              <span>Filtri</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              )}
            </button>
          )}
          {/* Button removed and replaced by floating button */}
        </div>
      </div>

      {!showForm && showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 animate-in zoom-in-95 duration-300">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società TAV</label>
            <select 
              value={filterSociety} 
              onChange={e => setFilterSociety(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
            >
              <option value="">Tutte le società</option>
              {societies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
            <select 
              value={filterDiscipline} 
              onChange={e => setFilterDiscipline(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
            >
              <option value="">Tutte le discipline</option>
              {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mese</label>
            <input 
              type="month" 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
            />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button 
              onClick={() => { setFilterSociety(''); setFilterDiscipline(''); setFilterMonth(''); }}
              className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
            >
              Resetta Filtri
            </button>
          </div>
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">{editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}</h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titolo / Nome Gara *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipologia *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                <option value="Regionale">Regionale</option>
                <option value="Nazionale">Nazionale</option>
                <option value="Internazionale">Internazionale</option>
                <option value="Allenamento">Allenamento</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visibilità *</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                <option value="Gara di Società">Gara di Società (Solo propri tiratori)</option>
                <option value="Pubblica">Gara Pubblica (Tutti)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Disciplina *</label>
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Campo / TAV *</label>
              {user?.role === 'admin' ? (
                <select value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">Seleziona Società</option>
                  {societies.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={location} disabled className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed" />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Piattelli Gara *</label>
              <input type="number" required min="25" step="25" value={targets} onChange={(e) => setTargets(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data Inizio *</label>
              <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data Fine *</label>
              <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Costo (€)</label>
              <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Locandina / Programma</label>
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-3 text-center transition-all">
                  <span className="text-sm font-bold text-white"><i className="fas fa-upload mr-2"></i> Carica File (Max 5MB)</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
                {posterUrl && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 flex items-center justify-center bg-slate-800">
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Note</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all resize-none"></textarea>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
            <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl text-xs font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
              Annulla
            </button>
            <button type="submit" className="px-6 py-3 rounded-xl text-xs font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
              {editingEvent ? 'Aggiorna' : 'Salva'}
            </button>
          </div>
        </form>
      ) : viewMode === 'calendar' ? (
        renderCalendarView()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-600 italic text-sm bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
              Nessun evento trovato.
            </div>
          ) : (
            filteredEvents.map(ev => (
              <div 
                key={ev.id} 
                onClick={() => setSelectedEvent(ev)}
                className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 relative flex flex-col gap-4 cursor-pointer hover:bg-slate-900/50 transition-all group shadow-sm hover:shadow-md overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${ev.discipline === Discipline.TRAINING ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-orange-900/30 text-orange-500 border border-orange-900/50'}`}>
                        {ev.discipline.split(' ')[0]}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${ev.visibility === 'Pubblica' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                        {ev.visibility}
                      </span>
                      {user?.role === 'admin' && ev.is_from_competition && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-amber-900/30 text-amber-500 border border-amber-900/50">
                          <i className="fas fa-history mr-1"></i> Registrata
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-white truncate group-hover:text-orange-500 transition-colors uppercase italic tracking-tight">{ev.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 truncate"><i className="fas fa-map-marker-alt mr-1"></i>{ev.location}</p>
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
            ))
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="relative h-40 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 flex items-end p-6 overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
              
              <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-800/80 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all z-10 border border-slate-700/50 backdrop-blur-sm shadow-lg">
                <i className="fas fa-times"></i>
              </button>
              
              <div className="relative z-10 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${selectedEvent.discipline === Discipline.TRAINING ? 'bg-blue-900/40 text-blue-400 border border-blue-900/50' : 'bg-orange-900/40 text-orange-500 border border-orange-900/50'}`}>
                    {selectedEvent.discipline}
                  </span>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${selectedEvent.visibility === 'Pubblica' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {selectedEvent.visibility}
                  </span>
                  {user?.role === 'admin' && selectedEvent.is_from_competition && (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider bg-amber-900/40 text-amber-500 border border-amber-900/50">
                      <i className="fas fa-history mr-1"></i> Gara Registrata
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-white leading-tight uppercase italic tracking-tighter">{selectedEvent.name}</h2>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <i className="fas fa-map-marker-alt text-orange-500"></i> {selectedEvent.location}
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

              <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
                {onParticipate && user?.role !== 'society' && (
                  <button 
                    onClick={() => {
                      onParticipate(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 py-4 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-plus"></i> Aggiungi alle mie gare
                  </button>
                )}

                {(user?.role === 'admin' || user?.role === 'society') && onCreateTeam && (
                  <button 
                    onClick={() => {
                      onCreateTeam(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-users"></i> Crea Squadra
                  </button>
                )}
                
                <div className="flex gap-2 w-full sm:w-auto">
                  {(user?.role === 'admin' || (user?.role === 'society' && selectedEvent.location === user.society)) && !selectedEvent.is_from_competition && (
                    <>
                      <button 
                        onClick={() => {
                          handleEdit(selectedEvent);
                          setSelectedEvent(null);
                        }} 
                        className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                        title="Modifica"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        onClick={() => {
                          handleDelete(selectedEvent.id);
                          setSelectedEvent(null);
                        }} 
                        className="w-12 h-12 rounded-2xl bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-900/30"
                        title="Elimina"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating Add Button for Events */}
      {(user?.role === 'admin' || user?.role === 'society') && (
        <button 
          onClick={() => {
            if (!showForm) resetForm();
            setShowForm(!showForm);
          }}
          className={`fixed bottom-8 right-8 w-16 h-16 ${showForm ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group`}
          title={showForm ? 'Chiudi' : 'Nuovo Evento'}
        >
          <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
        </button>
      )}
    </div>
  );
};

export default EventsManager;
