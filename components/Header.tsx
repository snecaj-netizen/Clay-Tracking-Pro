
import React, { useState, useEffect, useCallback } from 'react';
import NotificationBell from './NotificationBell';
import { useLanguage } from '../contexts/LanguageContext';
import { useUI } from '../contexts/UIContext';

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
  onLoginClick?: () => void;
  onRefreshUser?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onLogout, user, appSettings, canGoBack, canGoForward, onGoBack, onGoForward, onLoginClick, onRefreshUser }) => {
  const { language, setLanguage, t } = useLanguage();
  const { triggerToast, isHeaderVisible } = useUI();
  const [isLightMode, setIsLightMode] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Update CSS variable based on header visibility
    const root = document.documentElement;
    if (isHeaderVisible) {
      root.style.setProperty('--header-top', '64px');
      root.style.setProperty('--header-translate', '0px');
    } else {
      root.style.setProperty('--header-top', '0px');
      root.style.setProperty('--header-translate', '-64px');
    }
  }, [isHeaderVisible]);

  useEffect(() => {
    const handleCloseAllMenus = () => {
      setIsProfileOpen(false);
      setIsNotificationOpen(false);
      setIsSidebarOpen(false);
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
    // Default to light theme if no preference is saved
    if (savedTheme === 'dark') {
      setIsLightMode(false);
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-theme');
    } else {
      setIsLightMode(true);
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    if (isLightMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      setIsLightMode(false);
    } else {
      document.documentElement.classList.remove('dark');
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

  const isAnyMenuOpen = isProfileOpen || isNotificationOpen || isSidebarOpen;

  const menuItems = user?.role === 'society' ? [
    { id: 'home', label: t('home'), icon: 'fa-home' },
    { id: 'gare', label: t('events'), icon: 'fa-calendar-alt' },
    { id: 'la-mia-societa', label: t('managed_races'), icon: 'fa-building' },
    { id: 'societies', label: t('societies'), icon: 'fa-shield-alt' },
  ] : user?.role === 'admin' ? [
    { id: 'home', label: t('home'), icon: 'fa-home' },
    { id: 'le-tue-gare', label: t('your_results'), icon: 'fa-list-ul' },
    { id: 'warehouse', label: t('warehouse'), icon: 'fa-box-open' },
    { id: 'gare', label: t('events'), icon: 'fa-calendar-alt' },
    { id: 'la-mia-societa', label: t('managed_races'), icon: 'fa-building' },
    { id: 'societies', label: t('societies'), icon: 'fa-shield-alt' },
  ] : [
    { id: 'home', label: t('home'), icon: 'fa-home' },
    { id: 'le-tue-gare', label: t('your_results'), icon: 'fa-list-ul' },
    { id: 'warehouse', label: t('warehouse'), icon: 'fa-box-open' },
    { id: 'gare', label: t('events'), icon: 'fa-calendar-alt' },
    { id: 'societies', label: t('societies'), icon: 'fa-shield-alt' },
  ];

  return (
    <>
      {isAnyMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[1080] animate-in fade-in duration-200"
          onClick={() => {
            setIsProfileOpen(false);
            setIsNotificationOpen(false);
            setIsSidebarOpen(false);
            window.dispatchEvent(new CustomEvent('clay-tracker-close-menus'));
          }}
        ></div>
      )}

      {/* Sidebar for Desktop/Tablet */}
      <div 
        className={`fixed inset-y-0 left-0 w-72 bg-slate-950 [.light-theme_&]:bg-white border-r border-slate-900/50 [.light-theme_&]:border-slate-200 z-[1200] transform transition-transform duration-300 ease-in-out shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-900 [.light-theme_&]:border-slate-100">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">{t('menu')}</h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white [.light-theme_&]:hover:text-black transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto no-scrollbar">
            {menuItems.map((item) => (
              <button 
                key={item.id}
                onClick={() => {
                  onNavigate(item.id, (item as any).tab);
                  setIsSidebarOpen(false);
                }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentView === item.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-400 [.light-theme_&]:text-slate-500 hover:text-slate-200 [.light-theme_&]:hover:text-slate-900 hover:bg-slate-900/50 [.light-theme_&]:hover:bg-slate-50'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentView === item.id ? 'bg-white/20' : 'bg-slate-900 [.light-theme_&]:bg-slate-100'}`}>
                  <i className={`fas ${item.icon} text-xs`}></i>
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          
          {/* Footer of Sidebar */}
          <div className="p-4 border-t border-slate-900 [.light-theme_&]:border-slate-100 space-y-4">
            <div className="px-2">
                <div className="text-[10px] font-black text-slate-600 [.light-theme_&]:text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">{t('language_label') || 'Lingua'}</div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setLanguage('it')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'it' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-900 [.light-theme_&]:bg-slate-100 text-slate-500 [.light-theme_&]:text-slate-500 hover:text-slate-300 [.light-theme_&]:hover:text-slate-900 border border-slate-800 [.light-theme_&]:border-slate-200'}`}
                  >
                    ITA
                  </button>
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-900 [.light-theme_&]:bg-slate-100 text-slate-500 [.light-theme_&]:text-slate-500 hover:text-slate-300 [.light-theme_&]:hover:text-slate-900 border border-slate-800 [.light-theme_&]:border-slate-200'}`}
                  >
                    ENG
                  </button>
                </div>
              </div>
            <div className="text-[10px] text-slate-600 text-center uppercase tracking-[0.2em] italic opacity-50">
              Clay Performance v0.0.1
            </div>
          </div>
        </div>
      </div>

      <header 
        className={`fixed top-0 left-0 right-0 bg-slate-950/95 [.light-theme_&]:bg-white/95 backdrop-blur-xl border-b border-slate-900/50 [.light-theme_&]:border-slate-200 z-[1100] transition-all duration-300 ${!isHeaderVisible ? '-translate-y-full' : 'translate-y-0'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Logo and User Actions */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Hamburger Menu Button - Desktop/Tablet Only */}
            {(currentView !== 'public-portal' || user) && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="hidden sm:flex h-10 px-3 rounded-xl items-center gap-2 bg-slate-900 [.light-theme_&]:bg-white text-slate-400 [.light-theme_&]:text-slate-500 border border-slate-800 [.light-theme_&]:border-slate-200 hover:border-orange-500/50 hover:text-orange-500 transition-all active:scale-95"
                title={t('menu')}
              >
                <i className="fas fa-bars"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">MENU</span>
              </button>
            )}

            {(currentView !== 'public-portal' || user) && (
              <div className="hidden lg:flex items-center gap-1">
                <button 
                  onClick={onGoBack} 
                  disabled={!canGoBack}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${canGoBack ? 'bg-slate-900 [.light-theme_&]:bg-white text-slate-300 [.light-theme_&]:text-slate-600 hover:bg-slate-800 [.light-theme_&]:hover:bg-slate-100 hover:text-white border border-slate-800 [.light-theme_&]:border-slate-200' : 'bg-slate-900/30 text-slate-700 border border-slate-800/30 cursor-not-allowed'}`}
                  title={t('previous')}
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                </button>
                <button 
                  onClick={onGoForward} 
                  disabled={!canGoForward}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${canGoForward ? 'bg-slate-900 [.light-theme_&]:bg-white text-slate-300 [.light-theme_&]:text-slate-600 hover:bg-slate-800 [.light-theme_&]:hover:bg-slate-100 hover:text-white border border-slate-800 [.light-theme_&]:border-slate-200' : 'bg-slate-900/30 text-slate-700 border border-slate-800/30 cursor-not-allowed'}`}
                  title={t('next')}
                >
                  <i className="fas fa-chevron-right text-xs"></i>
                </button>
              </div>
            )}
            <button 
              onClick={() => {
                if (currentView === 'public-portal' && !user) return;
                onNavigate('home');
              }}
              className={`flex items-center gap-3 hover:opacity-80 transition-opacity active:scale-95 ${currentView === 'public-portal' && !user ? 'cursor-default' : ''}`}
            >
              <div className="bg-orange-600 p-2 rounded-lg shadow-inner">
                <i className="fas fa-bullseye text-xl text-white"></i>
              </div>
              <div className="text-left">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white [.light-theme_&]:text-slate-900 leading-tight sm:leading-none text-left">
                  Clay <br className="sm:hidden" /> <span className="text-orange-600">Performance</span>
                </h1>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 relative profile-dropdown-container">
            {(currentView !== 'public-portal' || user) ? (
              <>
                <button 
                  onClick={() => {
                    if (!isProfileOpen) {
                      window.dispatchEvent(new CustomEvent('clay-tracker-close-menus'));
                      onRefreshUser?.();
                    }
                    setIsProfileOpen(!isProfileOpen);
                  }}
                  className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-xl border transition-all active:scale-95 group ${currentView === 'admin' || isProfileOpen ? 'bg-orange-600 border-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 [.light-theme_&]:bg-white border-slate-800 [.light-theme_&]:border-slate-200 hover:border-slate-700'}`}
                >
                  <div className="hidden sm:block text-right">
                    <div className={`text-xs font-black uppercase tracking-widest ${currentView === 'admin' || isProfileOpen ? 'text-orange-200' : 'text-slate-500'}`}>
                      {user?.role === 'admin' ? t('admin_role') : user?.role === 'society' ? t('society_role') : t('shooter_role')}
                    </div>
                    <div className={`text-sm font-bold ${currentView === 'admin' || isProfileOpen ? 'text-white' : 'text-slate-200 [.light-theme_&]:text-slate-700 group-hover:text-white [.light-theme_&]:group-hover:text-black'}`}>
                      {user?.name} {user?.surname}
                    </div>
                  </div>
                  
                  {/* Explicit Label for Mobile */}
                  <span className={`sm:hidden text-[10px] font-black uppercase tracking-widest ${currentView === 'admin' || isProfileOpen ? 'text-white' : 'text-slate-400'}`}>
                    {isProfileOpen ? t('close_menu') : t('open_menu')}
                  </span>

                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all overflow-hidden ${currentView === 'admin' || isProfileOpen ? 'bg-white/20 text-white' : 'bg-slate-800 [.light-theme_&]:bg-slate-100 text-slate-400 group-hover:text-orange-500'}`}>
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
                  <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 [.light-theme_&]:bg-white border border-slate-800 [.light-theme_&]:border-slate-200 rounded-2xl shadow-2xl py-2 z-[1100] animate-in fade-in slide-in-from-top-2 duration-200 transition-colors">
                    <div className="px-4 py-3 border-b border-slate-800 [.light-theme_&]:border-slate-100 mb-1">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('account')}</div>
                      <div className="text-sm font-bold text-white [.light-theme_&]:text-slate-900 truncate">{user?.email}</div>
                      {user && !user.email_verified && (
                        <div className="text-[9px] font-black text-orange-500 uppercase flex items-center gap-1 mt-1 font-mono">
                          <i className="fas fa-exclamation-triangle"></i>
                          {t('email_not_verified_label')}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => { onNavigate('profile'); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 [.light-theme_&]:text-slate-600 hover:bg-slate-800 [.light-theme_&]:hover:bg-slate-100 hover:text-white [.light-theme_&]:hover:text-black transition-colors"
                    >
                      <i className="fas fa-user-circle w-5 text-slate-500"></i>
                      {t('your_profile')}
                    </button>

                    <div className="px-4 py-2 flex gap-1">
                      <button 
                        onClick={() => { onNavigate('public-portal'); setIsProfileOpen(false); }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-indigo-600/10 text-indigo-500 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 group/portal"
                        title={t('results_portal')}
                      >
                        <i className="fas fa-external-link-alt"></i>
                        {t('results_portal')}
                      </button>
                      <button 
                        onClick={() => {
                          const portalUrl = `${window.location.origin}/portal`;
                          navigator.clipboard.writeText(portalUrl).then(() => {
                            triggerToast(t('portal_link_copied'), 'success');
                          });
                        }}
                        className="px-4 flex items-center justify-center bg-slate-800 [.light-theme_&]:bg-slate-100 text-slate-400 [.light-theme_&]:text-slate-500 rounded-xl hover:bg-slate-700 [.light-theme_&]:hover:bg-slate-200 hover:text-white [.light-theme_&]:hover:text-slate-900 transition-all border border-slate-700 [.light-theme_&]:border-slate-200 active:scale-95"
                        title={t('copy_portal_link')}
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>

                    {/* Language Selector in Profile Menu */}
                    <div className="px-4 py-2 border-t border-slate-800/50 [.light-theme_&]:border-slate-100 mt-1">
                        <div className="text-[10px] font-black text-slate-500 [.light-theme_&]:text-slate-400 uppercase tracking-widest mb-2">{t('language_label') || 'Lingua'}</div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setLanguage('it'); setIsProfileOpen(false); }}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'it' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-800 [.light-theme_&]:bg-slate-100 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-slate-200 [.light-theme_&]:hover:text-slate-900'}`}
                          >
                            Italiano
                          </button>
                          <button 
                            onClick={() => { setLanguage('en'); setIsProfileOpen(false); }}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-800 [.light-theme_&]:bg-slate-100 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-slate-200 [.light-theme_&]:hover:text-slate-900'}`}
                          >
                            English
                          </button>
                        </div>
                      </div>
                    

                    {(user?.role === 'admin' || user?.role === 'society') && (
                      <div className="py-1">
                        <div className="px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('management')}</div>
                        <button 
                          onClick={() => { onNavigate('gare', 'gestione'); setIsProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-orange-600 hover:text-white transition-colors"
                        >
                          <i className="fas fa-calendar-alt w-5 text-orange-500 group-hover:text-white"></i>
                          {t('manage_competitions_menu')}
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            <button 
                              onClick={() => { onNavigate('admin-control'); setIsProfileOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-orange-600 hover:text-white transition-colors"
                            >
                              <i className="fas fa-tasks w-5 text-orange-500 group-hover:text-white"></i>
                              {t('race_activation')}
                            </button>
                            <button 
                              onClick={() => { onNavigate('la-mia-societa', 'users'); setIsProfileOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                              <i className="fas fa-users w-5 text-slate-500"></i>
                              {t('user_management')}
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => { onNavigate('settings'); setIsProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <i className="fas fa-cog w-5 text-slate-500"></i>
                          {t('settings')}
                        </button>
                      </div>
                    )}

                    <div className="border-t border-slate-800 mt-1 pt-1">
                      <button 
                        onClick={() => { onLogout?.(); setIsProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <i className="fas fa-sign-out-alt w-5"></i>
                        {t('logout')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button 
                onClick={() => onLoginClick ? onLoginClick() : window.location.href = '/'}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 active:scale-95"
              >
                {t('login')}
              </button>
            )}

            {!user && (
              <button 
                onClick={() => setLanguage(language === 'it' ? 'en' : 'it')} 
                className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-black text-slate-400 hover:text-orange-500 hover:border-orange-500/50 transition-all active:scale-95"
                title={language === 'it' ? 'Switch to English' : 'Passa all\'Italiano'}
              >
                {language.toUpperCase()}
              </button>
            )}

            <button 
              onClick={toggleTheme} 
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-500/50 transition-all active:scale-95"
              title={isLightMode ? (language === 'it' ? "Passa al tema scuro" : "Switch to dark mode") : (language === 'it' ? "Passa al tema chiaro" : "Switch to light mode")}
            >
              <i className={`fas ${isLightMode ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>

            {(currentView !== 'public-portal' || user) && (
              <NotificationBell 
                token={localStorage.getItem('auth_token') || ''} 
                onToggle={handleNotificationToggle}
              />
            )}
          </div>
        </div>

        {/* Navigation was here - moved to sidebar */}
      </div>
    </header>
    </>
  );
};

export default Header;
