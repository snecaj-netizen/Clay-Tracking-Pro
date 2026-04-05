import React, { useState } from 'react';
import HistoryList from './HistoryList';
import Dashboard from './Dashboard';
import AICoachPage from './AICoachPage';
import { Competition, Cartridge } from '../types';

interface MyCompetitionsProps {
  competitions: Competition[];
  events?: any[];
  societies: any[];
  cartridges: Cartridge[];
  user: any;
  token?: string;
  triggerConfirm: any;
  triggerToast?: any;
  onDelete: (id: string) => void;
  onEdit: (comp: Competition) => void;
  onUpdate: (comp: Competition) => void;
  onSocietyClick: (name: string) => void;
  onNavigate: (view: any, tab?: string) => void;
  onAddClick: () => void;
  initialTab?: 'history' | 'report' | 'coach';
}

export const MyCompetitions: React.FC<MyCompetitionsProps> = ({
  competitions, events, societies, cartridges, user, token,
  triggerConfirm, triggerToast, onDelete, onEdit, onUpdate, onSocietyClick, onNavigate, onAddClick, initialTab
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'report' | 'coach'>(initialTab || 'history');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4">
      {/* Sticky Header Section for Le Tue Gare */}
      <div className="sticky top-16 sm:top-[104px] z-30 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-list-ul text-orange-600"></i>
            Le Tue Gare
          </h2>
          <div className="flex items-center gap-2">
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-orange-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">Gare</p>
              <p className="text-xs font-black text-white">{competitions.length} <span className="text-[8px] text-slate-500 uppercase">Tot</span></p>
            </div>
            {activeTab === 'history' && (
              <>
                <button 
                  onClick={() => setShowFilters(!showFilters)} 
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all border relative ${showFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
                  title="Filtri"
                >
                  <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'}`}></i>
                  <span className="hidden sm:inline">Filtri</span>
                </button>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`flex items-center justify-center w-9 sm:w-auto sm:px-3 h-8 sm:h-9 rounded-lg transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                    title="Elenco"
                  >
                    <i className="fas fa-list text-sm"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline ml-2">Elenco</span>
                  </button>
                  <button 
                    onClick={() => setViewMode('calendar')} 
                    className={`flex items-center justify-center w-9 sm:w-auto sm:px-3 h-8 sm:h-9 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
                    title="Calendario"
                  >
                    <i className="fas fa-calendar-alt text-sm"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline ml-2">Calendario</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            GARE/ALLENAMENTI
          </button>
          <button 
            onClick={() => setActiveTab('report')} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'report' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            REPORT
          </button>
          <button 
            onClick={() => setActiveTab('coach')} 
            className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'coach' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}
          >
            COACH AI
          </button>
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <HistoryList 
              competitions={competitions} 
              events={events}
              societies={societies}
              onDelete={onDelete}
              onEdit={onEdit}
              onUpdate={onUpdate}
              onSocietyClick={onSocietyClick}
              triggerConfirm={triggerConfirm}
              user={user}
              token={token}
              triggerToast={triggerToast}
              viewModeProp={viewMode}
              showFiltersProp={showFilters}
              onViewModeChange={setViewMode}
              onShowFiltersChange={setShowFilters}
            />
          </div>
        )}
        {activeTab === 'report' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Dashboard 
              competitions={competitions} 
              societies={societies}
              events={events || []}
              onAddClick={onAddClick}
              user={user} 
              onCoachClick={() => setActiveTab('coach')}
              onNavigate={onNavigate}
            />
          </div>
        )}
        {activeTab === 'coach' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AICoachPage 
              competitions={competitions} 
              cartridges={cartridges} 
              user={user} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCompetitions;
