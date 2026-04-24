
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface HomePageProps {
  user: any;
  onNavigate: (view: any, tab?: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ user, onNavigate }) => {
  const { t } = useLanguage();

  const isSociety = user?.role === 'society';
  const isAdmin = user?.role === 'admin';

  const menuButtons = [
    {
      id: 'gare',
      label: t('events') || 'Elenco Gare',
      icon: 'fa-calendar-alt',
      color: 'bg-orange-600',
      description: t('events_desc') || 'Calendario ufficiale competizioni',
      roles: ['user', 'society', 'admin']
    },
    {
      id: 'le-tue-gare',
      tab: 'history',
      label: t('register_your_race') || 'Registra la tua gara',
      icon: 'fa-plus-circle',
      color: 'bg-slate-800',
      description: t('dashboard_desc') || 'Inserisci i tuoi risultati e allenamenti',
      roles: ['user', 'admin']
    },
    {
      id: 'ai-coach',
      label: t('ai_coach_dashboard') || 'AI Coach',
      icon: 'fa-robot',
      color: 'bg-slate-800',
      description: t('ai_coach_analyzed') || 'Analisi intelligente delle tue prestazioni',
      roles: ['user', 'society', 'admin']
    },
    {
      id: 'gare',
      tab: 'iscrizione',
      label: t('tab_registration') || 'Iscrizione alle gare',
      icon: 'fa-edit',
      color: 'bg-slate-800',
      description: t('open_registrations_desc') || 'Gare con iscrizioni aperte',
      roles: ['user', 'admin']
    },
    {
      id: 'public-portal',
      label: t('results_portal') || 'Risultati Online',
      icon: 'fa-trophy',
      color: 'bg-slate-800',
      description: t('results_desc') || 'Classifiche e punteggi in tempo reale',
      roles: ['user', 'society', 'admin']
    },
    {
      id: 'profile',
      label: t('your_profile') || 'Il mio Profilo',
      icon: 'fa-user-circle',
      color: 'bg-slate-800',
      description: t('profile_data') || 'Gestisci i tuoi dati e le impostazioni',
      roles: ['user', 'society', 'admin']
    }
  ];

  const filteredButtons = menuButtons.filter(btn => {
    // If user is not yet loaded, show buttons for 'user' as default
    // If user has no role, default to 'user'
    const userRole = user?.role || 'user';
    return btn.roles.includes(userRole);
  });

  return (
    <div className="flex-1 pb-12 transition-colors bg-white dark:bg-slate-950">
      <div className="max-w-md mx-auto px-6 pt-8 flex flex-col min-h-full">
        {/* Logo and Welcome Section */}
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-600 rounded-2xl shadow-2xl shadow-orange-600/20 transform -rotate-6 animate-in zoom-in duration-700">
            <i className="fas fa-bullseye text-2xl !text-white"></i>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">
              CLAY <span className="text-orange-600">PERFORMANCE</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-500 text-[7px] font-black uppercase tracking-[0.4em] ml-1">
              {isSociety ? t('society_portal') : t('shooter_portal')}
            </p>
          </div>
        </div>

        {/* Buttons Grid/Stack */}
        <div className="grid gap-4 pb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          {filteredButtons.map((btn, idx) => (
            <button
              key={`${btn.id}-${idx}`}
              onClick={() => onNavigate(btn.id, btn.tab)}
              className="group relative flex items-center gap-5 w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-orange-500/30 hover:shadow-xl transition-all duration-300 active:scale-[0.98]"
            >
              <div className={`w-12 h-12 rounded-xl ${btn.color} flex items-center justify-center text-white text-lg shadow-md group-hover:scale-110 transition-transform`}>
                <i className={`fas ${btn.icon}`}></i>
              </div>
              <div className="text-left flex-1">
                <div className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white transition-colors">
                  {btn.label}
                </div>
                <div className="text-[10px] font-medium text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors line-clamp-1 mt-0.5">
                  {btn.description}
                </div>
              </div>
              <i className="fas fa-chevron-right text-[10px] text-slate-300 dark:text-slate-700 group-hover:text-orange-500 group-hover:translate-x-1 transition-all"></i>
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <div className="mt-auto pt-20 pb-8 flex flex-col items-center gap-4">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('clay-tracker-logout'));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-300 active:scale-95"
          >
            <i className="fas fa-sign-out-alt text-[10px]"></i>
            <span className="text-[8px] font-black uppercase tracking-widest leading-none pt-0.5">
              {t('logout')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
