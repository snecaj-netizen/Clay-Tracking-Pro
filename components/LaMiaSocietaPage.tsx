import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminPanel from './AdminPanel';
import AICoachPage from './AICoachPage';

interface LaMiaSocietaPageProps {
  user: any;
  token: string;
  competitions: any[];
  cartridges: any[];
  cartridgeTypes: any[];
  societies: any[];
  triggerConfirm: any;
  triggerToast: any;
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
  triggerConfirm,
  triggerToast,
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

  const handleSwipe = (event: any, info: any) => {
    const threshold = 50;
    const currentIndex = availableTabs.indexOf(activeTab);
    
    if (info.offset.x < -threshold && currentIndex < availableTabs.length - 1) {
      // Swipe left -> go to next tab
      handleTabChange(availableTabs[currentIndex + 1]);
    } else if (info.offset.x > threshold && currentIndex > 0) {
      // Swipe right -> go to previous tab
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
                className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === tab ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
              >
                {tab === 'results' ? 'RISULTATI GARE' : tab === 'users' ? 'TIRATORI' : tab === 'team' ? 'SQUADRE' : tab === 'halloffame' ? 'HALL OF FAME' : 'COACH AI'}
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
      </div>

      {/* Content */}
      <motion.div 
        className="pt-2 overflow-x-hidden"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleSwipe}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
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
                triggerConfirm={triggerConfirm}
                onEditCompetition={onEditCompetition}
                onDeleteCompetition={onDeleteCompetition}
                initialTab={activeTab as any}
                onCloseSocietyDetail={handleCloseSocietyDetail}
                onUserUpdate={handleUserUpdate}
                triggerToast={triggerToast}
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
      </motion.div>
    </div>
  );
};

export default LaMiaSocietaPage;
