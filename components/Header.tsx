
import React, { useState, useEffect } from 'react';
import { Competition } from '../types';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: any) => void;
  onLogout?: () => void;
  user?: any;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onLogout, user }) => {
  const [isLightMode, setIsLightMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

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

  const menuItems = [
    { id: 'history', label: 'Gare/Allenamenti', icon: 'fa-list-ul' },
    { id: 'dashboard', label: 'Report Gare', icon: 'fa-chart-pie' },
    { id: 'warehouse', label: 'Magazzino', icon: 'fa-box-open' },
    { id: 'admin', label: 'Risultati', icon: 'fa-poll' },
    { id: 'events', label: 'Eventi', icon: 'fa-calendar-alt' },
    { id: 'societies', label: 'Società TAV', icon: 'fa-building' },
  ].filter(item => {
    if (user?.role === 'society') {
      return item.id === 'events' || item.id === 'societies' || item.id === 'admin';
    }
    if (item.id === 'admin') return false; // Only show in profile button for others
    return true;
  });

  return (
    <>
      {/* Overlay for mobile menu - Moved outside header for better event handling */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] sm:hidden transition-opacity duration-300"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      
      <header className="fixed top-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-b border-slate-900/50 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Logo and User Actions */}
        <div className="flex items-center justify-between h-16">
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

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => onNavigate('admin')}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-all active:scale-95 group ${currentView === 'admin' ? 'bg-orange-600 border-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
            >
              <div className="hidden sm:block text-right">
                <div className={`text-[10px] font-black uppercase tracking-widest ${currentView === 'admin' ? 'text-orange-200' : 'text-slate-500'}`}>
                  {user?.role === 'admin' ? 'Amministratore' : user?.role === 'society' ? 'Società' : 'Tiratore'}
                </div>
                <div className={`text-sm font-bold ${currentView === 'admin' ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                  {user?.name} {user?.surname}
                </div>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all overflow-hidden ${currentView === 'admin' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-orange-500'}`}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <i className={`fas ${user?.role === 'admin' ? 'fa-users-cog' : 'fa-user'}`}></i>
                )}
              </div>
            </button>

            <button 
              onClick={toggleTheme} 
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-500/50 transition-all active:scale-95"
              title={isLightMode ? "Passa al tema scuro" : "Passa al tema chiaro"}
            >
              <i className={`fas ${isLightMode ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>

            <NotificationBell token={localStorage.getItem('auth_token') || ''} />

            {onLogout && (
              <button 
                onClick={onLogout}
                className="hidden sm:flex w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 items-center justify-center text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                title="Esci"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            )}

            {/* Kebab Menu Button (Mobile Only) */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="sm:hidden w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-orange-500 transition-all active:scale-95"
            >
              <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-ellipsis-v'}`}></i>
            </button>
          </div>
        </div>

        {/* Row 2: Desktop/Tablet Navigation (Hidden on Mobile) */}
        <nav className="hidden sm:flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
          {menuItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => onNavigate(item.id)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === item.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
            >
              <i className={`fas ${item.icon} text-xs`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Mobile Dropdown Menu */}
        {isMenuOpen && (
          <div className="sm:hidden py-4 border-t border-slate-900/50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setIsMenuOpen(false); }} 
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentView === item.id ? 'bg-orange-600 text-white' : 'text-slate-400 bg-slate-900/50'}`}
                >
                  <i className={`fas ${item.icon} w-5`}></i>
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="mt-2 px-4 py-3 bg-slate-900/30 rounded-xl border border-slate-800/50 flex items-center justify-between">
                <button 
                  onClick={() => { onNavigate('admin'); setIsMenuOpen(false); }}
                  className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity active:scale-95 overflow-hidden pr-2"
                >
                  {user?.avatar ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 shrink-0">
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700 shrink-0">
                      <i className={`fas ${user?.role === 'admin' ? 'fa-users-cog' : 'fa-user'}`}></i>
                    </div>
                  )}
                  <div className="truncate">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">
                      {user?.role === 'admin' ? 'Amministratore' : user?.role === 'society' ? 'Società' : 'Tiratore'}
                    </div>
                    <div className="text-sm font-bold text-white truncate">{user?.name} {user?.surname}</div>
                  </div>
                </button>
                {onLogout && (
                  <button 
                    onClick={onLogout}
                    className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
    </>
  );
};

export default Header;
