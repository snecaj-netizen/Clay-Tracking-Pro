import React, { useState, useMemo, useEffect } from 'react';
import HistoryList from './HistoryList';
import Dashboard from './Dashboard';
import AICoachPage from './AICoachPage';

interface LeTueGarePageProps {
  user: any;
  token: string;
  competitions: any[];
  events: any[];
  societies: any[];
  cartridges: any[];
  onDeleteCompetition: (id: string) => void;
  onEditCompetition: (comp: any) => void;
  onUpdateCompetition: (comp: any) => void;
  onSocietyClick: (name: string) => void;
  triggerConfirm: any;
  triggerToast: any;
  onNavigate: (view: any, tab?: string) => void;
  onTabChange?: (tab: string) => void;
}

const LeTueGarePage: React.FC<LeTueGarePageProps> = ({
  user, token, competitions, events, societies, cartridges,
  onDeleteCompetition, onEditCompetition, onUpdateCompetition,
  onSocietyClick, triggerConfirm, triggerToast, onNavigate, onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'report' | 'coach'>('history');

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  const stats = useMemo(() => {
    const totalGare = competitions.length;
    const totalPiattelli = competitions.reduce((acc, c) => acc + (c.totalTargets || 0), 0);
    const totalRotti = competitions.reduce((acc, c) => {
      const seriesTotal = c.series?.reduce((sAcc, s) => sAcc + (s.score || 0), 0) || 0;
      return acc + seriesTotal;
    }, 0);
    const media = totalPiattelli > 0 ? (totalRotti / totalPiattelli * 100).toFixed(1) : '0.0';
    
    return { totalGare, totalRotti, media };
  }, [competitions]);

  return (
    <div className="space-y-4">
      {/* Sticky Header Section */}
      <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-list-ul text-orange-600"></i>
            Le Tue Gare
          </h2>
          <div className="flex gap-2">
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-orange-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Gare</p>
              <p className="text-xs font-black text-white">{stats.totalGare}</p>
            </div>
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-blue-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Media</p>
              <p className="text-xs font-black text-white">{stats.media}%</p>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar">
          {user?.role !== 'society' && (
            <>
              <button 
                onClick={() => { setActiveTab('history'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                className={`flex-1 min-w-[120px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
              >
                GARE/ALLENAMENTI
              </button>
              <button 
                onClick={() => { setActiveTab('report'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'report' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
              >
                REPORT
              </button>
            </>
          )}
          <button 
            onClick={() => { setActiveTab('coach'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'coach' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            COACH AI
          </button>
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'history' && user?.role !== 'society' && (
          <HistoryList 
            competitions={competitions} 
            events={events}
            societies={societies}
            onDelete={onDeleteCompetition}
            onEdit={onEditCompetition}
            onUpdate={onUpdateCompetition}
            onSocietyClick={onSocietyClick}
            triggerConfirm={triggerConfirm}
            user={user}
            token={token}
            triggerToast={triggerToast}
          />
        )}
        
        {activeTab === 'report' && user?.role !== 'society' && (
          <Dashboard 
            competitions={competitions} 
            societies={societies}
            events={events}
            user={user} 
            onAddClick={() => onNavigate('new')} 
            onCoachClick={() => setActiveTab('coach')}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === 'coach' && (
          <AICoachPage competitions={competitions} cartridges={cartridges} user={user} />
        )}
      </div>
    </div>
  );
};

export default LeTueGarePage;
