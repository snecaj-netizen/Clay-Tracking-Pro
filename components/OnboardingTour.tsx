import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

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
  const { language, t } = useLanguage();

  const shooterSteps: TourStep[] = language === 'it' ? [
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
  ] : [
    {
      title: "Welcome to Clay Performance!",
      description: "The ultimate app to track your clay shooting performance. Ready to improve your score and climb the rankings? Here you can manage every aspect of your sports activity.",
      icon: "fa-bullseye"
    },
    {
      title: "Your Competitions",
      description: "Here you'll find a summary of your activities. The 'Upcoming' tab shows your future commitments and active registrations, while 'History' keeps all your past results with detailed statistics.",
      icon: "fa-list-ul"
    },
    {
      title: "Cartridge Warehouse",
      description: "Manage your supplies smartly. Upload new purchases to the Warehouse and the app will automatically deduct used cartridges after each entered series. Never run out!",
      icon: "fa-box-open"
    },
    {
      title: "Competitions and Events",
      description: "Explore available competitions across Italy. In the 'Registrations' tab you can sign up for events with one touch, while in 'Results' you check official rankings and scores for each competition.",
      icon: "fa-calendar-alt"
    },
    {
      title: "Shooting Clubs",
      description: "Search for shooting ranges in the national network. View info, contacts, and map locations to plan your next trips and discover new shooting realities.",
      icon: "fa-shield-alt"
    },
    {
      title: "Menu and Profile",
      description: "Click your name at the top right to access your profile, change password, or check notifications. ⚠️ IMPORTANT: Verify your email is correct to receive important updates.",
      icon: "fa-user-circle"
    }
  ];

  const societySteps: TourStep[] = language === 'it' ? [
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
      description: "Dal menu in alto a destra, accedi a 'Gestione gare' per il controllo totale: gestisci le liste iscritti, componi le batterie (squadre) e convalida i punteggi ufficiali delle tue competizioni.",
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
  ] : [
    {
      title: "Welcome, Club Manager!",
      description: "Manage your club digitally and professionally. Simplify registrations, organize events, and communicate in real-time with your shooters through dedicated tools.",
      icon: "fa-building"
    },
    {
      title: "My Club",
      description: "Your command center. Use the tabs to consult the Dashboard (statistics), manage your Team of shooters, view internal Results, and customize your page Settings.",
      icon: "fa-poll"
    },
    {
      title: "Competition Organization",
      description: "Create and promote your events in the Competitions section. Upload posters, define details, and activate online registrations to receive immediate sign-ups from shooters all over Italy.",
      icon: "fa-calendar-plus"
    },
    {
      title: "Operational Management",
      description: "From the top right menu, access 'Manage Competitions' for total control: manage registrant lists, compose squads, and validate official scores of your competitions.",
      icon: "fa-users-cog"
    },
    {
      title: "Club Network",
      description: "Consult the full list of Shooting Clubs. Stay updated on the national network, view other realities on the map, and maintain contacts with the shooting world.",
      icon: "fa-shield-alt"
    },
    {
      title: "Security and Account",
      description: "Protect your club's data. Verify your email and set a secure password from the profile menu. The security of your members' information is our priority.",
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
            {t('skip')} <i className="fas fa-times ml-1"></i>
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
                {currentStep === steps.length - 1 ? t('start_now') : t('stepper_next')}
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
