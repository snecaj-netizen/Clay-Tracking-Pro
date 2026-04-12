import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, AlertCircle } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

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
          className="fixed top-0 left-0 right-0 z-[5000] p-2"
        >
          <div className="max-w-md mx-auto bg-red-600 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center justify-center gap-3 border border-red-500/50 backdrop-blur-md">
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Connessione assente. Alcune funzioni sono disabilitate.
            </span>
          </div>
        </motion.div>
      )}

      {showBackOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[5000] p-2"
        >
          <div className="max-w-md mx-auto bg-green-600 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center justify-center gap-3 border border-green-500/50 backdrop-blur-md">
            <Wifi className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Connessione ripristinata!
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const handleNetworkError = (error: any, triggerToast?: (msg: string, type: any) => void) => {
  console.error('Network Error:', error);
  
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
