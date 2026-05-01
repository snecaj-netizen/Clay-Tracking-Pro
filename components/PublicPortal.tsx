import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SocietyEvent, Discipline } from '../types';
import EventResultsManager from './EventResultsManager';
import { useLanguage } from '../contexts/LanguageContext';

interface PublicPortalProps {
  token?: string; // Optional if we are in public mode
}

const REGIONS = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana',
  'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'
];

const PublicPortal: React.FC<PublicPortalProps> = ({ token }) => {
  const { language, t } = useLanguage();
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [viewingEvent, setViewingEvent] = useState<SocietyEvent | null>(null);
  const [selectedSociety, setSelectedSociety] = useState<{name: string, type: 'ongoing' | 'past'} | null>(null);
  const [viewMode, setViewMode] = useState<'ongoing' | 'past'>('ongoing');
  const [showFilters, setShowFilters] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicEvents();
    // Ensure we have a valid initial state for this portal if we don't have one
    if (!window.history.state || window.history.state.view !== 'public-portal') {
      window.history.replaceState({ view: 'public-portal', portalView: 'home' }, '');
    }
  }, []);

  useEffect(() => {
    // Support browser back/forward buttons
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      console.log('PopState event:', state);

      if (state && state.view === 'public-portal') {
        if (state.portalView === 'home') {
          setViewingEvent(null);
          setSelectedSociety(null);
        } else if (state.portalView === 'society') {
          setViewingEvent(null);
          setSelectedSociety({ name: state.name, type: state.type });
        } else if (state.portalView === 'event') {
          if (events.length > 0) {
            const found = events.find(ev => ev.id === state.eventId);
            if (found) {
              setViewingEvent(found);
              setSelectedSociety(null);
            }
          } else {
            // If events not loaded yet, we'll wait for them
            // But we can set a temporary placeholder ID to catch it when they load
             setViewingEvent({ id: state.eventId } as any);
             setSelectedSociety(null);
          }
        }
      } else if (!state || (state.view !== 'public-portal' && !state.portalView)) {
        // Handle physical back from portal to whatever was before
        setViewingEvent(null);
        setSelectedSociety(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [events]);

  // Handle catching the event after it loads if we only had the ID from popstate
  useEffect(() => {
    if (viewingEvent && !viewingEvent.name && events.length > 0) {
      const found = events.find(ev => ev.id === viewingEvent.id);
      if (found) setViewingEvent(found);
    }
  }, [events, viewingEvent]);

  // Scroll to top on navigation
  useEffect(() => {
    if (selectedSociety || viewingEvent) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedSociety, viewingEvent]);

  const handleSelectSociety = (name: string, type: 'ongoing' | 'past') => {
    setSelectedSociety({ name, type });
    window.history.pushState({ view: 'public-portal', portalView: 'society', name, type }, '');
  };

  const handleSelectEvent = (event: SocietyEvent) => {
    setViewingEvent(event);
    window.history.pushState({ view: 'public-portal', portalView: 'event', eventId: event.id }, '');
  };

  const handleBackFromEvent = () => {
    setViewingEvent(null);
    // Only go back if the current history state is indeed the event
    if (window.history.state?.portalView === 'event') {
      window.history.back();
    }
  };

  const handleBackFromSociety = () => {
    setViewingEvent(null);
    setSelectedSociety(null);
    // Only go back if the current history state is indeed the society
    if (window.history.state?.portalView === 'society') {
      window.history.back();
    }
  };

  const fetchPublicEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Unknown server error', details: '' }));
        const errorMessage = errData.details ? `${errData.error}: ${errData.details}` : (errData.error || res.statusText);
        setError(`${t('error_fetching_public_events')}: ${errorMessage}`);
      }
    } catch (err: any) {
      console.error('Error fetching public events:', err);
      // Detailed error for "Failed to fetch" which is usually a network error
      const detail = err.message === 'Failed to fetch' 
        ? 'Network error - check if server is running or if request is blocked.' 
        : err.message;
      setError(`${t('error_fetching_public_events')}: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ongoingEvents = events.filter(event => {
    const end = new Date(event.end_date || event.start_date);
    end.setHours(0, 0, 0, 0);
    return end >= today;
  });

  const pastEvents = events.filter(event => {
    const end = new Date(event.end_date || event.start_date);
    end.setHours(0, 0, 0, 0);
    return end < today;
  });

  const filterEvents = (eventList: SocietyEvent[]) => {
    return eventList.filter(event => {
      const matchesSearch = event.name.toLowerCase().includes(search.toLowerCase()) || 
                            event.location.toLowerCase().includes(search.toLowerCase());
      const matchesRegion = selectedRegion === '' || event.region === selectedRegion;
      const matchesDiscipline = selectedDiscipline === '' || event.discipline === selectedDiscipline;
      return matchesSearch && matchesRegion && matchesDiscipline;
    });
  };

  const groupEventsBySociety = (eventList: SocietyEvent[]) => {
    const groups: { [key: string]: { name: string, region: string, count: number, code?: string } } = {};
    
    eventList.forEach(event => {
      if (!groups[event.location]) {
        groups[event.location] = {
          name: event.location,
          region: event.region || t('unspecified'),
          count: 0,
          code: event.society_code
        };
      }
      groups[event.location].count++;
    });

    return Object.values(groups).sort((a, b) => {
      if (a.region < b.region) return -1;
      if (a.region > b.region) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const handleDragEnd = (_: any, info: any) => {
    // Only detect swipes on x axis with enough velocity or distance
    if (info.offset.x > 50 || info.velocity.x > 500) { 
      if (viewingEvent) handleBackFromEvent();
      else if (selectedSociety) handleBackFromSociety();
    }
  };

  if (viewingEvent) {
    return (
      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-50 text-white [.light-theme_&]:text-slate-900 transition-colors overflow-x-hidden"
      >
        <div className="p-4 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={handleBackFromEvent}
              className="flex items-center gap-2 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-white [.light-theme_&]:hover:text-slate-900 transition-colors bg-slate-900/40 [.light-theme_&]:bg-slate-200 px-4 py-2 rounded-xl"
            >
              <i className="fas fa-arrow-left"></i>
              <span className="text-sm font-bold uppercase tracking-widest">{t('back_to_results')}</span>
            </button>
          </div>
          
          <div className={`bg-slate-900/50 [.light-theme_&]:bg-white border rounded-3xl overflow-hidden shadow-2xl transition-colors ${viewMode === 'ongoing' ? 'border-green-500/30' : 'border-slate-700'}`}>
            <EventResultsManager 
              event={viewingEvent} 
              token={token || ''} 
              readOnly={true} 
              user={null}
              onClose={handleBackFromEvent}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  if (selectedSociety) {
    const list = selectedSociety.type === 'ongoing' ? ongoingEvents : pastEvents;
    const filteredList = filterEvents(list.filter(e => e.location === selectedSociety.name));
    const borderColor = selectedSociety.type === 'ongoing' ? 'border-green-500/30' : 'border-slate-700';

    return (
      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-50 text-white [.light-theme_&]:text-slate-900 transition-colors overflow-x-hidden"
      >
        <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <button 
            onClick={handleBackFromSociety}
            className="mb-8 flex items-center gap-2 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-white [.light-theme_&]:hover:text-slate-900 transition-colors bg-slate-900/40 [.light-theme_&]:bg-slate-100 px-4 py-2 rounded-xl"
          >
            <i className="fas fa-arrow-left"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{t('back_to_societies')}</span>
          </button>

          <div className="mb-12">
             <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic mb-2">
               {t('events_at_society')} <span className="text-orange-500">{(selectedSociety as any).code ? `${(selectedSociety as any).code} - ` : ''}{selectedSociety.name}</span>
             </h2>
             <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">
               {selectedSociety.type === 'ongoing' ? t('ongoing_events') : t('past_events')}
             </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredList.map((event, idx) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleSelectEvent(event)}
                className="group bg-white/70 backdrop-blur-sm [.dark-theme_&]:bg-slate-900 border border-slate-200/60 [.dark-theme_&]:border-slate-800 rounded-2xl p-5 hover:shadow-2xl transition-all cursor-pointer relative flex flex-col shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    event.status === 'validated' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700 animate-bounce'
                  }`}>
                    {event.status === 'validated' ? t('finished_label') : t('live_label')}
                  </div>
                  {event.society_code && (
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      TAV: {event.society_code}
                    </span>
                  )}
                </div>

                <h3 className="text-lg md:text-xl font-black uppercase leading-tight mb-3 text-slate-900 [.dark-theme_&]:text-white line-clamp-2">
                  {event.name}
                </h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 flex-grow text-[10px] text-slate-500 [.dark-theme_&]:text-slate-400 font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 min-w-max">
                    <i className="far fa-calendar text-[9px]"></i>
                    <span className="font-medium text-slate-900 [.dark-theme_&]:text-slate-200">
                      {new Date(event.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' })}
                      {event.end_date && event.end_date !== event.start_date && (
                        <> - {new Date(event.end_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' })}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-max border-l border-slate-200 [.dark-theme_&]:border-slate-800 pl-4">
                    <i className="fas fa-crosshairs text-[9px]"></i>
                    <span className="font-medium text-slate-900 [.dark-theme_&]:text-slate-200">{t(event.discipline)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 [.dark-theme_&]:border-slate-800/50 pt-4">
                  <div className="flex items-center gap-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <i className="fas fa-bullseye text-[9px]"></i>
                      <span className="text-[9px] font-black">{event.targets}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i className="fas fa-users text-[9px]"></i>
                      <span className="text-[9px] font-black">{event.result_count || 0}</span>
                    </div>
                  </div>

                  <button className="bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 group-hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20 active:scale-95">
                    <i className="fas fa-eye text-[10px]"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('view_button')}</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

  const ongoingSocieties = groupEventsBySociety(filterEvents(ongoingEvents));
  const pastSocieties = groupEventsBySociety(filterEvents(pastEvents));

  return (
      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-50 text-white [.light-theme_&]:text-slate-900 transition-colors overflow-x-hidden"
      >
        <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto mb-6 flex items-center justify-center gap-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-orange-500/10 border border-orange-500/20 [.light-theme_&]:bg-orange-500/5 [.light-theme_&]:border-orange-500/10"
        >
          <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-orange-500">
            {t('live_results_subtitle')}
          </span>
        </motion.div>
        
        <button 
          onClick={fetchPublicEvents}
          disabled={loading}
          className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-500 hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-90 disabled:opacity-50"
          title={t('refresh')}
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Toggle View Tabs */}
        <div className="flex bg-slate-900/50 [.light-theme_&]:bg-slate-200/50 p-1 rounded-2xl border border-slate-800/50 [.light-theme_&]:border-slate-200">
          <button
            onClick={() => setViewMode('ongoing')}
            className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest transition-all ${
              viewMode === 'ongoing' 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 text-xs' 
                : 'text-slate-500 hover:text-slate-300 text-[9px]'
            }`}
          >
            <i className="fas fa-play mr-2"></i>
            {t('ongoing_events')}
          </button>
          <button
            onClick={() => setViewMode('past')}
            className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest transition-all ${
              viewMode === 'past' 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 text-xs' 
                : 'text-slate-500 hover:text-slate-300 text-[9px]'
            }`}
          >
            <i className="fas fa-history mr-2"></i>
            {t('past_events')}
          </button>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl border transition-all ${
            showFilters 
              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <i className={`fas ${showFilters ? 'fa-times' : 'fa-filter'} text-[10px]`}></i>
          <span className="text-[10px] font-black uppercase tracking-widest">
            {showFilters ? t('hide_filters') : t('show_filters')}
          </span>
          {!showFilters && (selectedRegion || selectedDiscipline || search) && (
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 48 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="max-w-7xl mx-auto overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/50 [.light-theme_&]:bg-white p-6 rounded-3xl border border-slate-800/80 [.light-theme_&]:border-slate-200 shadow-2xl backdrop-blur-xl transition-colors">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 [.light-theme_&]:text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  <i className="fas fa-search text-orange-500"></i>
                  {t('search_race')}
                </label>
                <div className="relative group">
                  <input 
                    type="text"
                    placeholder={t('search_events_placeholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 [.light-theme_&]:bg-slate-100 border border-slate-800 [.light-theme_&]:border-slate-200 rounded-2xl py-3 px-4 text-xs font-bold text-white [.light-theme_&]:text-slate-900 focus:border-orange-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 [.light-theme_&]:text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  <i className="fas fa-map-marker-alt text-orange-500"></i>
                  {t('region_label')}
                </label>
                <div className="relative group">
                  <select 
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full bg-slate-900 [.light-theme_&]:bg-slate-100 border border-slate-800 [.light-theme_&]:border-slate-200 rounded-2xl py-3 px-4 text-xs font-bold text-white [.light-theme_&]:text-slate-900 focus:border-orange-500/50 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">{t('all_regions')}</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </div>
                </div>
              </div>
    
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 [.light-theme_&]:text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  <i className="fas fa-crosshairs text-orange-500"></i>
                  {t('discipline')}
                </label>
                <div className="relative group">
                  <select 
                    value={selectedDiscipline}
                    onChange={(e) => setSelectedDiscipline(e.target.value)}
                    className="w-full bg-slate-900 [.light-theme_&]:bg-slate-100 border border-slate-800 [.light-theme_&]:border-slate-200 rounded-2xl py-3 px-4 text-xs font-bold text-white [.light-theme_&]:text-slate-900 focus:border-orange-500/50 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">{t('all_disciplines')}</option>
                    {Object.values(Discipline).map(d => <option key={d} value={d}>{t(d)}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">{t('loading_events')}</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-12 text-center shadow-xl">
            <h3 className="text-lg font-black uppercase mb-2">{t('error_loading')}</h3>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button onClick={fetchPublicEvents} className="px-6 py-2 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">{t('retry')}</button>
          </div>
        ) : (
          <>
            {/* Conditional Section based on viewMode */}
            {viewMode === 'ongoing' ? (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {ongoingSocieties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ongoingSocieties.map((soc, idx) => (
                      <motion.div
                        key={`ongoing-${soc.name}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleSelectSociety(soc.name, 'ongoing')}
                        className="group bg-slate-900/40 [.light-theme_&]:bg-white border border-green-500/30 [.light-theme_&]:border-green-500/20 rounded-3xl p-6 hover:bg-slate-900/60 [.light-theme_&]:hover:bg-slate-50 hover:border-green-500/50 transition-all cursor-pointer shadow-xl relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex flex-col">
                              <h3 className="text-xl font-black uppercase leading-tight group-hover:text-green-500 transition-colors">
                                {soc.code ? `${soc.code} - ` : ''}{soc.name}
                              </h3>
                              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest mt-1">
                                {t('region_label')}: {soc.region}
                              </span>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-green-500/50 transition-colors">
                             <i className="fas fa-chevron-right text-xs text-slate-500 group-hover:text-green-500"></i>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <i className="fas fa-trophy text-green-500"></i>
                          <span>{soc.count} {soc.count === 1 ? t('race_singular') : t('races_plural')}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-900/20 rounded-3xl p-12 text-center border border-slate-800/50">
                    <p className="text-slate-500 italic text-sm">{t('no_events')}</p>
                  </div>
                )}
              </section>
            ) : (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {pastSocieties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastSocieties.map((soc, idx) => (
                      <motion.div
                        key={`past-${soc.name}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleSelectSociety(soc.name, 'past')}
                        className="group bg-slate-900/40 [.light-theme_&]:bg-white border border-slate-700 [.light-theme_&]:border-slate-300 rounded-3xl p-6 hover:border-slate-500 transition-all cursor-pointer shadow-lg grayscale hover:grayscale-0"
                      >
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex flex-col">
                              <h3 className="text-xl font-black uppercase leading-tight group-hover:text-white [.light-theme_&]:group-hover:text-slate-900 transition-colors">
                                {soc.code ? `${soc.code} - ` : ''}{soc.name}
                              </h3>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                {t('region_label')}: {soc.region}
                              </span>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center border border-slate-700 group-hover:border-slate-500 transition-colors">
                             <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          <i className="fas fa-calendar-check opacity-50"></i>
                          <span>{soc.count} {soc.count === 1 ? t('race_singular') : t('races_plural')}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-900/10 rounded-3xl p-12 text-center border border-slate-800/30">
                    <p className="text-slate-600 italic text-sm">{t('no_events')}</p>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  </motion.div>
  );
};

export default PublicPortal;
