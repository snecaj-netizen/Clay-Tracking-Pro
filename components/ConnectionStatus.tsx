import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, RefreshCw, Cloud, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConnectionStatusProps {
  pendingCount?: number;
  isSyncing?: boolean;
  onSync?: () => Promise<void>;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  pendingCount = 0,
  isSyncing = false,
  onSync
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[5000] p-2 pointer-events-none"
        >
          <div className="max-w-md mx-auto bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-red-500/50 backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider leading-none">
                  {t('offline_banner_title')}
                </span>
                <span className="text-[9px] text-red-100 font-medium leading-none mt-1">
                  {t('offline_banner_desc')}
                </span>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="bg-red-700/80 text-[10px] px-2.5 py-1 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {showBackOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[5000] p-2 pointer-events-none"
        >
          <div className="max-w-md mx-auto bg-green-600 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center justify-center gap-3 border border-green-500/50 backdrop-blur-md pointer-events-auto">
            <Wifi className="w-4 h-4 animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {t('sync_complete')}
            </span>
          </div>
        </motion.div>
      )}

      {isOnline && !showBackOnline && pendingCount > 0 && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[5000] p-2 pointer-events-none"
        >
          <div className="max-w-md mx-auto bg-orange-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-orange-500/50 backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider leading-none">
                  {t('pending_sync_badge')}
                </span>
                <span className="text-[9px] text-orange-100 font-medium leading-none mt-1">
                  {pendingCount} {pendingCount === 1 ? t('race_singular') : t('races_plural')}
                </span>
              </div>
            </div>
            <button
              onClick={() => onSync?.()}
              disabled={isSyncing}
              className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? t('coach_thinking') : t('sync_now_btn')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const handleNetworkError = (error: any, triggerToast?: (msg: string, type: any) => void) => {
  // Only log to console if it's not a common transient network error
  if (error?.message !== 'Failed to fetch' && error?.name !== 'AbortError') {
    console.error('Network Error:', error);
  }
  
  let message = 'Si è verificato un errore di rete.';
  
  if (!navigator.onLine) {
    message = 'Nessuna connessione internet. Controlla la tua rete.';
  } else if (error.message === 'Failed to fetch') {
    message = 'Impossibile raggiungere il server. Riprova tra poco.';
  } else if (error.name === 'AbortError') {
    message = 'La richiesta è stata annullata.';
  } else if (error.message) {
    message = error.message;
  }

  if (triggerToast) {
    triggerToast(message, 'error');
  } else {
    alert(message);
  }
};
