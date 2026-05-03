
import React from 'react';
import { Discipline } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, useScroll, useMotionValueEvent } from 'motion/react';

interface BottomNavigationProps {
  currentView: string;
  onNavigate: (view: any, tab?: string) => void;
  user?: any;
  appSettings?: any;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentView, onNavigate, user, appSettings }) => {
  const { t } = useLanguage();
  const resultsAccess = appSettings?.event_results_access || {};
  const [isVisible, setIsVisible] = React.useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    const diff = latest - previous;

    // Hide the bottom menu when scrolling down. Reappear when scrolling up.
    // scrollY decreases (diff < 0) -> scroll up (moving towards top of page)
    // scrollY increases (diff > 0) -> scroll down (moving towards bottom of page)
    
    if (Math.abs(diff) > 5) { // small threshold to avoid jitter
      if (diff > 0 && latest > 50) {
        setIsVisible(false); // Hide on scroll down
      } else if (diff < 0) {
        setIsVisible(true);  // Show on scroll up
      }
    }
  });

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
  const canViewResults = (user?.role === 'user' && hasTiratoriAccess) || (user?.role === 'society' && hasSocietaAccess) || user?.role === 'admin';

  // Define the main navigation items
  const navItems = [];

  if (user?.role !== 'society') {
    navItems.push({ id: 'le-tue-gare', label: t('your_results'), icon: 'fa-list-ul' });
    navItems.push({ id: 'warehouse', label: t('warehouse'), icon: 'fa-box-open' });
  }

  navItems.push({ id: 'gare', label: t('events'), icon: 'fa-calendar-alt' });

  if (user?.role === 'admin' || user?.role === 'society') {
    navItems.push({ id: 'la-mia-societa', label: t('managed_races'), icon: 'fa-building' });
  }

  navItems.push({ id: 'societies', label: t('societies'), icon: 'fa-shield-alt' });

  return (
    <motion.nav 
      initial={false}
      animate={{ y: isVisible ? 0 : 100 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t-2 border-orange-600 z-[1000] pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-around h-16 px-1 overflow-x-auto no-scrollbar scroll-shadows">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
    </motion.nav>
  );
};

export default BottomNavigation;
