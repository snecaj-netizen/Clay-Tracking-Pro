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
  }, []);

  const fetchPublicEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Unknown server error' }));
        setError(`${t('error_fetching_public_events')}: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error('Error fetching public events:', err);
      setError(`${t('error_fetching_public_events')}: ${err.message || 'Failed to fetch'}`);
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
    const groups: { [key: string]: { name: string, region: string, count: number } } = {};
    
    eventList.forEach(event => {
      if (!groups[event.location]) {
        groups[event.location] = {
          name: event.location,
          region: event.region || t('unspecified'),
          count: 0
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

  if (viewingEvent) {
    return (
      <div className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-50 text-white [.light-theme_&]:text-slate-900 p-4 transition-colors">
        <button 
          onClick={() => setViewingEvent(null)}
          className="mb-6 flex items-center gap-2 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-white [.light-theme_&]:hover:text-slate-900 transition-colors"
        >
          <i className="fas fa-arrow-left"></i>
          <span className="text-sm font-bold uppercase tracking-widest">{t('back_to_results')}</span>
        </button>
        
        <div className="bg-slate-900/50 [.light-theme_&]:bg-white border border-slate-800 [.light-theme_&]:border-slate-200 rounded-3xl overflow-hidden shadow-2xl transition-colors">
          <EventResultsManager 
            event={viewingEvent} 
            token={token || ''} 
            readOnly={true} 
            user={null}
            onClose={() => setViewingEvent(null)}
          />
        </div>
      </div>
    );
  }

  if (selectedSociety) {
    const list = selectedSociety.type === 'ongoing' ? ongoingEvents : pastEvents;
    const filteredList = filterEvents(list.filter(e => e.location === selectedSociety.name));

    return (
      <div className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-50 text-white [.light-theme_&]:text-slate-900 p-4 md:p-8 transition-colors">
        <div className="max-w-7xl mx-auto">
          <button 
            onClick={() => setSelectedSociety(null)}
            className="mb-8 flex items-center gap-2 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-white [.light-theme_&]:hover:text-slate-900 transition-colors bg-slate-900/40 [.light-theme_&]:bg-slate-100 px-4 py-2 rounded-xl"
          >
            <i className="fas fa-arrow-left"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{t('back_to_societies')}</span>
          </button>

          <div className="mb-12">
             <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic mb-2">
               {t('events_at_society')} <span className="text-orange-500">{selectedSociety.name}</span>
             </h2>
             <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">
               {selectedSociety.type === 'ongoing' ? t('ongoing_events') : t('past_events')}
             </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map((event, idx) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setViewingEvent(event)}
                className="group bg-slate-900/40 [.light-theme_&]:bg-white border border-slate-800/50 [.light-theme_&]:border-slate-200 rounded-3xl p-6 hover:border-orange-500/20 transition-all cursor-pointer relative overflow-hidden shadow-xl"
              >
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    event.status === 'validated' ? 'bg-green-500/20 text-green-500' : 'bg-orange-500/20 text-orange-500 animate-pulse'
                  }`}>
                    {event.status === 'validated' ? t('finished_label') : t('live_label')}
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                      <i className={`fas ${event.type === 'Internazionale' ? 'fa-globe' : 'fa-trophy'} text-xl`}></i>
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-black uppercase leading-tight group-hover:text-orange-500 transition-colors">
                        {event.name}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {event.location}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/50 [.light-theme_&]:bg-slate-50 rounded-2xl p-3 border border-slate-800/50">
                      <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">{t('discipline')}</span>
                      <span className="text-[10px] font-bold truncate block">{t(event.discipline)}</span>
                    </div>
                    <div className="bg-slate-950/50 [.light-theme_&]:bg-slate-50 rounded-2xl p-3 border border-slate-800/50">
                      <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">{t('targets')}</span>
                      <span className="text-[10px] font-bold block">{event.targets} DT</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <i className="far fa-calendar text-[10px] text-slate-500"></i>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(event.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                      <i className="fas fa-users"></i>
                      <span>{event.result_count || 0}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const ongoingSocieties = groupEventsBySociety(filterEvents(ongoingEvents));
  const pastSocieties = groupEventsBySociety(filterEvents(pastEvents));

  return (
    <div className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-50 text-white [.light-theme_&]:text-slate-900 p-4 md:p-8 transition-colors">
      <div className="max-w-7xl mx-auto mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6 [.light-theme_&]:bg-orange-500/5 [.light-theme_&]:border-orange-500/10"
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
            {t('live_results_subtitle')}
          </span>
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 italic text-white [.light-theme_&]:text-slate-900">
           {t('results_portal')}
        </h1>
      </div>

      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Toggle View Tabs */}
        <div className="flex bg-slate-900/50 [.light-theme_&]:bg-slate-200/50 p-1 rounded-2xl border border-slate-800/50 [.light-theme_&]:border-slate-200">
          <button
            onClick={() => setViewMode('ongoing')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'ongoing' 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <i className="fas fa-play mr-2"></i>
            {t('ongoing_events')}
          </button>
          <button
            onClick={() => setViewMode('past')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'past' 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                : 'text-slate-500 hover:text-slate-300'
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
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                     <i className="fas fa-play text-sm"></i>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight underline decoration-orange-500 decoration-4 underline-offset-8">
                    {t('ongoing_events')}
                  </h2>
                </div>
  
                {ongoingSocieties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ongoingSocieties.map((soc, idx) => (
                      <motion.div
                        key={`ongoing-${soc.name}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => setSelectedSociety({ name: soc.name, type: 'ongoing' })}
                        className="group bg-slate-900/40 [.light-theme_&]:bg-white border border-slate-800/50 [.light-theme_&]:border-slate-200 rounded-3xl p-6 hover:bg-slate-900/60 [.light-theme_&]:hover:bg-slate-50 hover:border-orange-500/30 transition-all cursor-pointer shadow-xl relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">{soc.region}</span>
                              <h3 className="text-xl font-black uppercase leading-tight group-hover:text-orange-500 transition-colors">{soc.name}</h3>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-orange-500/50 transition-colors">
                             <i className="fas fa-chevron-right text-xs text-slate-500 group-hover:text-orange-500"></i>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <i className="fas fa-trophy text-orange-500"></i>
                          <span>{soc.count} {soc.count === 1 ? t('race_singular') : t('races_plural')} {t('active_competitions')}</span>
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
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-800 flex items-center justify-center text-slate-500">
                     <i className="fas fa-history text-sm"></i>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-slate-400">
                    {t('past_events')}
                  </h2>
                </div>
  
                {pastSocieties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastSocieties.map((soc, idx) => (
                      <motion.div
                        key={`past-${soc.name}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => setSelectedSociety({ name: soc.name, type: 'past' })}
                        className="group bg-slate-900/40 [.light-theme_&]:bg-white border border-slate-800/50 [.light-theme_&]:border-slate-200 rounded-3xl p-6 hover:border-slate-600 transition-all cursor-pointer shadow-lg grayscale hover:grayscale-0"
                      >
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{soc.region}</span>
                              <h3 className="text-xl font-black uppercase leading-tight group-hover:text-white [.light-theme_&]:group-hover:text-slate-900 transition-colors">{soc.name}</h3>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-slate-600 transition-colors">
                             <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          <i className="fas fa-calendar-check opacity-50"></i>
                          <span>{soc.count} {soc.count === 1 ? t('race_singular') : t('races_plural')} {t('concluded')}</span>
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
  );
};

export default PublicPortal;
