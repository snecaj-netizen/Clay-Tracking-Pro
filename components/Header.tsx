
import React, { useState, useEffect, useCallback } from 'react';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: any, tab?: string) => void;
  onLogout?: () => void;
  user?: any;
  appSettings?: any;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onLogout, user, appSettings, canGoBack, canGoForward, onGoBack, onGoForward }) => {
  const [isLightMode, setIsLightMode] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    const handleCloseAllMenus = () => {
      setIsProfileOpen(false);
      setIsNotificationOpen(false);
    };

    window.addEventListener('clay-tracker-close-menus', handleCloseAllMenus);
    return () => window.removeEventListener('clay-tracker-close-menus', handleCloseAllMenus);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-dropdown-container')) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsLightMode(true);
      document.documentElement.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    if (isLightMode) {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      setIsLightMode(false);
    } else {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      setIsLightMode(true);
    }
  };

  const handleNotificationToggle = useCallback((isOpen: boolean) => {
    setIsNotificationOpen(isOpen);
  }, []);

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

  const hasSocietaAccess = user?.role === 'admin' || checkAccess(resultsAccess.societa, user?.society);
  const hasTiratoriAccess = user?.role === 'admin' || checkAccess(resultsAccess.tiratori, user?.society);

  const isAnyMenuOpen = isProfileOpen || isNotificationOpen;

  const menuItems = user?.role === 'society' ? [
    ...(hasSocietaAccess ? [{ id: 'event-results', label: 'Risultati Gare', icon: 'fa-trophy' }] : []),
    { id: 'events', label: 'Gare', icon: 'fa-calendar-alt' },
    { id: 'societies', label: 'Società TAV', icon: 'fa-building' },
    { id: 'ai-coach', label: 'Coach AI', icon: 'fa-user-tie' },
  ] : [
    { id: 'history', label: 'Le Tue Gare', icon: 'fa-list-ul' },
    { id: 'dashboard', label: 'Report Gare', icon: 'fa-chart-pie' },
    { id: 'ai-coach', label: 'Coach AI', icon: 'fa-user-tie' },
    { id: 'warehouse', label: 'Magazzino', icon: 'fa-box-open' },
    { id: 'events', label: 'Gare', icon: 'fa-calendar-alt' },
    ...(hasTiratoriAccess ? [{ id: 'event-results', label: 'Risultati Gare', icon: 'fa-trophy' }] : []),
    { id: 'societies', label: 'Società TAV', icon: 'fa-building' },
  ];

  return (
    <>
      {isAnyMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[1080] sm:hidden animate-in fade-in duration-200"
          onClick={() => {
            setIsProfileOpen(false);
            setIsNotificationOpen(false);
            window.dispatchEvent(new CustomEvent('clay-tracker-close-menus'));
          }}
        ></div>
      )}
      <header className="fixed top-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-b border-slate-900/50 z-[1100]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Logo and User Actions */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 mr-2">
              <button 
                onClick={onGoBack} 
                disabled={!canGoBack}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${canGoBack ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800' : 'bg-slate-900/30 text-slate-700 border border-slate-800/30 cursor-not-allowed'}`}
                title="Indietro"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              <button 
                onClick={onGoForward} 
                disabled={!canGoForward}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${canGoForward ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800' : 'bg-slate-900/30 text-slate-700 border border-slate-800/30 cursor-not-allowed'}`}
                title="Avanti"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
            <button 
              onClick={() => onNavigate(user?.role === 'society' ? 'admin' : 'history')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity active:scale-95"
            >
              <div className="bg-orange-600 p-2 rounded-lg shadow-inner">
                <i className="fas fa-bullseye text-xl text-white"></i>
              </div>
              <div className="text-left">
                <h1 className="text-xl font-black tracking-tight text-white leading-none text-left">
                  Clay Tracker <span className="text-orange-600">Pro</span>
                </h1>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 relative profile-dropdown-container">
            <button 
              onClick={() => {
                if (!isProfileOpen) {
                  window.dispatchEvent(new CustomEvent('clay-tracker-close-menus'));
                }
                setIsProfileOpen(!isProfileOpen);
              }}
              className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-xl border transition-all active:scale-95 group ${currentView === 'admin' || isProfileOpen ? 'bg-orange-600 border-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
            >
              <div className="hidden sm:block text-right">
                <div className={`text-xs font-black uppercase tracking-widest ${currentView === 'admin' || isProfileOpen ? 'text-orange-200' : 'text-slate-500'}`}>
                  {user?.role === 'admin' ? 'Amministratore' : user?.role === 'society' ? 'Società' : 'Tiratore'}
                </div>
                <div className={`text-sm font-bold ${currentView === 'admin' || isProfileOpen ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                  {user?.name} {user?.surname}
                </div>
              </div>
              
              {/* Explicit Label for Mobile */}
              <span className={`sm:hidden text-[10px] font-black uppercase tracking-widest ${currentView === 'admin' || isProfileOpen ? 'text-white' : 'text-slate-400'}`}>
                {isProfileOpen ? 'CHIUDI' : 'MENU'}
              </span>

              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all overflow-hidden ${currentView === 'admin' || isProfileOpen ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-orange-500'}`}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <i className={`fas ${user?.role === 'admin' ? 'fa-users-cog' : 'fa-user'}`}></i>
                )}
              </div>
              <i className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-white' : 'text-slate-500'}`}></i>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-[1100] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-slate-800 mb-1">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Account</div>
                  <div className="text-sm font-bold text-white truncate">{user?.email}</div>
                </div>
                
                <button 
                  onClick={() => { onNavigate('admin', 'profile'); setIsProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <i className="fas fa-user-circle w-5 text-slate-500"></i>
                  Il Tuo Profilo
                </button>

                {(user?.role === 'admin' || user?.role === 'society') && (
                  <div className="py-1">
                    <div className="px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">Gestione</div>
                    <button 
                      onClick={() => { onNavigate('events', 'managed'); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      <i className="fas fa-tasks w-5 text-indigo-500 group-hover:text-white"></i>
                      Gare gestite
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        <button 
                          onClick={() => { onNavigate('admin', 'event-control'); setIsProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-orange-600 hover:text-white transition-colors"
                        >
                          <i className="fas fa-tasks w-5 text-orange-500 group-hover:text-white"></i>
                          Attivazione gare
                        </button>
                        <button 
                          onClick={() => { onNavigate('admin', 'users'); setIsProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <i className="fas fa-users w-5 text-slate-500"></i>
                          Gestione Utente
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => { onNavigate('admin', 'settings'); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <i className="fas fa-cog w-5 text-slate-500"></i>
                      Impostazioni
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-800 mt-1 pt-1">
                  <button 
                    onClick={() => { onLogout?.(); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <i className="fas fa-sign-out-alt w-5"></i>
                    Esci
                  </button>
                </div>
              </div>
            )}

            <button 
              onClick={toggleTheme} 
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-500/50 transition-all active:scale-95"
              title={isLightMode ? "Passa al tema scuro" : "Passa al tema chiaro"}
            >
              <i className={`fas ${isLightMode ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>

            <NotificationBell 
              token={localStorage.getItem('auth_token') || ''} 
              onToggle={handleNotificationToggle}
            />
          </div>
        </div>

        {/* Row 2: Desktop/Tablet Navigation (Hidden on Mobile) */}
        <nav className="hidden sm:flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
          {menuItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => onNavigate(item.id, (item as any).tab)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === item.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
            >
              <i className={`fas ${item.icon} text-xs`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
    </>
  );
};

export default Header;
