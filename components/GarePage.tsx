import React, { useState, useMemo, useEffect, useRef } from 'react';
import EventsManager from './EventsManager';
import { EventControlManager } from './EventControlManager';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="space-y-4 overflow-x-hidden">
      {/* Sticky Header Section */}
      <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-trophy text-orange-600"></i>
            Gare
          </h2>
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

        <div ref={tabsRef} className="flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
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
      </div>

      <motion.div 
        className="pt-2 min-h-[60vh]"
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
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialEventId={initialEventId}
                onInitialEventHandled={onInitialEventHandled}
                initialViewMode="list"
                hideViewSwitcher={true}
                appSettings={appSettings}
                onToggleFAB={onToggleFAB}
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
                  onParticipate={onParticipate}
                  onCreateTeam={onCreateTeam}
                  restrictToSociety={true}
                  initialViewMode="list"
                  hideViewSwitcher={true}
                  appSettings={appSettings}
                  onToggleFAB={onToggleFAB}
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
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialEventId={initialEventId}
                onInitialEventHandled={onInitialEventHandled}
                initialViewMode="list"
                hideViewSwitcher={true}
                filterRegistrationOpen={true}
                appSettings={appSettings}
              />
            )}

            {activeTab === 'risultati' && (
              <EventsManager 
                user={user} 
                token={token} 
                triggerConfirm={triggerConfirm} 
                triggerToast={triggerToast}
                societies={societies} 
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialViewMode="results"
                hideViewSwitcher={true}
                appSettings={appSettings}
              />
            )}

            {activeTab === 'gestione' && (user?.role === 'admin' || user?.role === 'society') && (
              <EventsManager 
                user={user} 
                token={token} 
                triggerConfirm={triggerConfirm} 
                triggerToast={triggerToast}
                societies={societies} 
                onParticipate={onParticipate}
                onCreateTeam={onCreateTeam}
                initialViewMode="managed"
                hideViewSwitcher={true}
                appSettings={appSettings}
                onCreateEventTrigger={onCreateEventTrigger}
                onToggleFAB={onToggleFAB}
              />
            )}

            {activeTab === 'attivazione' && user?.role === 'admin' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
