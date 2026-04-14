
import React, { useState } from 'react';
import EventsManager from './EventsManager';
import MyCompetitions from './MyCompetitions';
import { useUI } from '../contexts/UIContext';

interface GareMenuProps {
  user: any;
  token?: string;
  societies: any[];
  competitions: any[];
  cartridges: any[];
  onParticipate: (event: any) => void;
  onCreateTeam: (event: any) => void;
  onDeleteCompetition: (id: string) => void;
  onEditCompetition: (comp: any) => void;
  onSaveCompetition: (comp: any) => void;
  onSocietyClick: (name: string) => void;
  onNavigate: (view: any, tab?: string) => void;
  initialEventId: string | null;
  onInitialEventHandled: () => void;
  appSettings: any;
  initialTab?: 'list' | 'my-competitions' | 'managed' | 'registration';
}

const GareMenu: React.FC<GareMenuProps> = ({
  user, token, societies, competitions, cartridges,
  onParticipate, onCreateTeam, onDeleteCompetition, onEditCompetition, onSaveCompetition,
  onSocietyClick, onNavigate, initialEventId, onInitialEventHandled, appSettings, initialTab = 'list'
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const [activeTab, setActiveTab] = useState<'list' | 'my-competitions' | 'managed' | 'registration'>(initialTab);

  const canRegister = user?.role === 'admin' || user?.role === 'user';
  const canManage = user?.role === 'admin' || user?.role === 'society';

  return (
    <div className="space-y-4">
      <div className="sticky top-16 sm:top-[104px] z-30 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-calendar-alt text-orange-600"></i>
            Gare
          </h2>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
          <button 
            onClick={() => { setActiveTab('list'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            EVENTI
          </button>
          
          {(user?.role === 'admin' || user?.role === 'user') && (
            <button 
              onClick={() => { setActiveTab('my-competitions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'my-competitions' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              LE MIE GARE
            </button>
          )}

          {canManage && (
            <button 
              onClick={() => { setActiveTab('managed'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'managed' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              GESTIONE GARE
            </button>
          )}

          {canRegister && (
            <button 
              onClick={() => { setActiveTab('registration'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'registration' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
            >
              ISCRIVITI ALLE GARE
            </button>
          )}
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'list' && (
          <EventsManager 
            user={user} 
            token={token || ''} 
            societies={societies} 
            onParticipate={onParticipate}
            onCreateTeam={onCreateTeam}
            initialEventId={initialEventId}
            onInitialEventHandled={onInitialEventHandled}
            initialViewMode="list"
            appSettings={appSettings}
          />
        )}

        {activeTab === 'my-competitions' && (
          <MyCompetitions 
            competitions={competitions}
            events={[]}
            societies={societies}
            cartridges={cartridges}
            user={user}
            token={token}
            onDelete={onDeleteCompetition}
            onEdit={onEditCompetition}
            onUpdate={onSaveCompetition}
            onSocietyClick={onSocietyClick}
            onNavigate={onNavigate}
            onAddClick={() => onNavigate('new')}
            initialTab="history"
          />
        )}

        {activeTab === 'managed' && (
          <EventsManager 
            user={user} 
            token={token || ''} 
            societies={societies} 
            onParticipate={onParticipate}
            onCreateTeam={onCreateTeam}
            initialEventId={initialEventId}
            onInitialEventHandled={onInitialEventHandled}
            initialViewMode="managed"
            hideViewSwitcher={true}
            appSettings={appSettings}
          />
        )}

        {activeTab === 'registration' && (
          <EventsManager 
            user={user} 
            token={token || ''} 
            societies={societies} 
            onParticipate={onParticipate}
            onCreateTeam={onCreateTeam}
            initialEventId={initialEventId}
            onInitialEventHandled={onInitialEventHandled}
            initialViewMode="list"
            filterRegistrationOpen={true}
            hideViewSwitcher={true}
            appSettings={appSettings}
          />
        )}
      </div>
    </div>
  );
};

export default GareMenu;
