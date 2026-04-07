import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface TourStep {
  title: string;
  description: string;
  icon: string;
}

interface OnboardingTourProps {
  role: 'admin' | 'society' | 'user';
  onClose: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ role, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const shooterSteps: TourStep[] = [
    {
      title: "Benvenuto su Clay Performance!",
      description: "L'app definitiva per monitorare le tue prestazioni nel tiro a volo. Sei pronto a migliorare il tuo punteggio e scalare le classifiche? Qui potrai gestire ogni aspetto della tua attività sportiva.",
      icon: "fa-bullseye"
    },
    {
      title: "Le Tue Gare",
      description: "Qui trovi il riepilogo delle tue attività. Il tab 'Prossime' mostra i tuoi impegni futuri e le iscrizioni attive, mentre 'Storico' conserva tutti i tuoi risultati passati con statistiche dettagliate.",
      icon: "fa-list-ul"
    },
    {
      title: "Magazzino Cartucce",
      description: "Gestisci le tue scorte in modo intelligente. Carica i nuovi acquisti nel Magazzino e l'app scaricherà automaticamente le cartucce usate dopo ogni serie inserita. Non restare mai a secco!",
      icon: "fa-box-open"
    },
    {
      title: "Gare ed Eventi",
      description: "Esplora le gare disponibili in tutta Italia. Nel tab 'Iscrizioni' puoi iscriverti agli eventi con un tocco, mentre in 'Risultati' consulti le classifiche ufficiali e i punteggi di ogni competizione.",
      icon: "fa-calendar-alt"
    },
    {
      title: "Società TAV",
      description: "Cerca i campi da tiro nel network nazionale. Visualizza info, contatti e posizioni sulla mappa per pianificare le tue prossime trasferte e scoprire nuove realtà del tiro a volo.",
      icon: "fa-shield-alt"
    },
    {
      title: "Menu e Profilo",
      description: "Clicca sul tuo nome in alto a destra per accedere al profilo, cambiare password o consultare le notifiche. ⚠️ IMPORTANTE: Verifica che la tua email sia corretta per ricevere aggiornamenti importanti.",
      icon: "fa-user-circle"
    }
  ];

  const societySteps: TourStep[] = [
    {
      title: "Benvenuto, Società!",
      description: "Gestisci il tuo club in modo digitale e professionale. Semplifica le iscrizioni, organizza eventi e comunica in tempo reale con i tuoi tiratori attraverso strumenti dedicati.",
      icon: "fa-building"
    },
    {
      title: "La mia Società",
      description: "Il tuo centro di comando. Usa i tab per consultare la Dashboard (statistiche), gestire il tuo Team di tiratori, visualizzare i Risultati interni e personalizzare le Impostazioni della tua pagina.",
      icon: "fa-poll"
    },
    {
      title: "Organizzazione Gare",
      description: "Crea e promuovi i tuoi eventi nella sezione Gare. Carica le locandine, definisci i dettagli e attiva le iscrizioni online per ricevere adesioni immediate dai tiratori di tutta Italia.",
      icon: "fa-calendar-plus"
    },
    {
      title: "Gestione Operativa",
      description: "Dal menu in alto a destra, accedi a 'Gare gestite' per il controllo totale: gestisci le liste iscritti, componi le batterie (squadre) e convalida i punteggi ufficiali delle tue competizioni.",
      icon: "fa-users-cog"
    },
    {
      title: "Network Società",
      description: "Consulta l'elenco completo delle Società TAV. Resta aggiornato sul network nazionale, visualizza le altre realtà sulla mappa e mantieni i contatti con il mondo del tiro a volo.",
      icon: "fa-shield-alt"
    },
    {
      title: "Sicurezza e Account",
      description: "Proteggi i dati della tua società. Verifica l'email e imposta una password sicura dal menu profilo. La sicurezza delle informazioni dei tuoi iscritti è la nostra priorità.",
      icon: "fa-user-shield"
    }
  ];

  const steps = role === 'society' ? societySteps : shooterSteps;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
        >
          {/* Background Decoration */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl"></div>

          {/* Skip Button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest z-20"
          >
            Salta <i className="fas fa-times ml-1"></i>
          </button>

          <div className="relative z-10 text-center">
            <div className="w-20 h-20 bg-orange-600/20 rounded-3xl flex items-center justify-center text-orange-500 text-3xl mx-auto mb-6 shadow-lg shadow-orange-600/10">
              <i className={`fas ${steps[currentStep].icon}`}></i>
            </div>

            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4 leading-tight">
              {steps[currentStep].title}
            </h2>

            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              {steps[currentStep].description}
            </p>

            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div 
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-orange-600' : 'w-1.5 bg-slate-800'}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black py-3 px-8 rounded-2xl transition-all active:scale-95 text-xs uppercase shadow-lg shadow-orange-600/20"
              >
                {currentStep === steps.length - 1 ? 'Inizia Ora' : 'Avanti'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default OnboardingTour;
