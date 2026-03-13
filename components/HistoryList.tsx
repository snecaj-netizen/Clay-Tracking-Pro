
import React, { useState, useMemo } from 'react';
import { Competition, CompetitionLevel, Discipline, getSeriesLayout } from '../types';

interface HistoryListProps {
  competitions: Competition[];
  onDelete: (id: string) => void;
  onEdit: (comp: Competition) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  user?: any;
}

const HistoryList: React.FC<HistoryListProps> = ({ competitions, onDelete, onEdit, triggerConfirm, user }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // Stati filtri
  const [filterDiscipline, setFilterDiscipline] = useState<string>('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CONCLUDED' | 'UPCOMING'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('ASC');
  const [showFilters, setShowFilters] = useState(false);

  // Estrazione opzioni filtri dai dati reali
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(competitions.map(c => c.location).filter(Boolean))).sort();
  }, [competitions]);

  // Applicazione filtri
  const filteredCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return competitions.filter(c => {
      const matchDisc = filterDiscipline === 'ALL' || c.discipline === filterDiscipline;
      const matchLoc = filterLocation === 'ALL' || c.location === filterLocation;
      
      const compDate = new Date(c.date);
      compDate.setHours(0, 0, 0, 0);
      
      let matchStatus = true;
      if (filterStatus === 'CONCLUDED') {
        matchStatus = compDate < today || (compDate.getTime() === today.getTime() && c.totalScore > 0);
      } else if (filterStatus === 'UPCOMING') {
        matchStatus = compDate > today || (compDate.getTime() === today.getTime() && c.totalScore === 0);
      }

      return matchDisc && matchLoc && matchStatus;
    });
  }, [competitions, filterDiscipline, filterLocation, filterStatus]);

  const sortedCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...filteredCompetitions].sort((a, b) => {
      const startA = new Date(a.date);
      startA.setHours(0, 0, 0, 0);
      const endA = a.endDate ? new Date(a.endDate) : startA;
      endA.setHours(0, 0, 0, 0);
      const isOngoingA = today >= startA && today <= endA;

      const startB = new Date(b.date);
      startB.setHours(0, 0, 0, 0);
      const endB = b.endDate ? new Date(b.endDate) : startB;
      endB.setHours(0, 0, 0, 0);
      const isOngoingB = today >= startB && today <= endB;

      if (isOngoingA && !isOngoingB) return -1;
      if (!isOngoingA && isOngoingB) return 1;

      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
    });
  }, [filteredCompetitions, sortOrder]);

  const nextUpcomingCompId = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureComps = competitions.filter(c => {
      const start = new Date(c.date);
      start.setHours(0, 0, 0, 0);
      return start > today;
    });
    
    if (futureComps.length === 0) return null;
    
    futureComps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return futureComps[0].id;
  }, [competitions]);

  // Helper per verificare se una data è compresa in un intervallo
  const isDateInRange = (checkDate: string, comp: Competition) => {
    if (!comp.endDate) return checkDate === comp.date;
    const check = new Date(checkDate).getTime();
    const start = new Date(comp.date).getTime();
    const end = new Date(comp.endDate).getTime();
    return check >= start && check <= end;
  };

  // Raggruppa competizioni filtrate per data per il calendario
  const compsByDate = useMemo(() => {
    const map: Record<string, Competition[]> = {};
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      filteredCompetitions.forEach(c => {
        if (isDateInRange(dateStr, c)) {
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(c);
        }
      });
    }
    return map;
  }, [filteredCompetitions, currentMonth]);

  const getLevelColor = (level: CompetitionLevel, discipline: Discipline) => {
    if (discipline === Discipline.TRAINING) return 'bg-slate-800 text-slate-400';
    switch (level) {
      case CompetitionLevel.REGIONAL: return 'bg-blue-900/30 text-blue-400';
      case CompetitionLevel.NATIONAL: return 'bg-fuchsia-900/30 text-fuchsia-400';
      case CompetitionLevel.INTERNATIONAL: return 'bg-yellow-900/30 text-yellow-500';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const calendarDays = useMemo(() => {
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

  const renderListView = () => (
    <div className="space-y-4 pt-4">
      {sortedCompetitions.length === 0 ? (
        <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center">
          <i className="fas fa-search text-slate-700 text-3xl mb-4"></i>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nessun risultato con i filtri attuali</p>
        </div>
      ) : (
        sortedCompetitions.map((comp) => {
          const compDate = new Date(comp.date);
          compDate.setHours(0, 0, 0, 0);
          const endDate = comp.endDate ? new Date(comp.endDate) : compDate;
          endDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const isOngoing = today >= compDate && today <= endDate;
          const isNextUpcoming = comp.id === nextUpcomingCompId;
          const isPlanned = compDate > today && comp.totalScore === 0;

          let borderClass = 'border-slate-800';
          let bgClass = 'bg-slate-900';
          
          if (isOngoing) {
            borderClass = 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]';
            bgClass = 'bg-orange-950/20';
          } else if (isNextUpcoming) {
            borderClass = 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
            bgClass = 'bg-emerald-950/20';
          } else if (isPlanned) {
            borderClass = 'border-emerald-500/30';
            bgClass = 'bg-emerald-500/5';
          } else if (comp.discipline === Discipline.TRAINING) {
            borderClass = 'border-blue-900/20';
          }

          return (
            <div key={comp.id} className={`${bgClass} rounded-2xl p-5 border ${borderClass} hover:border-slate-700 transition-all group relative`}>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isOngoing && (
                      <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm animate-pulse">
                        IN CORSO
                      </span>
                    )}
                    {isNextUpcoming && !isOngoing && (
                      <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                        PROSSIMA GARA
                      </span>
                    )}
                    {isPlanned && !isNextUpcoming && !isOngoing && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border border-emerald-500/20">
                        PIANIFICATA
                      </span>
                    )}
                    <span className={`${comp.discipline === Discipline.TRAINING ? 'bg-blue-900/30 text-blue-400' : 'bg-orange-900/30 text-orange-500'} text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter`}>
                    {comp.discipline === Discipline.TRAINING ? 'PRATICA' : comp.discipline.split(' ')[0]}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${getLevelColor(comp.level, comp.discipline)}`}>
                    {comp.level}
                  </span>
                  {comp.position && (
                    <span className="bg-green-900/30 text-green-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">
                      Pos. {comp.position}°
                    </span>
                  )}
                  {comp.weather && (
                    <span className="bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1.5 border border-slate-700 shadow-sm">
                      <i className={`fas ${comp.weather.icon || 'fa-cloud'} text-orange-400`}></i>
                      {comp.weather.temp}°C
                    </span>
                  )}
                  <span className="text-slate-500 text-[10px] font-bold uppercase ml-auto sm:ml-0">
                    {comp.endDate ? (
                      `${new Date(comp.date).toLocaleDateString('it-IT', { day: '2-digit' })} - ${new Date(comp.endDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    ) : (
                      new Date(comp.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                    )}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-white leading-tight truncate">
                  {comp.name}
                </h4>
                {user?.role === 'society' && comp.userName && (
                  <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">
                    Tiratore: {comp.userSurname} {comp.userName}
                  </div>
                )}
                <div className="flex items-center gap-1 text-slate-400 text-sm font-medium mt-1">
                  <i className={`fas fa-map-marker-alt ${comp.discipline === Discipline.TRAINING ? 'text-blue-500' : 'text-orange-600'} text-xs`}></i>
                  {comp.location}
                </div>
                
                {comp.usedCartridges && comp.usedCartridges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {comp.usedCartridges.map((uc, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-950/60 pl-1 pr-2.5 py-1 rounded-lg border border-slate-800 hover:border-orange-500/30 transition-colors">
                        <div className="w-6 h-6 rounded-md bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                           {uc.imageUrl ? <img src={uc.imageUrl} alt={uc.model} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[7px] text-orange-600 font-black">{uc.leadNumber}</div>}
                        </div>
                        <span className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">{uc.producer} {uc.model}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 mt-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    Target: <span className="text-slate-300">{comp.totalTargets}</span>
                  </span>
                  {comp.cost > 0 && (
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                      Spesa: <span className="text-slate-300">€{comp.cost.toFixed(2)}</span>
                    </span>
                  )}
                  {comp.win > 0 && (
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                      Vincita: <span className="text-green-500">€{comp.win.toFixed(2)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-6">
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Punteggio</p>
                    <div className="text-2xl font-black text-white">
                      {comp.totalScore}<span className="text-slate-600 text-sm font-medium">/{comp.totalTargets}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Media</p>
                    <div className={`text-2xl font-black ${comp.discipline === Discipline.TRAINING ? 'text-blue-500' : 'text-orange-500'}`}>
                      {comp.averagePerSeries.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2">
                  {user?.role !== 'society' && (
                    <>
                      <button onClick={() => onEdit(comp)} className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white active:scale-90 transition-all"><i className="fas fa-edit"></i></button>
                      <button onClick={() => { triggerConfirm('Elimina Gara', 'Sei sicuro di voler eliminare questa gara?', () => onDelete(comp.id), 'Elimina', 'danger'); }} className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-950/30 text-red-500 hover:bg-red-600 hover:text-white active:scale-90 transition-all"><i className="fas fa-trash-alt"></i></button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {comp.scores.map((s, i) => {
                    const hasDetails = comp.detailedScores && comp.detailedScores[i] && comp.detailedScores[i].length > 0;
                    return (
                      <button 
                        key={i} 
                        onClick={() => hasDetails ? toggleDetails(comp.id) : undefined}
                        className={`flex flex-col items-center bg-slate-800/40 rounded-lg px-3 py-1.5 border border-slate-800/50 min-w-[42px] ${hasDetails ? 'cursor-pointer hover:bg-slate-800/80 hover:border-orange-500/50 transition-all active:scale-95' : 'cursor-default'}`}
                        title={hasDetails ? "Clicca per vedere i dettagli" : ""}
                      >
                        <span className="text-[8px] text-slate-600 font-bold uppercase">S{i+1}</span>
                        <span className={`text-sm font-black ${s >= 24 ? 'text-yellow-500' : s >= 22 ? 'text-slate-200' : s >= 20 ? 'text-slate-400' : 'text-slate-600'}`}>{s}</span>
                      </button>
                    );
                  })}
                </div>
                {comp.detailedScores && comp.detailedScores.some(s => s && s.length > 0) && (
                  <button 
                    onClick={() => toggleDetails(comp.id)}
                    className="text-[10px] font-bold text-slate-400 hover:text-orange-500 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                  >
                    <i className={`fas fa-chevron-${expandedDetails[comp.id] ? 'up' : 'down'}`}></i>
                    {expandedDetails[comp.id] ? 'NASCONDI DETTAGLI' : 'MOSTRA DETTAGLI'}
                  </button>
                )}
              </div>
              
              {expandedDetails[comp.id] && comp.detailedScores && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 animate-in fade-in slide-in-from-top-2">
                  {comp.detailedScores.map((series, sIdx) => {
                    if (!series || series.length === 0) return null;
                    const seriesLayout = getSeriesLayout(comp.discipline);
                    return (
                      <div key={sIdx} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-3">Serie {sIdx + 1}</div>
                        <div className="flex flex-col gap-2">
                          {seriesLayout.layout.map((targetCount, pedanaIdx) => {
                            const startIndex = seriesLayout.layout.slice(0, pedanaIdx).reduce((a, b) => a + b, 0);
                            return (
                            <div key={pedanaIdx} className="flex items-center gap-2">
                              <span className="text-[8px] font-bold text-slate-600 w-4">{pedanaIdx + 1}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: targetCount }).map((_, targetOffset) => {
                                  const targetIdx = startIndex + targetOffset;
                                  const isHit = series[targetIdx];
                                  return (
                                    <div 
                                      key={targetIdx} 
                                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${isHit ? 'bg-[#a3e635]' : 'bg-[#ef4444]'}`}
                                      title={`Piattello ${targetIdx + 1}: ${isHit ? 'Colpito' : 'Mancato'}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )})}
                        </div>
                        {comp.seriesImages && comp.seriesImages[sIdx] && (
                          <div className="mt-4 pt-3 border-t border-slate-800/50">
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Foto Lavagna</span>
                            <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 aspect-video">
                              <img src={comp.seriesImages[sIdx]} alt={`Lavagna Serie ${sIdx + 1}`} className="w-full h-full object-contain" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {comp.notes && (
                <div className="w-full bg-slate-950/30 rounded-xl p-3 border border-slate-800/50 mt-2">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1.5">
                    <i className="fas fa-sticky-note text-orange-500/70"></i> Note
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-2">{comp.notes}</p>
                </div>
              )}
            </div>
            </div>
          );
        })
      )}
    </div>
  );

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
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-black text-slate-500 uppercase tracking-[0.2em] py-2">
                {d.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 relative z-10">
            {calendarDays.map((slot, idx) => {
              const events = slot.date ? compsByDate[slot.date] : null;
              const isToday = slot.date === today;
              const isSelected = slot.date === selectedDay;
              
              let highlightClass = 'bg-slate-900/40 border-slate-800/60 hover:border-slate-600 hover:bg-slate-800/60';
              let glowClass = '';
              
              if (events && events.length > 0) {
                const hasComp = events.some(e => e.discipline !== Discipline.TRAINING);
                const hasOngoing = events.some(e => {
                  const compDate = new Date(e.date);
                  compDate.setHours(0, 0, 0, 0);
                  const endDate = e.endDate ? new Date(e.endDate) : compDate;
                  endDate.setHours(0, 0, 0, 0);
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  return todayDate >= compDate && todayDate <= endDate;
                });
                const hasNextUpcoming = events.some(e => e.id === nextUpcomingCompId);

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
                  {events && events.length > 0 && !isToday && (
                    <div className="absolute bottom-1.5 sm:bottom-2 flex gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${events.some(c => c.discipline !== Discipline.TRAINING) ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Events Column */}
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
              
              {!compsByDate[selectedDay] || compsByDate[selectedDay].length === 0 ? (
                <div className="bg-slate-950/30 p-8 rounded-2xl border border-dashed border-slate-800 text-center flex flex-col items-center justify-center h-48">
                  <i className="fas fa-calendar-times text-slate-700 text-3xl mb-3"></i>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nessun evento registrato</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {compsByDate[selectedDay].map(comp => (
                    <div key={comp.id} className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex flex-col gap-3 hover:border-slate-700 transition-colors group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${comp.discipline === Discipline.TRAINING ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-orange-900/30 text-orange-500 border border-orange-900/50'}`}>
                              {comp.discipline.split(' ')[0]}
                            </span>
                            {comp.endDate && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter bg-purple-900/30 text-purple-400 border border-purple-900/50">
                                Multigiorno
                              </span>
                            )}
                          </div>
                          <h5 className="text-base font-bold text-white truncate leading-tight">{comp.name}</h5>
                          {user?.role === 'society' && comp.userName && (
                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-tighter mt-1">
                              Tiratore: {comp.userSurname} {comp.userName}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-white leading-none">
                            {comp.totalScore}<span className="text-xs text-slate-500">/{comp.totalTargets}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-800/50">
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium truncate">
                          <span className="flex items-center gap-1.5 truncate">
                            <i className="fas fa-map-marker-alt text-slate-500"></i>
                            <span className="truncate">{comp.location}</span>
                          </span>
                          {comp.weather && (
                            <span className="flex items-center gap-1.5 shrink-0">
                              <i className={`fas ${comp.weather.icon || 'fa-cloud'} text-slate-500`}></i>
                              {comp.weather.temp}°C
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {user?.role !== 'society' && (
                            <>
                              <button onClick={() => onEdit(comp)} className="w-7 h-7 rounded-md bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all"><i className="fas fa-edit text-[10px]"></i></button>
                              <button onClick={() => triggerConfirm('Elimina Gara', 'Sei sicuro di voler eliminare questa gara?', () => onDelete(comp.id), 'Elimina', 'danger')} className="w-7 h-7 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><i className="fas fa-trash-alt text-[10px]"></i></button>
                            </>
                          )}
                        </div>
                      </div>
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

  const hasActiveFilters = filterDiscipline !== 'ALL' || filterLocation !== 'ALL';

  return (
    <div className="space-y-2">
      <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-4 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><i className="fas fa-list-ul text-orange-600"></i>Cronologia Attività</h2>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${showFilters || hasActiveFilters || filterStatus !== 'ALL' || sortOrder !== 'ASC' ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
            >
              <i className="fas fa-filter"></i> Filtri
              {(hasActiveFilters || filterStatus !== 'ALL' || sortOrder !== 'ASC') && (
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              )}
            </button>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}><i className="fas fa-list"></i> Lista</button>
              <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}><i className="fas fa-calendar-alt"></i> Calendario</button>
            </div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-end gap-3 mt-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex-1 min-w-[140px] space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
            <select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-600 transition-all appearance-none">
              <option value="ALL">TUTTE LE DISCIPLINE</option>
              {Object.values(Discipline).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <div className="flex-1 min-w-[140px] space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Campo (TAV)</label>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-600 transition-all appearance-none">
              <option value="ALL">TUTTI I CAMPI</option>
              {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[140px] space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Stato</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-600 transition-all appearance-none">
              <option value="ALL">TUTTI GLI EVENTI</option>
              <option value="CONCLUDED">CONCLUSI</option>
              <option value="UPCOMING">PROSSIMI</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Ordina Data</label>
            <button 
              onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-white hover:border-orange-600 transition-all flex items-center gap-2 h-[38px]"
            >
              <i className={`fas ${sortOrder === 'DESC' ? 'fa-sort-amount-down' : 'fa-sort-amount-up'} text-orange-500`}></i>
              {sortOrder === 'DESC' ? 'RECENTI' : 'DATATI'}
            </button>
          </div>

          {(hasActiveFilters || filterStatus !== 'ALL' || sortOrder !== 'ASC') && (
            <button onClick={() => { setFilterDiscipline('ALL'); setFilterLocation('ALL'); setFilterStatus('ALL'); setSortOrder('ASC'); }} className="px-3 py-2.5 rounded-xl bg-red-950/30 text-red-500 text-[10px] font-black uppercase tracking-tighter hover:bg-red-600 hover:text-white transition-all h-[38px] flex items-center"><i className="fas fa-undo mr-1"></i> Reset</button>
          )}
        </div>
      )}

      <div className="pt-2">
        {viewMode === 'list' ? renderListView() : renderCalendarView()}
      </div>
    </div>
  );
};

export default HistoryList;
