import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);

  const checkForUpdates = async () => {
    try {
      // Fetch the main index.html with a cache-busting query param
      const response = await fetch(`/?t=${Date.now()}`, { cache: 'no-store' });
      const text = await response.text();
      
      // Simple hash-like check: content length + first 1000 chars
      const currentHash = `${text.length}-${text.substring(0, 1000)}`;
      
      if (lastHash && lastHash !== currentHash) {
        setUpdateAvailable(true);
      } else if (!lastHash) {
        setLastHash(currentHash);
      }
    } catch (error) {
      console.error('Errore durante il controllo degli aggiornamenti:', error);
    }
  };

  useEffect(() => {
    // Initial check
    checkForUpdates();

    // Check every 2 minutes
    const interval = setInterval(checkForUpdates, 120000);
    
    // Also check when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastHash]);

  const handleUpdate = () => {
    // Force reload from server, bypassing cache
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-8 sm:w-80 z-[2000]"
        >
          <div className="bg-slate-900 border border-orange-500/50 rounded-2xl p-4 shadow-2xl shadow-orange-600/20 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-500 shrink-0">
                <i className="fas fa-sync-alt animate-spin-slow"></i>
              </div>
              <div className="flex-1">
                <h4 className="text-white font-bold text-sm mb-1">Aggiornamento Disponibile</h4>
                <p className="text-slate-400 text-xs leading-relaxed mb-3">
                  È stata pubblicata una nuova versione di Clay Tracker Pro. Aggiorna ora per vedere le ultime modifiche.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleUpdate}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-lg shadow-orange-600/20"
                  >
                    Aggiorna Ora
                  </button>
                  <button 
                    onClick={() => setUpdateAvailable(false)}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    Dopo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateNotification;
