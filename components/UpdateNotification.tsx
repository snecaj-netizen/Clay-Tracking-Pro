import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const runningVersion = useRef<{ bootId: string; buildHash: string } | null>(null);

  const checkForUpdates = async () => {
    try {
      // Force fetching completely without caching by using query param + cache headers
      const response = await fetch(`/api/app-version?t=${Date.now()}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data || !data.bootId) return;
      
      if (!runningVersion.current) {
        // First fetch establishes the baseline version for this tab session
        runningVersion.current = {
          bootId: data.bootId,
          buildHash: data.buildHash
        };
      } else {
        // Subsequent checks check if server is running a different code hash or is restarted
        if (
          runningVersion.current.bootId !== data.bootId ||
          runningVersion.current.buildHash !== data.buildHash
        ) {
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Failed to fetch') {
        console.error('Errore durante il controllo degli aggiornamenti:', error);
      }
    }
  };

  useEffect(() => {
    // Check instantly on mount
    checkForUpdates();

    // Setup periodic polling every 60 seconds
    const interval = setInterval(checkForUpdates, 60000);
    
    // Also trigger update check when user returns/switches to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    
    // Trigger update check when device recovers connection
    const handleOnline = () => {
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      // 1. Unregister all service workers to force downloading the new code bundles
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // 2. Erase client-side cache buckets
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }

      // 3. Clear session storage
      sessionStorage.clear();
    } catch (error) {
      console.error('Errore durante la pulizia della cache:', error);
    }

    // 4. Reload page from server with clean base origin + cache-busting timestamp
    const url = new URL(window.location.origin);
    url.searchParams.set('v', Date.now().toString());
    window.location.href = url.toString();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div 
          initial={{ y: 50, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 50, scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-8 sm:w-96 z-[2000]"
        >
          <div className="bg-slate-900 border border-orange-500/40 rounded-2xl p-5 shadow-2xl shadow-orange-950/40 backdrop-blur-xl relative overflow-hidden">
            {/* Soft decorative visual blob */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
            
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
                <svg className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm tracking-tight mb-1">Aggiornamento Disponibile</h4>
                <p className="text-slate-300 text-xs leading-relaxed mb-4">
                  È stata pubblicata una nuova versione di Clay Performance. Aggiorna l'applicazione per sbloccare le ultime novità e miglioramenti.
                </p>
                
                <div className="flex gap-2.5">
                  <button 
                    onClick={handleUpdate}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-150 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Aggiorna Ora</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setUpdateAvailable(false)}
                    className="px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2.5 rounded-xl transition duration-150 border border-slate-700/50 hover:text-white"
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
