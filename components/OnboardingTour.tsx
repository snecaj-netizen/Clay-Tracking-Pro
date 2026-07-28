import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

interface TourStep {
  tag: string;
  title: string;
  description: string;
  highlights: string[];
  icon: string;
  color: string; // Tailwinds color key e.g. 'orange', 'blue', 'emerald', 'amber', 'purple', 'sky', 'rose'
}

interface OnboardingTourProps {
  role: 'admin' | 'society' | 'user';
  onClose: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ role, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { language, t } = useLanguage();

  const isItalian = language === 'it';

  // STEPS FOR SHOOTERS (TIRATORI)
  const shooterSteps: TourStep[] = isItalian ? [
    {
      tag: "INIZIA IL TUO PERCORSO",
      title: "Benvenuto su Clay Performance!",
      description: "L'applicazione completa pensata per il tiratore a volo moderno. Monitora le tue prestazioni, analizza le tue medie, gestisci le tue cartucce e connettiti con la community e i TAV italiani.",
      highlights: [
        "Calcolo e aggiornamento automatico della media",
        "Supporto per tutte le discipline (Trap, Skeet, Compak, Make a Break, DCK)",
        "Sincronizzazione in cloud sicura sui tuoi dispositivi"
      ],
      icon: "fa-bullseye",
      color: "orange"
    },
    {
      tag: "I TUOI NUMERI A PORTATA DI MANO",
      title: "Dashboard & Report AI Coach",
      description: "Analizza il tuo rendimento con grafici dinamici e statistiche avanzate. Ottieni consigli tattici con il Report AI e il Gemini Coach dedicati al miglioramento dei tuoi piattelli.",
      highlights: [
        "Medie dettagliate su 25 piattelli e punteggi speciali (60 pt Make a Break)",
        "Report strategico AI personalizzato sui tuoi ultimi risultati",
        "Suggerimenti del Gemini Coach per affinare la tua tecnica di tiro"
      ],
      icon: "fa-chart-line",
      color: "emerald"
    },
    {
      tag: "PIANIFICA E CONDIVIDI",
      title: "Le Mie Gare & Schede 25/25 e 60/60",
      description: "Conserva lo storico completo delle tue competizioni e allenamenti. Consulta i piattelli per piattello, visualizza le statistiche e genera le grafiche delle tue serie perfette per i social.",
      highlights: [
        "Analisi analitica di ogni serie e piattello prima/seconda canna",
        "Generazione automatica immagini 25/25 e 60/60 per Instagram/WhatsApp",
        "Filtri per stagione, disciplina e livello agonistico"
      ],
      icon: "fa-trophy",
      color: "amber"
    },
    {
      tag: "ENTRA IN PEDANA",
      title: "Iscrizione Gare ed Ordini di Tiro",
      description: "Esplora i trofei e le gare organizzate dai TAV in tutta Italia. Iscriviti con un tocco, scegli la giornata e visualizza gli orari di chiamata e la composizione delle batterie in tempo reale.",
      highlights: [
        "Calendario nazionale eventi con filtri per regione e disciplina",
        "Iscrizione online diretta con conferma immediata",
        "Consultazione delle batterie e dell'ordine di tiro live"
      ],
      icon: "fa-calendar-check",
      color: "sky"
    },
    {
      tag: "CONTROLLO ATTREZZATURA",
      title: "Magazzino Cartucce & Strozzatori",
      description: "Non rimanere mai senza colpi. Carica il tuo magazzino e l'app scalerà automaticamente i bossoli sparati ad ogni serie, aiutandoti a tracciare il rendimento con ogni cartuccia e strozzatore.",
      highlights: [
        "Scarico automatico munizioni al salvataggio della serie",
        "Avviso scorta minima per non rimanere mai sprovvisto",
        "Correlazione tra tipo cartuccia, piombo, strozzatura e punteggi"
      ],
      icon: "fa-boxes-stacked",
      color: "purple"
    },
    {
      tag: "COMPETI CON LA COMMUNITY",
      title: "Sfide Amichevoli & Hall of Fame",
      description: "Sfida i tuoi compagni di pedana in duelli 1vs1 o sfide di gruppo. Scala la Hall of Fame nazionale, ottieni distintivi e dimostra la tua costanza nei campionati.",
      highlights: [
        "Sfide amichevoli 1vs1 o di gruppo sui risultati di gara",
        "Hall of Fame e classifiche nazionali sempre aggiornate",
        "Coppe e trofei virtuali al raggiungimento di traguardi"
      ],
      icon: "fa-award",
      color: "rose"
    },
    {
      tag: "TROVA IL TUO CAMPO",
      title: "Network Società TAV & Mappa",
      description: "Trova facilmente tutti i campi da tiro del network nazionale. Consulta orari, recapiti, numero di campi, discipline praticabili e ottieni le indicazioni stradali GPS.",
      highlights: [
        "Mappa interattiva con geolocalizzazione dei campi TAV",
        "Schede dettagliate con numero impianti, contatti e servizi",
        "Pianificazione percorsi e trasferte di gara"
      ],
      icon: "fa-map-location-dot",
      color: "blue"
    }
  ] : [
    {
      tag: "START YOUR JOURNEY",
      title: "Welcome to Clay Performance!",
      description: "The complete platform designed for the modern clay shooter. Track your scores, analyze averages, manage cartridge supplies, and connect with clubs across Italy.",
      highlights: [
        "Automatic score calculation & average tracking",
        "Support for all disciplines (Trap, Skeet, Compak, Make a Break, DCK)",
        "Secure cloud synchronization across all your devices"
      ],
      icon: "fa-bullseye",
      color: "orange"
    },
    {
      tag: "YOUR STATS AT A GLANCE",
      title: "Dashboard & AI Coach Report",
      description: "Analyze your shooting metrics with dynamic charts and advanced analytics. Get tactical guidance with AI Reports and the Gemini Coach.",
      highlights: [
        "Detailed averages for 25 targets and special points (60 pt Make a Break)",
        "Personalized strategic AI report on your recent matches",
        "Gemini Coach tips to refine your second barrel shooting"
      ],
      icon: "fa-chart-line",
      color: "emerald"
    },
    {
      tag: "PLAN AND SHARE",
      title: "My Competitions & 25/25 / 60/60 Cards",
      description: "Keep a complete history of all your competitions and practices. Review target-by-target details and generate social share cards for perfect series.",
      highlights: [
        "Target-by-target analytical breakdown (first vs second barrel)",
        "Auto-generation of 25/25 and 60/60 share graphics for Instagram/WhatsApp",
        "Filters by season, discipline, and competitive level"
      ],
      icon: "fa-trophy",
      color: "amber"
    },
    {
      tag: "STEP INTO THE STAND",
      title: "Event Registration & Live Squads",
      description: "Explore tournaments organized by shooting clubs. Register in one click, choose your preferred day, and check live squad call times.",
      highlights: [
        "National event calendar filtered by region and discipline",
        "Direct online registration with instant confirmation",
        "Real-time access to squad orders and stand schedules"
      ],
      icon: "fa-calendar-check",
      color: "sky"
    },
    {
      tag: "EQUIPMENT MANAGEMENT",
      title: "Cartridge Warehouse & Chokes",
      description: "Never run out of ammunition. Load your virtual stock and the app automatically deducts shots fired after each series.",
      highlights: [
        "Automatic ammo deduction when saving a series",
        "Low stock notifications to keep you supplied",
        "Performance correlation between cartridge brands, chokes, and scores"
      ],
      icon: "fa-boxes-stacked",
      color: "purple"
    },
    {
      tag: "COMMUNITY COMPETITION",
      title: "Friendly Challenges & Hall of Fame",
      description: "Challenge fellow shooters in 1vs1 duels or group matches. Climb the national Hall of Fame and unlock virtual trophies.",
      highlights: [
        "1vs1 and group friendly challenges based on match results",
        "Up-to-date national Hall of Fame leaderboard",
        "Badges and trophies earned through consistent performance"
      ],
      icon: "fa-award",
      color: "rose"
    },
    {
      tag: "FIND YOUR RANGE",
      title: "Shooting Clubs Network & Map",
      description: "Locate shooting ranges in the national network. View opening hours, contact details, available disciplines, and GPS navigation routes.",
      highlights: [
        "Interactive map with GPS location of shooting ranges",
        "Detailed club cards with layout count, contacts, and amenities",
        "Route planning for competition road trips"
      ],
      icon: "fa-map-location-dot",
      color: "blue"
    }
  ];

