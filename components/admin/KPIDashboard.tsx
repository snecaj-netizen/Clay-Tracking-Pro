import React from 'react';
import { DashboardStats } from '../../types';
import { useAdmin } from '../../contexts/AdminContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface KPIDashboardProps {}

const KPIDashboard: React.FC<KPIDashboardProps> = () => {
  const { dashboardStats: stats, kpiFilter, setKpiFilter } = useAdmin();
  const { t } = useLanguage();

  if (!stats) return null;
  return (
    <div className="mb-8 animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center">
            <i className="fas fa-chart-pie text-orange-500"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">KPI Dashboard</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('kpi_stats_desc')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 shadow-inner">
            {[
              { id: 'day', label: t('day') },
              { id: 'week', label: t('week') },
              { id: 'month', label: t('month') },
              { id: 'year', label: t('year') },
              { id: 'total', label: t('total') }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setKpiFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  kpiFilter === f.id 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center sm:block gap-3">
          <div className="flex items-center gap-2 sm:gap-3 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <i className="fas fa-user-check text-green-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('online_users')}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {stats.onlineUsersCount}
          </div>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center sm:block gap-3">
          <div className="flex items-center gap-2 sm:gap-3 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <i className="fas fa-building text-blue-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('online_societies')}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {stats.onlineSocietiesCount}
          </div>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <i className="fas fa-star text-orange-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('traffic_shooter')}</span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {stats.topUserName}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
            {stats.topUserTraffic} {t('activities_count')}
          </div>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <i className="fas fa-trophy text-purple-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('traffic_society')}</span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {stats.topSocName}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
            {stats.topSocTraffic} {t('activities_count')}
          </div>
        </div>
      </div>

      {/* Second row of KPIs for Activity */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <i className="fas fa-bullseye text-emerald-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('top_shooter_races')}</span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {stats.topUserByResultsName}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
            {stats.topUserResultsCount} {t('races_inserted_label')}
          </div>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <i className="fas fa-landmark text-indigo-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('top_society_races')}</span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {stats.topSocByResultsName}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
            {stats.topSocResultsCount} {t('total_races_label')}
          </div>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <i className="fas fa-chart-line text-amber-500 text-xs"></i>
            </div>
            <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('top_user_targets')}</span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {stats.topUserByTargetsName}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
            {stats.topUserTargetsTotal} {t('targets_label')}
          </div>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Activity KPI</div>
            <div className="text-[10px] text-slate-700 italic">{t('active_monitoring')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(KPIDashboard);
