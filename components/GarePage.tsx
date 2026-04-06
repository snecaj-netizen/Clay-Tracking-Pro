import React, { useState, useMemo, useEffect } from 'react';
import EventsManager from './EventsManager';
import { EventControlManager } from './EventControlManager';

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

const GarePage: React.FC<GarePageProps> = ({
  user, token, triggerConfirm, triggerToast, societies, events, onParticipate, onCreateTeam,
  initialEventId, onInitialEventHandled, initialViewMode, onInitialViewModeHandled, appSettings,
  onCreateEventTrigger, onToggleFAB, onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<'eventi' | 'le-tue-gare' | 'iscrizione' | 'risultati' | 'gestione' | 'attivazione'>(
    (initialViewMode as any) || 'eventi'
  );

  useEffect(() => {
    if (onTabChange) onTabChange(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (onCreateEventTrigger && onCreateEventTrigger > 0 && (user?.role === 'admin' || user?.role === 'society')) {
      setActiveTab('gestione');
    }
  }, [onCreateEventTrigger, user?.role]);

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
    <div className="space-y-4">
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

        <div className="flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
          <button 
            onClick={() => { setActiveTab('eventi'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'eventi' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            EVENTI
          </button>
          
          {user?.role === 'society' && (
            <button 
              onClick={() => { setActiveTab('le-tue-gare'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'le-tue-gare' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              LE TUE GARE
            </button>
          )}
          
          <button 
            onClick={() => { setActiveTab('iscrizione'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'iscrizione' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            ISCRIZIONE ALLE GARE
          </button>
          
          <button 
            onClick={() => { setActiveTab('risultati'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'risultati' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            RISULTATI GARE
          </button>
          
          {(user?.role === 'admin' || user?.role === 'society') && (
            <button 
              onClick={() => { setActiveTab('gestione'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'gestione' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              GESTIONE GARE
            </button>
          )}
          
          {user?.role === 'admin' && (
            <button 
              onClick={() => { setActiveTab('attivazione'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'attivazione' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              ATTIVAZIONE GARE
            </button>
          )}
        </div>
      </div>

      <div className="pt-2">
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
      </div>
    </div>
  );
};

export default GarePage;