  // STEPS FOR SOCIETIES (SOCIETÀ TAV)
  const societySteps: TourStep[] = isItalian ? [
    {
      tag: "GESTIONE TAV DIGITALE",
      title: "Benvenuto, Società TAV!",
      description: "Il portale gestionale professionale per le Società di Tiro a Volo. Semplifica la gestione delle tue gare, raccogli le iscrizioni online e comunica in tempo reale con i tuoi tiratori.",
      highlights: [
        "Gestione digitale integrata per gare sociali, provinciali, regionali e nazionali",
        "Iscrizioni online veloci e prive di cartaceo",
        "Pubblicazione immediata delle classifiche e ordini di tiro"
      ],
      icon: "fa-building-columns",
      color: "orange"
    },
    {
      tag: "ORGANIZZA ED EVENTI",
      title: "Crea e Promuovi i Tuoi Eventi",
      description: "Pubblica i tuoi trofei nel calendario nazionale. Carica le locandine ufficiali, imposta il montepremi, le quote d'iscrizione, i campi disponibili e attiva la ricezione delle iscrizioni online.",
      highlights: [
        "Caricamento locandine e dettagli di gara con anteprima pubblica",
        "Configurazione della gara per tiri su 25, 50, 75 o 100+ piattelli",
        "Gestione iscrizioni aperte/chiuse con limite partecipanti"
      ],
      icon: "fa-calendar-plus",
      color: "emerald"
    },
    {
      tag: "GESTIONE PEDANE",
      title: "Composizione Batterie & Orari",
      description: "Componi le squadre (batterie) in modo automatico o manuale. Assegna orari e campi di tiro, stampa i fogli di gara ufficiali e crea i pettorali dei tiratori in pochi secondi.",
      highlights: [
        "Generazione automatica batterie bilanciate per campo e fascia oraria",
        "Stampa immediata dei fogli di pedana e pettorali di gara",
        "Blocco e modifica rapida dei turni per le esigenze dell'ultimo minuto"
      ],
      icon: "fa-users-gear",
      color: "sky"
    },
    {
      tag: "INSERIMENTO LIVE",
      title: "Punteggi In Tempo Reale & Convalida",
      description: "Inserisci o importa i punteggi direttamente dal tablet o PC di segreteria. Il sistema aggiorna istantaneamente le classifiche pubbliche e calcola i dati delle serie.",
      highlights: [
        "Inserimento rapido tastiera o griglia piattello per piattello",
        "Importazione automatica file Excel / CSV dei risultati",
        "Convalida e blocco dei punteggi per la chiusura ufficiale della gara"
      ],
      icon: "fa-list-check",
      color: "purple"
    },
    {
      tag: "STAMPE UFFICIALI",
      title: "Classifiche Ufficiali & Export PDF",
      description: "Genera al volo le classifiche divise per Categoria (Eccellenza, 1ª, 2ª, 3ª), Qualifica (Veterani, Master, Lady, Settore Giovanile) e Squadre Societarie. Esporta in PDF con un clic.",
      highlights: [
        "Classifiche generali, per categoria, qualifica e a squadre",
        "Export in PDF stampabile ad alta risoluzione ed Excel",
        "Gestione automatica spareggi e conteggi piattelli di recupero"
      ],
      icon: "fa-file-pdf",
      color: "rose"
    },
    {
      tag: "ANALISI DEL CLUB",
      title: "Dashboard Società & Tesserati",
      description: "Controlla l'affluenza ai tuoi eventi, analizza i dati di partecipazione, monitora le prestazioni dei tiratori tesserati con la tua società e gestisci il registro dei soci.",
      highlights: [
        "Grafici d'affluenza e riepilogo incassi gare",
        "Anagrafica tesserati e storico presenze al campo",
        "Analisi delle prestazioni della squadra societaria nei campionati"
      ],
      icon: "fa-chart-pie",
      color: "amber"
    },
    {
      tag: "VISIBILITÀ NAZIONALE",
      title: "Presenza Mappa & Profilo Pubblico",
      description: "Rendi unico il profilo della tua Società TAV. Aggiungi le foto dei tuoi impianti, orari d'apertura, contatti e servizi (ristorante, armeria, parcheggio) per farti trovare da tiratori di tutta Italia.",
      highlights: [
        "Scheda aziendale geolocalizzata sulla mappa nazionale",
        "Integrazione contatti WhatsApp, telefono ed email di segreteria",
        "Vetrina dei campi disponibili (Fossa Olimpica, Universal, Compak, Skeet)"
      ],
      icon: "fa-map-marked-alt",
      color: "blue"
    }
  ] : [
    {
      tag: "DIGITAL CLUB MANAGEMENT",
      title: "Welcome, Shooting Club!",
      description: "The professional management portal for Clay Shooting Clubs. Simplify event organizing, collect online registrations, and communicate with shooters in real time.",
      highlights: [
        "Integrated digital management for club, regional, and national matches",
        "Fast paperless online registrations",
        "Instant publishing of rankings and live squad call sheets"
      ],
      icon: "fa-building-columns",
      color: "orange"
    },
    {
      tag: "ORGANIZE & PROMOTE",
      title: "Create and Promote Events",
      description: "Publish your tournaments on the national calendar. Upload official posters, set prize purses, entry fees, available fields, and activate online sign-ups.",
      highlights: [
        "Poster upload & event details with public preview",
        "Flexible match setup for 25, 50, 75, or 100+ target formats",
        "Registration limit settings and instant confirmation"
      ],
      icon: "fa-calendar-plus",
      color: "emerald"
    },
    {
      tag: "STAND MANAGEMENT",
      title: "Squad Composition & Schedules",
      description: "Assemble squads automatically or manually. Assign field times, print official score sheets, and generate shooter bib numbers in seconds.",
      highlights: [
        "Automated squad creation balanced by field and time slots",
        "One-click print for stand sheets and shooter bibs",
        "Quick squad adjustments for last-minute changes"
      ],
      icon: "fa-users-gear",
      color: "sky"
    },
    {
      tag: "LIVE SCORE ENTRY",
      title: "Real-Time Scores & Validation",
      description: "Enter or import scores directly from desk tablets or PCs. The system instantly updates public leaderboards and series stats.",
      highlights: [
        "Fast keypad or target-by-target grid entry",
        "Automatic import of Excel / CSV score files",
        "Score validation and locking for official race completion"
      ],
      icon: "fa-list-check",
      color: "purple"
    },
    {
      tag: "OFFICIAL PRINTS",
      title: "Official Leaderboards & PDF Export",
      description: "Generate instant rankings by Category (Excellence, 1st, 2nd, 3rd), Category/Class, and Club Teams. Export to PDF with a single click.",
      highlights: [
        "General, category, qualification, and team standings",
        "High-resolution printable PDF export and Excel files",
        "Automated shoot-off handling and tie-break calculations"
      ],
      icon: "fa-file-pdf",
      color: "rose"
    },
    {
      tag: "CLUB ANALYTICS",
      title: "Club Dashboard & Shooter Roster",
      description: "Track event turnout, analyze participation metrics, monitor member shooters' performances, and manage your club registry.",
      highlights: [
        "Attendance charts and tournament revenue summaries",
        "Member registry and range attendance records",
        "Team performance analysis in regional championships"
      ],
      icon: "fa-chart-pie",
      color: "amber"
    },
    {
      tag: "NATIONAL VISIBILITY",
      title: "Map Presence & Public Profile",
      description: "Showcase your shooting club. Add photos of your layouts, opening hours, contact details, and amenities (restaurant, gun shop, parking) to attract shooters nationwide.",
      highlights: [
        "Geolocated club profile on the national map",
        "Integrated WhatsApp, phone, and secretary email contacts",
        "Showcase of available layouts (Olympic Trap, Universal, Compak, Skeet)"
      ],
      icon: "fa-map-marked-alt",
      color: "blue"
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

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  // Render dedicated visual mockups for each step with high contrast and readable elements
  const renderVisualPreview = () => {
    if (role === 'society') {
      switch (currentStep) {
        case 0: // Welcome Club
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-5 shadow-2xl text-left relative overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-300 font-black text-xl shadow-inner">
                  <i className="fas fa-shield-halved"></i>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-black text-base">TAV Roma Castelli</span>
                    <i className="fas fa-circle-check text-sky-400 text-xs"></i>
                  </div>
                  <span className="text-slate-300 font-medium text-xs">Cod. FITAV 12-049 • Lazio</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-inner">
                  <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Tesserati Club</span>
                  <span className="text-2xl font-black text-orange-300">148</span>
                </div>
                <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-inner">
                  <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Gare Attive</span>
                  <span className="text-2xl font-black text-emerald-300">4 Eventi</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-950/50 border border-orange-500/40 rounded-xl p-2.5 text-xs">
                <span className="text-orange-200 font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Segreteria Online
                </span>
                <span className="bg-orange-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider">Attivo</span>
              </div>
            </div>
          );
        case 1: // Create Events
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <i className="fas fa-plus-circle text-emerald-400"></i> Nuova Gara
                </span>
                <span className="bg-emerald-600 text-white border border-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">Iscrizioni Aperte</span>
              </div>
              <div className="bg-slate-900 rounded-xl p-3.5 border border-slate-700/80 space-y-2.5">
                <div className="text-sm font-black text-white">4° Trofeo Estivo TAV Castelli</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="bg-slate-800 text-slate-200 font-semibold px-2.5 py-1 rounded-md border border-slate-700"><i className="fas fa-crosshairs text-orange-400 mr-1.5"></i>Fossa Olimpica</span>
                  <span className="bg-slate-800 text-slate-200 font-semibold px-2.5 py-1 rounded-md border border-slate-700"><i className="fas fa-layer-group text-sky-400 mr-1.5"></i>50 Piattelli</span>
                  <span className="bg-amber-500 text-slate-950 font-black border border-amber-300 px-2.5 py-1 rounded-md shadow-sm"><i className="fas fa-award mr-1.5 text-slate-950"></i>Montepremi €1.500</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-medium">
                <span>Locandina ufficiale caricata</span>
                <i className="fas fa-circle-check text-emerald-400 text-sm"></i>
              </div>
            </div>
          );
        case 2: // Squads & Timetable
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-sky-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-users-viewfinder"></i> Squadra 1 • Campo 2
                </span>
                <span className="text-xs font-mono font-bold text-slate-200 bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">Ore 09:30</span>
              </div>
              <div className="space-y-2 font-mono text-xs">
                {[
                  { bib: "101", name: "Rossi Mario", cat: "1ª", club: "TAV Roma" },
                  { bib: "102", name: "Bianchi Luca", cat: "Ecc", club: "TAV Lazio" },
                  { bib: "103", name: "Verdi Giuseppe", cat: "2ª", club: "TAV Castelli" }
                ].map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-orange-500/30 border border-orange-500/40 text-orange-300 font-black text-[11px] flex items-center justify-center">#{m.bib}</span>
                      <span className="text-white font-bold text-xs">{m.name}</span>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded">{m.cat}</span>
                  </div>
                ))}
              </div>
              <div className="pt-1 flex gap-2">
                <button className="flex-1 bg-sky-600/30 hover:bg-sky-600/40 text-sky-200 border border-sky-500/40 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all">
                  <i className="fas fa-print"></i> Fogli Campo
                </button>
                <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all">
                  <i className="fas fa-ticket"></i> Pettorali
                </button>
              </div>
            </div>
          );
        case 3: // Live score entry
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-purple-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-keyboard"></i> Inserimento Risultati
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">Live Synced</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-black text-sm">Rossi Mario (1ª Serie)</span>
                  <span className="text-emerald-300 font-black text-base">24 / 25</span>
                </div>
                <div className="grid grid-cols-10 gap-1 pt-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-4 rounded-sm flex items-center justify-center text-[9px] font-black ${
                        i === 17 ? 'bg-rose-600 text-white border border-rose-400' : 'bg-emerald-500 text-slate-950 font-black'
                      }`}
                    >
                      {i === 17 ? '0' : '1'}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Media Calcolata: <strong className="text-white">24.0</strong></span>
                <span className="text-purple-300 font-bold flex items-center gap-1.5"><i className="fas fa-lock"></i> Convalidato</span>
              </div>
            </div>
          );
        case 4: // Official Print PDF
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-rose-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-file-pdf"></i> Classifica Ufficiale PDF
                </span>
                <span className="text-[10px] bg-rose-500/20 text-rose-200 border border-rose-500/30 px-2 py-0.5 rounded font-mono font-bold">STAMPA PRONTA</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-black text-white uppercase border-b border-slate-800 pb-1 flex justify-between">
                  <span>Categoria 1ª - Fossa Olimpica</span>
                  <span>50 Piat.</span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-amber-200 font-bold bg-amber-500/20 border border-amber-500/30 p-1.5 rounded">
                    <span>1. Rossi M.</span>
                    <span>48/50 +2</span>
                  </div>
                  <div className="flex justify-between text-slate-200 p-1">
                    <span>2. Bianchi L.</span>
                    <span>48/50 +1</span>
                  </div>
                  <div className="flex justify-between text-slate-300 p-1">
                    <span>3. Verdi G.</span>
                    <span>47/50</span>
                  </div>
                </div>
              </div>
              <button className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30">
                <i className="fas fa-download"></i> Scarica PDF Completo
              </button>
            </div>
          );
        case 5: // Dashboard Society
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-chart-pie"></i> Affluenza e Statistiche
                </span>
                <span className="text-[10px] text-slate-300 font-bold">Stagione 2026</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs text-slate-200 font-bold">Tiratori Partecipanti per Mese</div>
                <div className="flex items-end justify-between h-16 gap-2 pt-2 border-b border-slate-800 pb-1">
                  {[
                    { m: "MAG", val: "60%" },
                    { m: "GIU", val: "85%" },
                    { m: "LUG", val: "100%" },
                    { m: "AGO", val: "75%" }
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div className="w-full bg-amber-500 rounded-t-md" style={{ height: bar.val }}></div>
                      <span className="text-[10px] font-mono font-bold text-slate-300">{bar.m}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-200">
                <span>Media Tiratori per Gara: <strong className="text-white">68</strong></span>
                <span className="text-emerald-300 font-black">+18% vs 2025</span>
              </div>
            </div>
          );
        case 6: // Map & Public Profile
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-blue-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-map-location-dot"></i> Mappa Nazionale TAV
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-200 border border-blue-500/30 px-2 py-0.5 rounded font-bold">GPS Verified</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold">
                    <i className="fas fa-location-dot text-base animate-bounce"></i>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">TAV Castelli - Roma</div>
                    <div className="text-[11px] text-slate-300">Via Appia Nuova, Km 22 • 6 Impianti</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded"><i className="fas fa-utensils text-orange-400 mr-1"></i>Ristorante</span>
                  <span className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded"><i className="fas fa-gun text-sky-400 mr-1"></i>Armeria</span>
                  <span className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded"><i className="fas fa-square-parking text-emerald-400 mr-1"></i>Parcheggio</span>
                </div>
              </div>
            </div>
          );
        default:
          return null;
      }
    } else {
      // Shooter / User steps
      switch (currentStep) {
        case 0: // Welcome Shooter
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-5 shadow-2xl text-left relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black text-xl shadow-lg shadow-orange-600/10">
                    <i className="fas fa-bullseye"></i>
                  </div>
                  <div>
                    <h4 className="text-white font-black text-base tracking-tight">Clay Performance Pro</h4>
                    <p className="text-slate-300 font-medium text-xs">Piattaforma Tiratori TAV</p>
                  </div>
                </div>
                <span className="bg-orange-600 text-white font-black border border-orange-400 text-[10px] px-2.5 py-1 rounded-full uppercase shadow-sm">Attivo</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-300 uppercase block font-bold">Trap</span>
                  <span className="text-sm font-black text-orange-300">23.8</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-300 uppercase block font-bold">Skeet</span>
                  <span className="text-sm font-black text-sky-300">24.1</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-300 uppercase block font-bold">Make a Break</span>
                  <span className="text-sm font-black text-emerald-300">54.2 pt</span>
                </div>
              </div>
              <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold"><i className="fas fa-cloud-arrow-up text-sky-400 mr-2"></i>Sincronizzazione Cloud</span>
                <span className="text-emerald-300 font-black">Online</span>
              </div>
            </div>
          );
        case 1: // Dashboard & AI
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-chart-line"></i> Media & Performance
                </span>
                <span className="text-[10px] bg-emerald-600 text-white border border-emerald-400 font-black px-2.5 py-0.5 rounded-full shadow-sm">Media: 24.2 / 25</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-200 font-bold">Andamento Ultime Serie</span>
                  <span className="text-emerald-300 font-mono font-black">+1.5%</span>
                </div>
                <div className="h-12 flex items-end justify-between gap-1.5 pt-1">
                  {[22, 23, 24, 24, 25, 25].map((s, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div className="w-full bg-emerald-500 rounded-t-sm" style={{ height: `${(s / 25) * 100}%` }}></div>
                      <span className="text-[9px] font-mono font-bold text-slate-300">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-100 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <i className="fas fa-robot text-sm"></i> Report Gemini AI Coach:
                </div>
                <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                  "Ottima costanza sulle prime canne. Mantieni la stessa fluidità nei piattelli sinistri."
                </p>
              </div>
            </div>
          );
        case 2: // Le Mie Gare & 25/25 60/60
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-trophy"></i> Scheda Serie Perfetta
                </span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full shadow-sm">🎯 25 / 25</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 text-center">
                <div className="text-xs font-black text-white uppercase tracking-wide">3ª Prova Campionato Regionale</div>
                <div className="grid grid-cols-10 gap-1 my-2">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="h-4 bg-emerald-500 rounded-sm flex items-center justify-center text-[9px] font-black text-slate-950">
                      ✓
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1 text-xs text-amber-300 font-extrabold">
                  <span>Make a Break: 60 / 60 pt</span>
                  <span className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] uppercase shadow-sm">RECORD</span>
                </div>
              </div>
              <button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25">
                <i className="fas fa-share-nodes"></i> Condividi Scheda Risultato
              </button>
            </div>
          );
        case 3: // Event Registration & Live Squads
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-sky-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-calendar-check"></i> Iscrizione Gara Online
                </span>
                <span className="text-[10px] bg-sky-600 text-white font-black border border-sky-400 px-2.5 py-0.5 rounded-full shadow-sm">Iscritto</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="text-xs font-black text-white">Gran Premio di Primavera TAV Lazio</div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span><i className="far fa-calendar mr-1 text-slate-400"></i>Domenica 15 Maggio</span>
                  <span className="text-sky-300 font-bold"><i className="fas fa-crosshairs mr-1"></i>Trap 50 Piat.</span>
                </div>
                <div className="bg-sky-950/60 border border-sky-500/40 rounded-lg p-2.5 text-xs text-sky-100 flex items-center justify-between font-medium">
                  <span>Batteria 2 • Campo 1</span>
                  <span className="font-mono font-black text-white bg-sky-600 px-2.5 py-0.5 rounded">Ore 10:15</span>
                </div>
              </div>
            </div>
          );
        case 4: // Cartridge Warehouse & Chokes
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-purple-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-boxes-stacked"></i> Magazzino Cartucce
                </span>
                <span className="text-[10px] bg-purple-600 text-white font-mono font-black border border-purple-400 px-2.5 py-0.5 rounded-md shadow-sm">Auto-Scarico</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-black">Fiocchi Official 24g 7.5</span>
                  <span className="text-purple-300 font-mono font-black">380 / 500</span>
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: '76%' }}></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                  <span>Strozzatura: <strong className="text-white">**** (0.25) / ** (0.75)</strong></span>
                  <span className="text-emerald-300 font-bold">-25 colpi salvati</span>
                </div>
              </div>
            </div>
          );
        case 5: // Friendly Challenges & Hall of Fame
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-rose-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-award"></i> Hall of Fame & Sfide 1vs1
                </span>
                <span className="text-[10px] bg-rose-600 text-white font-black border border-rose-400 px-2.5 py-0.5 rounded-md shadow-sm">Classifica Nazionale</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                {[
                  { pos: "1°", name: "Rossi M.", avg: "24.6", badge: "🥇", isUser: false },
                  { pos: "2°", name: "Tu (Clay Performance)", avg: "24.2", badge: "🥈", isUser: true },
                  { pos: "3°", name: "Bianchi L.", avg: "23.9", badge: "🥉", isUser: false }
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-xs p-2.5 rounded-xl border ${
                      row.isUser
                        ? 'bg-orange-600 text-white border-orange-400 font-black shadow-md'
                        : 'bg-slate-800 text-white border-slate-700 font-bold'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{row.badge}</span>
                      <span className="font-bold text-white">{row.name}</span>
                    </span>
                    <span className={`font-mono ${row.isUser ? 'text-amber-200 font-black' : 'text-amber-300 font-bold'}`}>
                      {row.avg} media
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        case 6: // Shooting Clubs Network Map
          return (
            <div className="bg-slate-950 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-blue-300 flex items-center gap-1.5 uppercase">
                  <i className="fas fa-map-location-dot"></i> Network Campi TAV
                </span>
                <span className="text-[10px] bg-blue-600 text-white font-black border border-blue-400 px-2.5 py-0.5 rounded-md shadow-sm">GPS Map</span>
              </div>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold mt-0.5">
                    <i className="fas fa-location-dot text-base"></i>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">TAV Bottaccia • Roma</div>
                    <div className="text-[11px] text-slate-300">Distante 12.4 km • 4 Campi Fossa Olimpica</div>
                  </div>
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/30 text-xs py-2 rounded-xl transition-all font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30">
                  <i className="fas fa-route"></i> Ottieni Indicazioni Mappa
                </button>
              </div>
            </div>
          );
        default:
          return null;
      }
    }
  };

  // Color classes map for theme dynamic styling
  const colorClasses: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    orange: { bg: 'bg-orange-600/20', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'bg-orange-600/15' },
    emerald: { bg: 'bg-emerald-600/20', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'bg-emerald-600/15' },
    amber: { bg: 'bg-amber-600/20', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'bg-amber-600/15' },
    sky: { bg: 'bg-sky-600/20', text: 'text-sky-400', border: 'border-sky-500/30', glow: 'bg-sky-600/15' },
    purple: { bg: 'bg-purple-600/20', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'bg-purple-600/15' },
    rose: { bg: 'bg-rose-600/20', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'bg-rose-600/15' },
    blue: { bg: 'bg-blue-600/20', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'bg-blue-600/15' }
  };

  const theme = colorClasses[step.color] || colorClasses.orange;

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden">
      {/* Outer Card Container: Fullscreen on mobile, centered modal dialog on tablet/desktop */}
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-slate-900 border-0 sm:border sm:border-slate-800 sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Background Ambient Glow */}
        <div className={`absolute -top-32 -right-32 w-64 h-64 ${theme.glow} rounded-full blur-3xl pointer-events-none`}></div>
        <div className={`absolute -bottom-32 -left-32 w-64 h-64 ${theme.glow} rounded-full blur-3xl pointer-events-none`}></div>

        {/* Top Header Bar */}
        <div className="relative z-20 flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center font-bold text-sm border ${theme.border}`}>
              <i className={`fas ${step.icon}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {role === 'society' ? (isItalian ? 'Tour Società TAV' : 'Shooting Club Tour') : (isItalian ? 'Tour Tiratore' : 'Shooter Tour')}
                </span>
                <span className="text-slate-600 text-[10px]">•</span>
                <span className={`text-[10px] font-bold ${theme.text}`}>
                  {currentStep + 1} / {steps.length}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-all text-xs font-black uppercase tracking-wider border border-slate-600 active:scale-95 shadow-sm"
          >
            <span>{t('skip')}</span>
            <i className="fas fa-times text-xs text-orange-400"></i>
          </button>
        </div>

        {/* Progress Bar Header */}
        <div className="w-full bg-slate-950 h-1 relative shrink-0">
          <motion.div
            className="bg-gradient-to-r from-orange-500 to-amber-500 h-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Content Body (Scrollable on mobile) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center h-full"
            >
              {/* Left Column: Visual Preview Card */}
              <div className="md:col-span-5 flex flex-col justify-center">
                <div className="relative group">
                  <div className={`absolute -inset-1 rounded-2xl ${theme.glow} blur-xl opacity-75 group-hover:opacity-100 transition duration-500`}></div>
                  <div className="relative">
                    {renderVisualPreview()}
                  </div>
                </div>
              </div>

              {/* Right Column: Step Info & Highlights */}
              <div className="md:col-span-7 flex flex-col justify-between text-left space-y-4 sm:space-y-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[10px] font-black tracking-widest text-orange-400 uppercase mb-3">
                    <i className={`fas ${step.icon}`}></i>
                    <span>{step.tag}</span>
                  </div>

                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-tight mb-3">
                    {step.title}
                  </h2>

                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-4">
                    {step.description}
                  </p>
                </div>

                {/* Bullet Highlights */}
                <div className="space-y-2.5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <i className="fas fa-check-double text-orange-400"></i>
                    <span>{isItalian ? "In evidenza in questa sezione:" : "Highlights:"}</span>
                  </div>
                  {step.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-100 font-medium">
                      <span className={`w-2 h-2 rounded-full ${theme.bg} ${theme.text} mt-1.5 shrink-0 border ${theme.border}`}></span>
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="relative z-20 px-5 py-4 border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-6 bg-orange-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
                }`}
                title={`Vai al passaggio ${i + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all border border-slate-700/60 active:scale-95 flex items-center gap-1.5"
              >
                <i className="fas fa-arrow-left"></i>
                <span className="hidden sm:inline">{isItalian ? 'Precedente' : 'Previous'}</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black py-2.5 px-6 sm:px-8 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-wider shadow-lg shadow-orange-600/25 flex items-center gap-2"
            >
              <span>{currentStep === steps.length - 1 ? t('start_now') : t('stepper_next')}</span>
              <i className={`fas ${currentStep === steps.length - 1 ? 'fa-rocket' : 'fa-arrow-right'}`}></i>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;
