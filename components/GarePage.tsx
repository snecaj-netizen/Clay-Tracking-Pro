import React, { useState, useMemo, useEffect, useRef } from 'react';
import EventsManager from './EventsManager';
import { EventControlManager } from './EventControlManager';
import { motion, AnimatePresence } from 'motion/react';
import SocietySearch from './SocietySearch';
import { Discipline } from '../types';

interface GarePageProps {
  user: any;
  token: string;
  triggerConfirm: any;
  triggerToast: any;
  societies: any[];
  events: any[];
  onParticipate: (event: any) => void;
  onCreateTeam: (event: any) => void;
  initialEventId?: string | null;
  onInitialEventHandled?: () => void;
  initialViewMode?: string | null;
  onInitialViewModeHandled?: () => void;
  appSettings?: any;
  onCreateEventTrigger?: number;
  onToggleFAB?: (hide: boolean) => void;
  onTabChange?: (tab: string) => void;
}

type TabType = 'eventi' | 'le-tue-gare' | 'iscrizione' | 'risultati' | 'gestione' | 'attivazione';

const GarePage: React.FC<GarePageProps> = ({
  user, token, triggerConfirm, triggerToast, societies, events, onParticipate, onCreateTeam,
  initialEventId, onInitialEventHandled, initialViewMode, onInitialViewModeHandled, appSettings,
  onCreateEventTrigger, onToggleFAB, onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('eventi');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'results' | 'managed'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [importTrigger, setImportTrigger] = useState(0);
  const [newEventTrigger, setNewEventTrigger] = useState(0);
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [direction, setDirection] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);

  // Define tab order based on user role
  const availableTabs = useMemo(() => {
    const tabs: TabType[] = ['eventi'];
    if (user?.role === 'society') tabs.push('le-tue-gare');
    tabs.push('iscrizione');
    tabs.push('risultati');
    if (user?.role === 'admin' || user?.role === 'society') tabs.push('gestione');
    if (user?.role === 'admin') tabs.push('attivazione');
    return tabs;
  }, [user?.role]);

  useEffect(() => {
    if (initialViewMode) {
      setActiveTab(initialViewMode as any);
      if (onInitialViewModeHandled) onInitialViewModeHandled();
    }
  }, [initialViewMode, onInitialViewModeHandled]);

  useEffect(() => {
    if (onTabChange) onTabChange(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (onCreateEventTrigger && onCreateEventTrigger > 0 && (user?.role === 'admin' || user?.role === 'society')) {
      setActiveTab('gestione');
    }
  }, [onCreateEventTrigger, user?.role]);

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = availableTabs.indexOf(activeTab);
    const newIndex = availableTabs.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwipe = (offset: number) => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (offset < -50 && currentIndex < availableTabs.length - 1) {
      // Swipe Left -> Next Tab
      handleTabChange(availableTabs[currentIndex + 1]);
    } else if (offset > 50 && currentIndex > 0) {
      // Swipe Right -> Previous Tab
      handleTabChange(availableTabs[currentIndex - 1]);
    }
  };

  const goToPrevTab = () => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (currentIndex > 0) {
      handleTabChange(availableTabs[currentIndex - 1]);
    }
  };

  const goToNextTab = () => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (currentIndex < availableTabs.length - 1) {
      handleTabChange(availableTabs[currentIndex + 1]);
    }
  };

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const openRegistrations = events.filter(e => {
      if (!e.is_management_enabled) return false;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const end = new Date(e.end_date);
      end.setHours(0, 0, 0, 0);
      return now <= end;
    }).length;
    
    return { totalEvents, openRegistrations };
  }, [events]);

  return (
    <div className="flex flex-col">
      {/* Sticky Header Section */}
      <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <i className={`fas ${activeTab === 'risultati' ? 'fa-trophy' : 'fa-calendar-alt'} text-orange-600`}></i>
              {activeTab === 'eventi' ? 'Eventi' : 
               activeTab === 'le-tue-gare' ? 'Le Tue Gare' : 
               activeTab === 'iscrizione' ? 'Iscrizione' : 
               activeTab === 'risultati' ? 'Risultati' : 
               activeTab === 'gestione' ? 'Gestione Eventi' : 
               activeTab === 'attivazione' ? 'Attivazione' : 'Gare'}
            </h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              {activeTab === 'eventi' ? 'Calendario ufficiale competizioni' : 
               activeTab === 'le-tue-gare' ? 'Monitoraggio gare della società' : 
               activeTab === 'iscrizione' ? 'Gare con iscrizioni aperte' : 
               activeTab === 'risultati' ? 'Classifiche e punteggi' : 
               activeTab === 'gestione' ? 'Pannello di controllo gare' : 
               activeTab === 'attivazione' ? 'Gestione stati operativi' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-orange-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Eventi</p>
              <p className="text-xs font-black text-white">{stats.totalEvents}</p>
            </div>
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-blue-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Iscrizioni Open</p>
              <p className="text-xs font-black text-white">{stats.openRegistrations}</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center group/tabs">
          <button 
            onClick={goToPrevTab}
            disabled={availableTabs.indexOf(activeTab) === 0}
            className="hidden lg:flex absolute -left-10 z-10 items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 transition-all disabled:opacity-0 shadow-lg"
          >
            <i className="fas fa-chevron-left text-[10px]"></i>
          </button>

          <div ref={tabsRef} className="flex-1 flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
            {availableTabs.map((tab) => (
              <button 
                key={tab}
                data-tab={tab}
                onClick={() => handleTabChange(tab)} 
                className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap uppercase ${activeTab === tab ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
              >
                {tab.replace(/-/g, ' ')}
              </button>
            ))}
          </div>

          <button 
            onClick={goToNextTab}
            disabled={availableTabs.indexOf(activeTab) === availableTabs.length - 1}
            className="hidden lg:flex absolute -right-10 z-10 items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 transition-all disabled:opacity-0 shadow-lg"
          >
            <i className="fas fa-chevron-right text-[10px]"></i>
          </button>
        </div>

        {/* Action Buttons Row */}
        {activeTab !== 'attivazione' && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${showFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-orange-500'}`}
              >
                <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'}`}></i>
                Filtri
              </button>

              {user?.role === 'admin' && activeTab === 'eventi' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setExportTrigger(prev => prev + 1)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-slate-500 hover:text-white border border-slate-800 text-[10px] font-black uppercase transition-all"
                    title="Esporta Excel"
                  >
                    <i className="fas fa-file-excel"></i>
                    <span className="hidden sm:inline">Esporta</span>
                  </button>
                  <button 
                    onClick={() => setImportTrigger(prev => prev + 1)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-slate-500 hover:text-white border border-slate-800 text-[10px] font-black uppercase transition-all"
                    title="Importa Excel"
                  >
                    <i className="fas fa-file-import"></i>
                    <span className="hidden sm:inline">Importa</span>
                  </button>
                </div>
              )}

              {(user?.role === 'admin' || user?.role === 'society') && activeTab === 'eventi' && (
                <button 
                  onClick={() => setNewEventTrigger(prev => prev + 1)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-500 text-[10px] font-black uppercase transition-all shadow-lg shadow-orange-600/20"
                >
                  <i className="fas fa-plus"></i>
                  <span className="hidden sm:inline">Nuovo Evento</span>
                </button>
              )}
            </div>

            {activeTab === 'eventi' && (
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                >
                  <i className="fas fa-list"></i>
                  <span className="hidden sm:inline">Elenco</span>
                </button>
                <button 
                  onClick={() => setViewMode('calendar')} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                >
                  <i className="fas fa-calendar-alt"></i>
                  <span className="hidden sm:inline">Calendario</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filters Section (Sticky) */}
        <AnimatePresence>
          {showFilters && activeTab !== 'attivazione' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 pb-1">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Società TAV</label>
                  <SocietySearch 
                    value={filterSociety}
                    onChange={setFilterSociety}
                    societies={societies}
                    placeholder="Tutte le società"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                  <div className="relative group">
                    <select 
                      value={filterDiscipline} 
                      onChange={e => setFilterDiscipline(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-[11px] focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="">Tutte le discipline</option>
                      {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <i className="fas fa-chevron-down text-[8px]"></i>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Mese</label>
                  <div className="relative group">
                    <input 
                      type="month" 
                      value={filterMonth} 
                      onChange={e => setFilterMonth(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-[11px] focus:border-orange-600 outline-none transition-all" 
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pb-1">
                <button 
                  onClick={() => { setFilterSociety(''); setFilterDiscipline(''); setFilterMonth(''); }}
                  className="text-[9px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
                >
                  Resetta Filtri
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div 
        className="min-h-[60vh] overflow-x-hidden"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => handleSwipe(info.offset.x)}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {activeTab === 'eventi' && (
              <EventsManager 
                user={user} 
                token={token} 
                triggerConfirm={triggerConfirm} 
                triggerToast={triggerToast}
                societies={societies} 
                initialEvents={events}
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialEventId={initialEventId}
                onInitialEventHandled={onInitialEventHandled}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showFilters={showFilters}
                onShowFiltersChange={setShowFilters}
                exportTrigger={exportTrigger}
                importTrigger={importTrigger}
                filterSociety={filterSociety}
                onFilterSocietyChange={setFilterSociety}
                filterDiscipline={filterDiscipline}
                onFilterDisciplineChange={setFilterDiscipline}
                filterMonth={filterMonth}
                onFilterMonthChange={setFilterMonth}
                hideViewSwitcher={true}
                hideHeader={true}
                appSettings={appSettings}
                onToggleFAB={onToggleFAB}
                isSubPage={true}
              />
            )}

            {activeTab === 'le-tue-gare' && user?.role === 'society' && (
              <div className="relative">
                <EventsManager 
                  user={user} 
                  token={token} 
                  triggerConfirm={triggerConfirm} 
                  triggerToast={triggerToast}
                  societies={societies} 
                  initialEvents={events}
                  onParticipate={onParticipate}
                  onCreateTeam={onCreateTeam}
                  restrictToSociety={true}
                  initialViewMode="list"
                  hideViewSwitcher={true}
                  hideHeader={true}
                  showFilters={showFilters}
                  onShowFiltersChange={setShowFilters}
                  exportTrigger={exportTrigger}
                  importTrigger={importTrigger}
                  filterSociety={filterSociety}
                  onFilterSocietyChange={setFilterSociety}
                  filterDiscipline={filterDiscipline}
                  onFilterDisciplineChange={setFilterDiscipline}
                  filterMonth={filterMonth}
                  onFilterMonthChange={setFilterMonth}
                  appSettings={appSettings}
                  isSubPage={true}
                />
              </div>
            )}

            {activeTab === 'iscrizione' && (
              <EventsManager 
                user={user} 
                token={token} 
                triggerConfirm={triggerConfirm} 
                triggerToast={triggerToast}
                societies={societies} 
                initialEvents={events}
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialEventId={initialEventId}
                onInitialEventHandled={onInitialEventHandled}
                initialViewMode="list"
                hideViewSwitcher={true}
                hideHeader={true}
                showFilters={showFilters}
                onShowFiltersChange={setShowFilters}
                exportTrigger={exportTrigger}
                importTrigger={importTrigger}
                filterSociety={filterSociety}
                onFilterSocietyChange={setFilterSociety}
                filterDiscipline={filterDiscipline}
                onFilterDisciplineChange={setFilterDiscipline}
                filterMonth={filterMonth}
                onFilterMonthChange={setFilterMonth}
                filterRegistrationOpen={true}
                appSettings={appSettings}
                isSubPage={true}
              />
            )}

            {activeTab === 'risultati' && (
              <EventsManager 
                user={user} 
                token={token} 
                triggerConfirm={triggerConfirm} 
                triggerToast={triggerToast}
                societies={societies} 
                initialEvents={events}
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialViewMode="results"
                hideViewSwitcher={true}
                hideHeader={true}
                showFilters={showFilters}
                onShowFiltersChange={setShowFilters}
                exportTrigger={exportTrigger}
                importTrigger={importTrigger}
                filterSociety={filterSociety}
                onFilterSocietyChange={setFilterSociety}
                filterDiscipline={filterDiscipline}
                onFilterDisciplineChange={setFilterDiscipline}
                filterMonth={filterMonth}
                onFilterMonthChange={setFilterMonth}
                appSettings={appSettings}
                isSubPage={true}
              />
            )}

            {activeTab === 'gestione' && (user?.role === 'admin' || user?.role === 'society') && (
              <EventsManager 
                user={user} 
                token={token} 
                triggerConfirm={triggerConfirm} 
                triggerToast={triggerToast}
                societies={societies} 
                initialEvents={events}
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialViewMode="managed"
                hideViewSwitcher={true}
                hideHeader={true}
                showFilters={showFilters}
                onShowFiltersChange={setShowFilters}
                exportTrigger={exportTrigger}
                importTrigger={importTrigger}
                newEventTrigger={newEventTrigger}
                filterSociety={filterSociety}
                onFilterSocietyChange={setFilterSociety}
                filterDiscipline={filterDiscipline}
                onFilterDisciplineChange={setFilterDiscipline}
                filterMonth={filterMonth}
                onFilterMonthChange={setFilterMonth}
                appSettings={appSettings}
                onCreateEventTrigger={onCreateEventTrigger}
                isSubPage={true}
              />
            )}

            {activeTab === 'attivazione' && user?.role === 'admin' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
                <EventControlManager 
                  token={token} 
                  triggerToast={triggerToast}
                  triggerConfirm={triggerConfirm}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default GarePage;
