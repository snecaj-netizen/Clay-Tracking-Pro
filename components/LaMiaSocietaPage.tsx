import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminPanel from './AdminPanel';
import AICoachPage from './AICoachPage';

import { useUI } from '../contexts/UIContext';

interface LaMiaSocietaPageProps {
  user: any;
  token: string;
  competitions: any[];
  cartridges: any[];
  cartridgeTypes: any[];
  societies: any[];
  onEditCompetition: any;
  onDeleteCompetition: any;
  handleImport: any;
  handleCloseSocietyDetail: any;
  handleUserUpdate: any;
  setShowTour: any;
  appSettings: any;
  fetchSettings: any;
  initialTab?: 'results' | 'users' | 'team' | 'halloffame';
  onToggleFAB?: (hide: boolean) => void;
}

const LaMiaSocietaPage: React.FC<LaMiaSocietaPageProps> = ({
  user,
  token,
  competitions,
  cartridges,
  cartridgeTypes,
  societies,
  onEditCompetition,
  onDeleteCompetition,
  handleImport,
  handleCloseSocietyDetail,
  handleUserUpdate,
  setShowTour,
  appSettings,
  fetchSettings,
  initialTab,
  onToggleFAB
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const [activeTab, setActiveTab] = useState<'results' | 'users' | 'team' | 'halloffame' | 'coach'>(initialTab || 'results');
  const [direction, setDirection] = useState(0);
  const [stats, setStats] = useState({ users: 0, teams: 0 });
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

  const availableTabs: ('results' | 'users' | 'team' | 'halloffame' | 'coach')[] = ['results', 'users', 'team', 'halloffame', 'coach'];

  const handleTabChange = (newTab: 'results' | 'users' | 'team' | 'halloffame' | 'coach') => {
    const currentIndex = availableTabs.indexOf(activeTab);
    const nextIndex = availableTabs.indexOf(newTab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/society/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStats({ users: data.users, teams: data.teams });
        }
      } catch (err) {
        console.error('Error fetching society stats:', err);
      }
    };

    if (token) fetchStats();
  }, [token]);

  return (
    <div className="space-y-4">
      {/* Sticky Header Section */}
      <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-building text-orange-600"></i>
            La mia Società
          </h2>
          <div className="flex gap-2">
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-orange-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Tiratori</p>
              <p className="text-xs font-black text-white">{stats.users}</p>
            </div>
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-blue-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Squadre</p>
              <p className="text-xs font-black text-white">{stats.teams}</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center group/tabs">
          <div ref={tabsRef} className="flex-1 flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                data-tab={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === tab ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                {tab === 'results' ? 'RISULTATI GARE' : tab === 'users' ? 'TIRATORI' : tab === 'team' ? 'SQUADRE' : tab === 'halloffame' ? 'HALL OF FAME' : 'COACH AI'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeTab === 'coach' ? (
              <AICoachPage competitions={competitions} cartridges={cartridges} user={user} />
            ) : (
              <AdminPanel 
                user={user}
                token={token}
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                clientId=""
                onClientIdChange={() => {}}
                onImport={handleImport}
                isDriveConnected={false}
                onConnectDrive={() => {}}
                onDisconnectDrive={() => {}}
                onSaveDrive={() => {}}
                onLoadDrive={() => {}}
                syncStatus="idle"
                lastSync={null}
                onEditCompetition={onEditCompetition}
                onDeleteCompetition={onDeleteCompetition}
                initialTab={activeTab as any}
                onCloseSocietyDetail={handleCloseSocietyDetail}
                onUserUpdate={handleUserUpdate}
                societies={societies}
                hideTabs={true}
                onReplayTour={setShowTour}
                appSettings={appSettings}
                onSettingsUpdate={fetchSettings}
                onToggleFAB={onToggleFAB}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LaMiaSocietaPage;
