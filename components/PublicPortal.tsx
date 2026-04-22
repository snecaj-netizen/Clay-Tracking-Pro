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

  useEffect(() => {
    fetchPublicEvents();
  }, []);

  const fetchPublicEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching public events:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(search.toLowerCase()) || 
                          event.location.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = selectedRegion === '' || event.region === selectedRegion;
    const matchesDiscipline = selectedDiscipline === '' || event.discipline === selectedDiscipline;
    return matchesSearch && matchesRegion && matchesDiscipline;
  });

  if (viewingEvent) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4">
        <button 
          onClick={() => setViewingEvent(null)}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <i className="fas fa-arrow-left"></i>
          <span className="text-sm font-bold uppercase tracking-widest">{t('back_to_portal')}</span>
        </button>
        
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
            {t('live_results_subtitle')}
          </span>
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 italic text-white">
          {t('portal_title').includes('Online') ? (
            <>
              {t('portal_title').replace('Online', '').trim()}{' '}
              <span className="text-orange-500">Online</span>
            </>
          ) : (
            t('portal_title')
          )}
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm font-medium">
          {t('portal_subtitle')}
        </p>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/50 p-6 rounded-3xl border border-slate-800/80 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <i className="fas fa-search text-orange-500"></i>
              {t('search_race')}
            </label>
            <div className="relative group">
              <input 
                type="text"
                placeholder={t('search_events_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-xs font-bold text-white focus:border-orange-500/50 outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <i className="fas fa-map-marker-alt text-orange-500"></i>
              {t('region_label')}
            </label>
            <div className="relative group">
              <select 
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-xs font-bold text-white focus:border-orange-500/50 outline-none transition-all appearance-none cursor-pointer"
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
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
              <i className="fas fa-crosshairs text-orange-500"></i>
              {t('discipline')}
            </label>
            <div className="relative group">
              <select 
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-xs font-bold text-white focus:border-orange-500/50 outline-none transition-all appearance-none cursor-pointer"
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
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">{t('loading_events')}</span>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  layout
                  className="group bg-slate-900/40 border border-slate-800/50 rounded-3xl p-6 hover:bg-slate-900/60 hover:border-orange-500/20 transition-all cursor-pointer relative overflow-hidden"
                  onClick={() => setViewingEvent(event)}
                >
                  {/* Status Badge */}
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
                          {event.location} {event.region ? `(${event.region})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950/50 rounded-2xl p-3 border border-slate-800/50">
                        <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">{t('discipline')}</span>
                        <span className="text-[10px] font-bold text-white truncate block">{t(event.discipline)}</span>
                      </div>
                      <div className="bg-slate-950/50 rounded-2xl p-3 border border-slate-800/50">
                        <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">{t('targets')}</span>
                        <span className="text-[10px] font-bold text-white block">{event.targets} DT</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <i className="far fa-calendar text-[10px] text-slate-500"></i>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(event.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-400">
                        <div className="flex items-center gap-1">
                          <i className="fas fa-bullseye"></i>
                          <span>{event.result_count || 0} {t('shooters_with_results')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl p-20 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-900/50 border border-slate-800 flex items-center justify-center mx-auto mb-6 text-slate-600">
              <i className="fas fa-search text-3xl"></i>
            </div>
            <h3 className="text-xl font-black uppercase italic mb-2">{t('no_events')}</h3>
            <p className="text-slate-500 text-sm">{t('no_public_events_matching')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicPortal;
