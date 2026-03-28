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
      description: "L'app definitiva per monitorare le tue prestazioni nel tiro a volo. Sei pronto a migliorare il tuo punteggio e scalare le classifiche? Qui potrai gestire ogni aspetto della tua attività sportiva.",
      icon: "fa-bullseye"
    },
    {
      title: "Gare e Allenamenti",
      description: "Inserisci i tuoi risultati in pochi secondi. Puoi aggiungere una gara da zero o iscriverti agli eventi organizzati dalle società nella sezione 'Eventi' per pre-compilare i dati. Monitora i tuoi progressi nel tempo!",
      icon: "fa-list-ul"
    },
    {
      title: "Magazzino Cartucce",
      description: "Tieni traccia delle tue scorte e delle spese. Inserisci i carichi nel 'Magazzino' e l'app scaricherà automaticamente le cartucce usate in ogni gara. Non restare mai senza munizioni!",
      icon: "fa-box-open"
    },
    {
      title: "Statistiche e Coach AI",
      description: "Analizza i tuoi progressi con grafici dettagliati. Il Coach AI analizzerà i tuoi dati per darti consigli tecnici personalizzati su come correggere i tuoi errori più frequenti e ottimizzare la tua tecnica.",
      icon: "fa-user-tie"
    },
    {
      title: "Profilo e Sicurezza",
      description: "Personalizza il tuo profilo e installa l'app. ⚠️ IMPORTANTE: Verifica che la tua email sia corretta (cambiala se necessario) e imposta una nuova password per maggiore sicurezza. Conserva le tue credenziali in un luogo sicuro!",
      icon: "fa-user-shield"
    }
  ];

  const societySteps: TourStep[] = [
    {
      title: "Benvenuto, Società!",
      description: "Gestisci la tua attività di tiro a volo in modo digitale e professionale. Semplifica la vita ai tuoi tiratori e alla tua segreteria con strumenti avanzati di gestione e comunicazione.",
      icon: "fa-building"
    },
    {
      title: "Risultati in Tempo Reale",
      description: "Monitora le prestazioni di tutti i tuoi tiratori iscritti. Avrai statistiche aggregate, medie e classifiche interne sempre aggiornate in tempo reale per ogni disciplina.",
      icon: "fa-poll"
    },
    {
      title: "Organizzazione Eventi",
      description: "Crea gare ed eventi caricando la locandina. I tiratori riceveranno una notifica push istantanea e potranno iscriversi con un semplice tocco, facilitando l'organizzazione.",
      icon: "fa-calendar-plus"
    },
    {
      title: "Gestione Squadre",
      description: "Componi le squadre per le competizioni ufficiali in pochi clic. Seleziona i tiratori dai tuoi iscritti, assegna i pettorali e condividi la formazione istantaneamente con tutti.",
      icon: "fa-users"
    },
    {
      title: "Anagrafica e Sicurezza",
      description: "Gestisci i tuoi iscritti e il tuo profilo. ⚠️ IMPORTANTE: Per proteggere i dati della società, verifica che la tua email sia corretta e imposta una password complessa, conservandola in un luogo sicuro.",
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
