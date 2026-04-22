import React, { useState } from 'react';
import EventsManager from './EventsManager';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface UserEventsProps {
  user: any;
  token?: string;
  societies: any[];
  onParticipate: (eventId: string, isRegistered: boolean) => void;
  onCreateTeam: (eventId: string) => void;
  initialEventId: string | null;
  onInitialEventHandled: () => void;
  appSettings: any;
}

export const UserEvents: React.FC<UserEventsProps> = ({
  user, token, societies, onParticipate, onCreateTeam, initialEventId, onInitialEventHandled, appSettings
}) => {
  const { t } = useLanguage();
  const { triggerConfirm, triggerToast } = useUI();
  const [activeTab, setActiveTab] = useState<'list' | 'registration' | 'results'>('list');
  const [viewModeProp, setViewModeProp] = useState<'list' | 'registration' | 'results' | 'calendar'>('list');

  const handleTabChange = (tab: 'list' | 'registration' | 'results') => {
    setActiveTab(tab);
    setViewModeProp(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resultsAccess = appSettings?.event_results_access || {};
  const checkAccess = (access: any, userSociety: string | undefined) => {
    if (typeof access === 'boolean') return access;
    if (!access?.enabled) return false;
    if (access.accessType === 'all') return true;
    if (access.accessType === 'specific' && Array.isArray(access.allowedSocieties)) {
      return access.allowedSocieties.some((s: string) => s?.trim().toLowerCase() === userSociety?.trim().toLowerCase());
    }
    return false;
  };
  const hasTiratoriAccess = user?.role === 'admin' || checkAccess(resultsAccess.tiratori, user?.society);

  return (
    <div className="space-y-4">
      {/* Sticky Header Section for Gare */}
      <div className="sticky top-16 sm:top-[104px] z-30 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-calendar-alt text-orange-600"></i>
            {t('events')}
          </h2>
          <div className="flex items-center gap-2">
            {/* Placeholder for KPI if needed, or just the view switcher */}
            {activeTab === 'list' && (
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                <button 
                  onClick={() => setViewModeProp('list')} 
                  className={`flex items-center justify-center w-9 sm:w-auto sm:px-3 h-8 sm:h-9 rounded-lg transition-all ${viewModeProp === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                  title={t('list_label')}
                >
                  <i className="fas fa-list text-sm"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline ml-2">{t('list_label')}</span>
                </button>
                <button 
                  onClick={() => setViewModeProp('calendar')} 
                  className={`flex items-center justify-center w-9 sm:w-auto sm:px-3 h-8 sm:h-9 rounded-lg transition-all ${viewModeProp === 'calendar' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                  title={t('calendar_label')}
                >
                  <i className="fas fa-calendar-alt text-sm"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline ml-2">{t('calendar_label')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
          <button 
            onClick={() => handleTabChange('list')} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            {t('events_tab_upper')}
          </button>
          <button 
            onClick={() => handleTabChange('registration')} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'registration' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            {t('register_to_events_upper')}
          </button>
          {hasTiratoriAccess && (
            <button 
              onClick={() => handleTabChange('results')} 
              className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'results' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              {t('events_results_upper')}
            </button>
          )}
        </div>
      </div>

      <div className="pt-2">
        <EventsManager 
          user={user} 
          token={token || ''} 
          societies={societies} 
          onParticipate={(event) => onParticipate(event.id, false)}
          onCreateTeam={(event) => onCreateTeam(event.id)}
          initialEventId={initialEventId}
          onInitialEventHandled={onInitialEventHandled}
          initialViewMode={viewModeProp as any}
          onInitialViewModeHandled={() => {}}
          hideViewSwitcher={true}
          appSettings={appSettings}
        />
      </div>
    </div>
  );
};

export default UserEvents;
