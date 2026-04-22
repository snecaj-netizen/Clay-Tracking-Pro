import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

interface FAQSectionProps {
  role: 'admin' | 'society' | 'user';
  onReplayTour?: () => void;
}

const FAQSection: React.FC<FAQSectionProps> = ({ role, onReplayTour }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useLanguage();

  const shooterFaqs = [
    {
      question: t('faq_shooter_q1'),
      answer: t('faq_shooter_a1')
    },
    {
      question: t('faq_shooter_q2'),
      answer: t('faq_shooter_a2')
    },
    {
      question: t('faq_shooter_q3'),
      answer: t('faq_shooter_a3')
    },
    {
      question: t('faq_shooter_q4'),
      answer: t('faq_shooter_a4')
    },
    {
      question: t('faq_shooter_q5'),
      answer: t('faq_shooter_a5')
    },
    {
      question: t('faq_shooter_q6'),
      answer: t('faq_shooter_a6')
    }
  ];

  const societyFaqs = [
    {
      question: t('faq_society_q1'),
      answer: t('faq_society_a1')
    },
    {
      question: t('faq_society_q2'),
      answer: t('faq_society_a2')
    },
    {
      question: t('faq_society_q3'),
      answer: t('faq_society_a3')
    },
    {
      question: t('faq_society_q4'),
      answer: t('faq_society_a4')
    },
    {
      question: t('faq_society_q5'),
      answer: t('faq_society_a5')
    },
    {
      question: t('faq_society_q6'),
      answer: t('faq_society_a6')
    }
  ];

  const faqs = role === 'society' ? societyFaqs : shooterFaqs;

  return (
    <div className="mt-12 pt-8 border-t border-slate-800/50">
      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
        <i className="fas fa-question-circle text-orange-500"></i> {t('faq_support_title')}
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
            {t('faq_replay_tour_desc')}
          </p>
          <button
            onClick={onReplayTour}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-black py-2.5 px-6 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest"
          >
            <i className="fas fa-play-circle text-orange-500"></i> {t('faq_replay_tour_btn')}
          </button>
        </div>
      )}
    </div>
  );
};

export default FAQSection;
