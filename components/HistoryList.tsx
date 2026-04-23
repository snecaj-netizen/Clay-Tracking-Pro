import React, { useState, useMemo } from 'react';
import { Competition, CompetitionLevel, Discipline, getSeriesLayout } from '../types';
import SeriesPopup from './SeriesPopup';
import ShareCard from './ShareCard';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface HistoryListProps {
  competitions: Competition[];
  events?: any[];
  societies: any[];
  onDelete: (id: string) => void;
  onEdit: (comp: Competition) => void;
  onUpdate?: (comp: Competition) => void;
  onSocietyClick?: (name: string) => void;
  user?: any;
  token?: string;
  viewModeProp?: 'list' | 'calendar';
  showFiltersProp?: boolean;
  onViewModeChange?: (mode: 'list' | 'calendar') => void;
  onShowFiltersChange?: (show: boolean) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ 
  competitions, 
  events = [], 
  societies, 
  onDelete, 
  onEdit, 
  onUpdate, 
  onSocietyClick, 
  user,
  token,
  viewModeProp = 'list',
  showFiltersProp = false,
  onViewModeChange,
  onShowFiltersChange
}) => {
  const { t, language } = useLanguage();
  const { triggerConfirm, triggerToast } = useUI();
  const [internalViewMode, setInternalViewMode] = useState<'list' | 'calendar'>('list');
  const viewMode = viewModeProp || internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;

  const [internalShowFilters, setInternalShowFilters] = useState(false);
  const showFilters = showFiltersProp || internalShowFilters;
  const setShowFilters = onShowFiltersChange || setInternalShowFilters;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [editingSeries, setEditingSeries] = useState<{ comp: Competition, index: number } | null>(null);
  const [shareData, setShareData] = useState<{ comp: Competition, isPerfect?: boolean, index?: number } | null>(null);

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // Stati filtri
  const [filterDiscipline, setFilterDiscipline] = useState<string>('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CONCLUDED' | 'UPCOMING'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('ASC');

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

  const nextUpcomingCompId = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixDaysFromNow = new Date(today);
    sixDaysFromNow.setDate(today.getDate() + 6);
    
    const futureComps = competitions.filter(c => {
      const start = new Date(c.date);
      start.setHours(0, 0, 0, 0);
      return start > today && start <= sixDaysFromNow;
    });
    
    if (futureComps.length === 0) return null;
    
    futureComps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return futureComps[0].id;
  }, [competitions]);

  const sortedCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = filteredCompetitions.filter(c => {
      const start = new Date(c.date);
      start.setHours(0, 0, 0, 0);
      const end = c.endDate ? new Date(c.endDate) : start;
      end.setHours(0, 0, 0, 0);
      return end >= today;
    });

    const past = filteredCompetitions.filter(c => {
      const start = new Date(c.date);
      start.setHours(0, 0, 0, 0);
      const end = c.endDate ? new Date(c.endDate) : start;
      end.setHours(0, 0, 0, 0);
      return end < today;
    });

    // Upcoming: closest to today first (ASC), with priority to ongoing
    upcoming.sort((a, b) => {
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

      // Then by next upcoming highlight
      const isNextA = a.id === nextUpcomingCompId;
      const isNextB = b.id === nextUpcomingCompId;
      if (isNextA && !isNextB) return -1;
      if (!isNextA && isNextB) return 1;

      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Past: most recent first (DESC)
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Respect manual sort order if user toggles it (reverses the entire smart list)
    const result = [...upcoming, ...past];
    return sortOrder === 'DESC' ? result.reverse() : result;
  }, [filteredCompetitions, sortOrder, nextUpcomingCompId]);

  const isDateInRange = (checkDate: string, comp: Competition) => {
    if (!comp.endDate) return checkDate === comp.date;
    const check = new Date(checkDate).getTime();
    const start = new Date(comp.date).getTime();
    const end = new Date(comp.endDate).getTime();
    return check >= start && check <= end;
  };

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

  const getLevelLabel = (level: CompetitionLevel, discipline: Discipline) => {
    if (discipline === Discipline.TRAINING) return t('training');
    switch (level) {
      case CompetitionLevel.REGIONAL: return t('regional');
      case CompetitionLevel.NATIONAL: return t('national');
      case CompetitionLevel.INTERNATIONAL: return t('international');
      default: return level;
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
        <div className="bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-3xl p-12 text-center">
          <i className="fas fa-search text-slate-700 text-3xl mb-4"></i>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t('no_competitions_found_list')}</p>
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

          let borderClass = 'border-slate-600';
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
            <React.Fragment key={comp.id}>
              <div className={`${bgClass} rounded-2xl p-5 border ${borderClass} hover:border-slate-400 transition-all group relative`}>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {isOngoing && (
                        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm animate-pulse">
                          {t('in_progress')}
                        </span>
                      )}
                      {isNextUpcoming && !isOngoing && (
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                          {t('next_competition')}
                        </span>
                      )}
                      {isPlanned && !isNextUpcoming && !isOngoing && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border border-emerald-500/20">
                          {t('planned')}
                        </span>
                      )}
                      <span className={`${comp.discipline === Discipline.TRAINING ? 'bg-blue-900/30 text-blue-400' : 'bg-orange-900/30 text-orange-500'} text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter`}>
                        {comp.discipline === Discipline.TRAINING ? t('practice') : comp.discipline.split(' ')[0]}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${getLevelColor(comp.level, comp.discipline)}`}>
                        {getLevelLabel(comp.level, comp.discipline)}
                      </span>
                      {comp.position && (
                        <span className="bg-green-900/30 text-green-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">
                          {t('position_short')} {comp.position}°
                        </span>
                      )}
                      {comp.teamName && (
                        <span className="bg-indigo-900/30 text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border border-indigo-900/50">
                          <i className="fas fa-users mr-1"></i> {comp.teamName}
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
                          `${new Date(comp.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit' })} - ${new Date(comp.endDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`
                        ) : (
                          new Date(comp.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                        )}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white leading-tight truncate">
                      {comp.name}
                    </h4>
                    {user?.role === 'society' && comp.userName && (
                      <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">
                        {t('shooter')}: {comp.userSurname} {comp.userName}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-400 text-sm font-medium mt-1">
                      <i className={`fas fa-map-marker-alt ${comp.discipline === Discipline.TRAINING ? 'text-blue-500' : 'text-orange-600'} text-xs`}></i>
                      <button 
                        onClick={() => onSocietyClick?.(comp.location)}
                        className="hover:text-orange-500 transition-colors text-left"
                      >
                        {comp.location}
                      </button>
                      {societies.find(s => s.name === comp.location)?.code && (
                        <span className="text-orange-500 ml-1">({societies.find(s => s.name === comp.location)?.code})</span>
                      )}
                    </div>
                    
                    {comp.usedCartridges && comp.usedCartridges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {comp.usedCartridges.map((uc, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-950/60 pl-1 pr-2.5 py-1 rounded-lg border border-slate-800 hover:border-orange-500/30 transition-colors">
                            <div className="w-6 h-6 rounded-md bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                               {uc.imageUrl ? <img src={uc.imageUrl} alt={uc.model} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[7px] text-orange-600 font-black">{uc.leadNumber}</div>}
                            </div>
                            <span className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">{uc.producer} {uc.model} {uc.grams ? `• ${uc.grams}g` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-4 mt-3">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                        {t('target_label')}: <span className="text-slate-300">{comp.totalTargets}</span>
                      </span>
                      {comp.cost > 0 && (
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                          {t('cost_label')}: <span className="text-slate-300">€{comp.cost.toFixed(2)}</span>
                        </span>
                      )}
                      {comp.win > 0 && (
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                          {t('win_label')}: <span className="text-green-500">€{comp.win.toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-6">
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{t('score_label')}</p>
                        <div className="text-2xl font-black text-white">
                          {comp.totalScore}<span className="text-slate-600 text-sm font-medium">/{comp.totalTargets}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{t('average_label')}</p>
                        <div className={`text-2xl font-black ${comp.discipline === Discipline.TRAINING ? 'text-blue-500' : 'text-orange-500'}`}>
                          {(comp.scores.filter(s => s > 0).length > 0 
                            ? (comp.scores.reduce((a, b) => a + b, 0) / comp.scores.filter(s => s > 0).length) 
                            : 0).toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2">
                      {user?.role !== 'society' && (
                        <>
                          <button 
                            onClick={() => onEdit(comp)} 
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 text-slate-500 hover:text-orange-500 hover:border-slate-700 transition-all active:scale-90" 
                            title={t('update_profile')}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            onClick={() => setShareData({ comp })} 
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 text-slate-500 hover:text-blue-500 hover:border-slate-700 transition-all active:scale-90"
                            title={t('share')}
                          >
                            <i className="fas fa-share-alt"></i>
                          </button>
                          <button 
                            onClick={() => { triggerConfirm(t('delete'), t('confirm_delete_competition'), () => onDelete(comp.id), t('delete'), 'danger'); }} 
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 text-slate-500 hover:text-red-500 hover:border-slate-700 transition-all active:scale-90" 
                            title={t('delete')}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
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
                            onClick={() => setEditingSeries({ comp, index: i })}
                            className={`relative flex flex-col items-center bg-slate-800/40 rounded-lg px-3 py-1.5 border border-slate-800/50 min-w-[42px] cursor-pointer hover:bg-slate-800/80 hover:border-orange-500/50 transition-all active:scale-95 group/series`}
                            title={t('click_to_enter_result')}
                          >
                            <span className="text-[8px] text-slate-600 font-bold uppercase">S{i+1}</span>
                            <span className={`text-sm font-black ${s === 25 ? 'text-orange-500' : s >= 24 ? 'text-yellow-500' : s >= 22 ? 'text-slate-200' : s >= 20 ? 'text-slate-400' : 'text-slate-600'}`}>{s}</span>
                            {hasDetails && <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(249,115,22,0.5)]"></div>}
                            {s === 25 && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShareData({ comp, isPerfect: true, index: i });
                                }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/series:opacity-100 transition-opacity active:scale-95 z-20"
                                title={t('share_25')}
                              >
                                <i className="fas fa-share-alt text-[8px]"></i>
                              </div>
                            )}
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
                        {expandedDetails[comp.id] ? t('hide_details') : t('show_details')}
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
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-3">{t('series_label')} {sIdx + 1}</div>
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
                                          className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${isHit ? 'bg-[#a3e635]' : 'bg-[#ef4444]'}`}
                                          title={`${t('target_comp')} ${targetIdx + 1}: ${isHit ? t('hit_label') : t('missed_label')}`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )})}
                            </div>
                            {comp.seriesImages && comp.seriesImages[sIdx] && (
                              <div className="mt-4 pt-3 border-t border-slate-800/50">
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">{t('board_photo')}</span>
                                <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 aspect-video">
                                  <img src={comp.seriesImages[sIdx]} alt={`${t('series_label')} ${sIdx + 1}`} className="w-full h-full object-contain" />
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
                        <i className="fas fa-sticky-note text-orange-500/70"></i> {t('notes_label')}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-2">{comp.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );

  const renderCalendarView = () => {
    const today = new Date().toISOString().split('T')[0];
    const monthName = currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' });
    const weekDays = language === 'it' 
      ? ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Calendar Column */}
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-calendar-alt text-orange-500"></i>
              {monthName}
            </h3>
            <div className="flex gap-1">
              <button 
                onClick={() => changeMonth(-1)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-orange-500 hover:border-slate-600 transition-all"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              <button 
                onClick={() => changeMonth(1)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-orange-500 hover:border-slate-600 transition-all"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(d => (
              <div key={d} className="text-center py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{d}</div>
            ))}
            {calendarDays.map((d, i) => {
              const hasEvents = d.date && compsByDate[d.date]?.length > 0;
              const isToday = d.date === today;
              const isSelected = d.date === selectedDay;
              
              return (
                <div 
                  key={i}
                  onClick={() => d.date && setSelectedDay(d.date)}
                  className={`
                    aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border
                    ${!d.isCurrentMonth ? 'opacity-20 pointer-events-none' : ''}
                    ${isToday ? 'bg-orange-500 text-white border-orange-400' : isSelected ? 'bg-slate-800 text-white border-slate-600 shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'bg-slate-900/50 text-slate-400 border-slate-800/50 hover:border-slate-600'}
                  `}
                >
                  <span className={`text-sm font-black ${isToday ? 'text-white' : isSelected ? 'text-white' : 'text-slate-300'}`}>{d.day}</span>
                  {hasEvents && !isToday && (
                    <div className="flex gap-0.5 mt-1">
                      {compsByDate[d.date!].slice(0, 3).map((c, idx) => (
                        <div key={idx} className={`w-1 h-1 rounded-full ${c.discipline === Discipline.TRAINING ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                      ))}
                    </div>
                  )}
                  {isToday && hasEvents && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full mt-1"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Details Column */}
        <div className="lg:w-80 w-full flex flex-col">
          <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800/60 backdrop-blur-sm sticky top-6">
            <h4 className="text-sm font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
              <i className="fas fa-list-ul text-orange-500"></i>
              {selectedDay 
                ? `${new Date(selectedDay).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'long' })}` 
                : t('select_date')}
            </h4>
            
            <div className="space-y-3">
              {!selectedDay ? (
                <div className="text-center py-8">
                  <i className="fas fa-calendar-day text-slate-700 text-3xl mb-3"></i>
                  <p className="text-xs text-slate-500 leading-relaxed italic">{t('select_date_desc')}</p>
                </div>
              ) : compsByDate[selectedDay]?.length > 0 ? (
                compsByDate[selectedDay].map(c => (
                  <div key={c.id} className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/50 hover:border-orange-500/50 transition-all group">
                    <div className="flex items-center gap-2 mb-1">
                       <span className={`w-2 h-2 rounded-full ${c.discipline === Discipline.TRAINING ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                         {c.discipline === Discipline.TRAINING ? t('practice') : c.discipline}
                       </span>
                    </div>
                    <div className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors truncate">{c.name}</div>
                    <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1 italic">
                      <i className="fas fa-map-marker-alt text-[8px]"></i>
                      {c.location}
                    </div>
                    {c.totalScore > 0 && (
                      <div className="mt-2 flex items-center justify-between border-t border-slate-800/50 pt-2">
                        <span className="text-[9px] font-bold text-slate-500">{t('score_label')}</span>
                        <span className="text-xs font-black text-white">{c.totalScore}/{c.totalTargets}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-coffee text-slate-700 text-2xl mb-2"></i>
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{t('no_events_recorded')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Header e Filtri */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl border border-slate-800 ${viewMode === 'list' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-900 text-slate-500'}`}>
             <i className={`fas ${viewMode === 'list' ? 'fa-list-ul' : 'fa-calendar-alt'}`}></i>
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-tighter leading-none">{viewMode === 'list' ? t('list_view_title') : t('calendar_view_title')}</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">
              {filteredCompetitions.length} {t('events_label')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 h-9 mr-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              title={t('list_label')}
            >
              <i className="fas fa-list-ul"></i>
              <span className="hidden xs:inline">{t('list_label')}</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              title={t('calendar_label')}
            >
              <i className="fas fa-calendar-alt"></i>
              <span className="hidden xs:inline">{t('calendar_label')}</span>
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${showFilters ? 'bg-orange-500 border-orange-400 text-white shadow-lg rotate-180' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
          >
            <i className="fas fa-sliders-h"></i>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 p-5 bg-slate-950/50 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-crosshairs text-orange-500"></i>
                {t('discipline')}
              </label>
              <select
                value={filterDiscipline}
                onChange={(e) => setFilterDiscipline(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-4 py-3 focus:border-orange-500 transition-colors appearance-none cursor-pointer font-bold"
              >
                <option value="ALL">{t('all_disciplines')}</option>
                {Object.values(Discipline).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-orange-500"></i>
                {t('location')}
              </label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-4 py-3 focus:border-orange-500 transition-colors appearance-none cursor-pointer font-bold"
              >
                <option value="ALL">{t('all_societies')}</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-tasks text-orange-500"></i>
                {t('competition_status')}
              </label>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 h-[46px]">
                <button
                  onClick={() => setFilterStatus('ALL')}
                  className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${filterStatus === 'ALL' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('all')}
                </button>
                <button
                  onClick={() => setFilterStatus('CONCLUDED')}
                  className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${filterStatus === 'CONCLUDED' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('concluded')}
                </button>
                <button
                  onClick={() => setFilterStatus('UPCOMING')}
                  className={`flex-1 rounded-lg text-[9px] font-black uppercase transition-all ${filterStatus === 'UPCOMING' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   {t('upcoming')}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-sort-amount-down text-orange-500"></i>
                {t('order')}
              </label>
              <button
                onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-4 py-3 flex items-center justify-between hover:border-slate-600 transition-colors group h-[46px]"
              >
                <span className="font-bold">{sortOrder === 'DESC' ? t('recent_first') : t('oldest_first')}</span>
                <i className={`fas fa-arrow-${sortOrder === 'DESC' ? 'down' : 'up'} text-orange-500 group-hover:scale-110 transition-transform`}></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' ? renderListView() : renderCalendarView()}

      {editingSeries && (
        <SeriesPopup
          competition={editingSeries.comp}
          seriesIndex={editingSeries.index}
          onClose={() => setEditingSeries(null)}
          onSave={(updatedComp) => {
            onUpdate?.(updatedComp);
            setEditingSeries(null);
          }}
        />
      )}

      {shareData && (
        <ShareCard
          competition={shareData.comp}
          societies={societies}
          user={user}
          isPerfectSeries={shareData.isPerfect}
          seriesIndex={shareData.index}
          onClose={() => setShareData(null)}
        />
      )}
    </div>
  );
};

export default HistoryList;
