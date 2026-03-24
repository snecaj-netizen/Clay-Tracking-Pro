import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detect if already in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Check if user has already dismissed it in this session
      const isDismissed = sessionStorage.getItem('install_prompt_dismissed');
      if (!isDismissed && !standalone) {
        // Delay showing the prompt to make it feel more natural
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    // For iOS, we show the prompt manually since beforeinstallprompt isn't supported
    if (ios && !standalone) {
      const isDismissed = sessionStorage.getItem('install_prompt_dismissed');
      if (!isDismissed) {
        setTimeout(() => setIsVisible(true), 4000);
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if the app is already installed
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // For iOS, we just show instructions (the UI already does this by showing the prompt)
      // But we can add a specific alert or just let the UI guide them
      return;
    }

    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('install_prompt_dismissed', 'true');
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {isVisible && (deferredPrompt || isIOS) && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 z-[100]"
        >
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl shadow-orange-600/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-600/20 flex items-center justify-center flex-shrink-0">
              <i className={`fas ${isIOS ? 'fa-share-from-square' : 'fa-mobile-alt'} text-orange-500 text-xl`}></i>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-white uppercase tracking-tight">
                {isIOS ? 'Aggiungi alla Home' : "Installa l'App"}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                {isIOS 
                  ? "Tocca l'icona di condivisione e seleziona 'Aggiungi alla schermata Home' per installare l'app."
                  : "Aggiungi Clay Tracker Pro alla tua home per un accesso rapido e notifiche in tempo reale."
                }
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {!isIOS && (
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-orange-600/20"
                >
                  Installa
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="text-[10px] text-slate-500 font-bold uppercase hover:text-slate-300 transition-colors text-center"
              >
                {isIOS ? 'Ho capito' : 'Dopo'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
