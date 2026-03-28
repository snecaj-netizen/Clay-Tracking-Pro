import React, { useState, useEffect } from 'react';
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
      title: "Benvenuto su Clay Tracker Pro!",
      description: "L'app definitiva per monitorare le tue prestazioni nel tiro a volo. Sei pronto a migliorare il tuo punteggio e scalare le classifiche?",
      icon: "fa-bullseye"
    },
    {
      title: "Gare e Allenamenti",
      description: "Inserisci i tuoi risultati in pochi secondi. Puoi aggiungere una gara da zero o iscriverti agli eventi organizzati dalle società nella sezione 'Eventi' per pre-compilare i dati.",
      icon: "fa-list-ul"
    },
    {
      title: "Magazzino Cartucce",
      description: "Tieni traccia delle tue scorte e delle spese. Inserisci i carichi nel 'Magazzino' e l'app scaricherà automaticamente le cartucce usate in ogni gara.",
      icon: "fa-box-open"
    },
    {
      title: "Statistiche e Coach AI",
      description: "Analizza i tuoi progressi con grafici dettagliati. Il Coach AI analizzerà i tuoi dati per darti consigli tecnici su come correggere i tuoi errori più frequenti.",
      icon: "fa-user-tie"
    },
    {
      title: "Profilo e Installazione",
      description: "Personalizza il tuo profilo e installa l'app sulla home del tuo telefono per un accesso istantaneo, proprio come una vera applicazione nativa.",
      icon: "fa-mobile-alt"
    }
  ];

  const societySteps: TourStep[] = [
    {
      title: "Benvenuto, Società!",
      description: "Gestisci la tua attività di tiro a volo in modo digitale e professionale. Semplifica la vita ai tuoi tiratori e alla tua segreteria.",
      icon: "fa-building"
    },
    {
      title: "Risultati in Tempo Reale",
      description: "Monitora le prestazioni di tutti i tuoi tiratori iscritti. Avrai statistiche aggregate, medie e classifiche interne sempre aggiornate in tempo reale.",
      icon: "fa-poll"
    },
    {
      title: "Organizzazione Eventi",
      description: "Crea gare ed eventi caricando la locandina. I tiratori riceveranno una notifica push e potranno iscriversi con un semplice tocco.",
      icon: "fa-calendar-plus"
    },
    {
      title: "Gestione Squadre",
      description: "Componi le squadre per le competizioni ufficiali. Seleziona i tiratori dai tuoi iscritti, assegna i pettorali e condividi la formazione istantaneamente.",
      icon: "fa-users"
    },
    {
      title: "Anagrafica e Supporto",
      description: "Gestisci i profili dei tuoi iscritti, aggiorna le loro categorie e qualifiche, e fornisci supporto diretto tramite la sezione FAQ dedicata.",
      icon: "fa-id-card"
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
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
    </div>
  );
};

export default OnboardingTour;
