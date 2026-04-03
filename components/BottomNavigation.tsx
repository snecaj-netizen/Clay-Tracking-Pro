
import React from 'react';
import { Discipline } from '../types';

interface BottomNavigationProps {
  currentView: string;
  onNavigate: (view: any, tab?: string) => void;
  user?: any;
  appSettings?: any;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentView, onNavigate, user, appSettings }) => {
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

  // Define the main navigation items for shooters
  const navItems = [
    { id: 'history', label: 'Le Tue Gare', icon: 'fa-list-ul' },
    { id: 'dashboard', label: 'Report', icon: 'fa-chart-pie' },
    { id: 'ai-coach', label: 'Coach AI', icon: 'fa-user-tie' },
    { id: 'warehouse', label: 'Magazzino', icon: 'fa-box-open' },
    { id: 'events', label: 'Gare', icon: 'fa-calendar-alt' },
  ];

  // If user has access to event results, we might want to add it, but space is limited.
  // Let's keep it to the most essential 5 items for the bottom bar.
  // If we have more, we might need a "More" button or just prioritize.
  
  if (user?.role === 'society') return null; // Societies use the Admin Panel navigation

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-900/50 z-[1000] pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 transition-all active:scale-95 ${
                isActive ? 'text-orange-500' : 'text-slate-500'
              }`}
            >
              <div className={`relative flex items-center justify-center w-10 h-8 mb-0.5 rounded-xl transition-all ${
                isActive ? 'bg-orange-600/10' : ''
              }`}>
                <i className={`fas ${item.icon} text-lg`}></i>
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                )}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-tighter truncate w-full text-center px-1 ${
                isActive ? 'text-orange-500' : 'text-slate-500'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
