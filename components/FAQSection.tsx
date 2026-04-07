import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FAQSectionProps {
  role: 'admin' | 'society' | 'user';
  onReplayTour?: () => void;
}

const FAQSection: React.FC<FAQSectionProps> = ({ role, onReplayTour }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const shooterFaqs = [
    {
      question: "Come inserisco una nuova gara?",
      answer: "Puoi farlo in due modi: 1) Dalla sezione 'Gare/Allenamenti' cliccando su 'Nuova Gara' per inserirla da zero. 2) Dalla sezione 'Eventi', cercando la gara d'interesse e cliccando su 'Partecipa' per pre-compilare i dati."
    },
    {
      question: "Come aggiorno i risultati di una gara?",
      answer: "Nella sezione 'Gare/Allenamenti', trova la gara che vuoi modificare e clicca sull'icona della matita. Potrai aggiornare punteggi, note e dettagli tecnici."
    },
    {
      question: "Come gestisco le cartucce e il magazzino?",
      answer: "Vai nella sezione 'Magazzino'. Qui puoi aggiungere nuovi carichi di cartucce indicando marca, modello, prezzo e quantità. Il sistema calcolerà automaticamente la giacenza e le spese totali in base alle gare inserite."
    },
    {
      question: "Come aggiorno il mio profilo?",
      answer: "Nel pannello 'Profilo', puoi cambiare la tua email, la foto profilo e la password. Alcuni dati (come nome, cognome e società) sono gestiti dall'amministratore per garantire la correttezza delle classifiche."
    },
    {
      question: "Come consulto i risultati ufficiali delle gare?",
      answer: "Puoi farlo in due modi: 1) Dalla sezione 'Eventi', selezionando una gara conclusa e cliccando su 'Risultati'. 2) Dalla sezione dedicata 'Risultati Gare' nel menu principale, dove troverai tutte le competizioni concluse raggruppate per Società Organizzatrice, con classifiche e statistiche complete."
    },
    {
      question: "Come installo l'app sul telefono?",
      answer: "Clay Performance è una Web App. Su iPhone (Safari), tocca 'Condividi' e poi 'Aggiungi alla schermata Home'. Su Android (Chrome), tocca i tre puntini in alto a destra e seleziona 'Installa applicazione'."
    }
  ];

  const societyFaqs = [
    {
      question: "Come vedo i risultati dei miei tiratori?",
      answer: "Nella sezione 'Risultati' del tuo pannello, troverai l'elenco completo di tutte le prestazioni inserite dai tiratori iscritti alla tua società, con filtri per data e disciplina."
    },
    {
      question: "Come inserisco e convalido i risultati di una gara?",
      answer: "Dalla sezione 'Eventi', seleziona la gara d'interesse e vai su 'Gestisci Risultati'. Qui puoi inserire i punteggi per ogni tiratore e, una volta completati, cliccare su 'Convalida Risultati' per renderli ufficiali e visibili a tutti."
    },
    {
      question: "Come inserisco un nuovo evento?",
      answer: "Vai nella sezione 'Eventi' e clicca su 'Nuovo Evento'. Inserisci nome, data, disciplina e locandina. Tutti i tiratori vedranno l'evento e potranno iscriversi facilmente."
    },
    {
      question: "Come creo le squadre per una gara?",
      answer: "Nella sezione 'Squadre', clicca su 'Nuova Squadra'. Scegli la competizione, dai un nome alla squadra e seleziona i tiratori tra i tuoi iscritti. Potrai poi stampare o condividere la formazione."
    },
    {
      question: "Come gestisco l'anagrafica dei tiratori?",
      answer: "Nella sezione 'Utenti', puoi vedere tutti i tiratori iscritti alla tua società, sospendere quelli non più attivi o aiutarli a recuperare le credenziali."
    },
    {
      question: "Come aggiorno il profilo della società?",
      answer: "Nel pannello 'Profilo', puoi aggiornare i dati di contatto della società, la foto profilo (logo) e la password di accesso."
    }
  ];

  const faqs = role === 'society' ? societyFaqs : shooterFaqs;

  return (
    <div className="mt-12 pt-8 border-t border-slate-800/50">
      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
        <i className="fas fa-question-circle text-orange-500"></i> FAQ & Supporto
      </h3>

      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div 
            key={index}
            className="bg-slate-950/50 border border-slate-800/50 rounded-2xl overflow-hidden transition-all"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors"
            >
              <span className="text-sm font-bold text-slate-200">{faq.question}</span>
              <i className={`fas fa-chevron-down text-xs text-slate-500 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}></i>
            </button>
            
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-5 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/30 pt-3">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {onReplayTour && (
        <div className="mt-8 p-6 bg-orange-600/5 border border-orange-600/20 rounded-2xl text-center">
          <p className="text-xs text-slate-400 mb-4">
            Vuoi rivedere la presentazione iniziale delle funzionalità?
          </p>
          <button
            onClick={onReplayTour}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-black py-2.5 px-6 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest"
          >
            <i className="fas fa-play-circle text-orange-500"></i> Riavvia Tour App
          </button>
        </div>
      )}
    </div>
  );
};

export default FAQSection;
