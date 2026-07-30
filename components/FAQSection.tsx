import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

interface FAQSectionProps {
  role: 'admin' | 'society' | 'user';
  onReplayTour?: () => void;
}

const FAQSection: React.FC<FAQSectionProps> = ({ role, onReplayTour }) => {
  const [activeTab, setActiveTab] = useState<'user' | 'society'>(
    role === 'society' ? 'society' : 'user'
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useLanguage();

  const shooterFaqs = [
    { question: t('faq_shooter_q1'), answer: t('faq_shooter_a1') },
    { question: t('faq_shooter_q2'), answer: t('faq_shooter_a2') },
    { question: t('faq_shooter_q3'), answer: t('faq_shooter_a3') },
    { question: t('faq_shooter_q4'), answer: t('faq_shooter_a4') },
    { question: t('faq_shooter_q5'), answer: t('faq_shooter_a5') },
    { question: t('faq_shooter_q6'), answer: t('faq_shooter_a6') },
    { question: t('faq_shooter_q7'), answer: t('faq_shooter_a7') },
    { question: t('faq_shooter_q8'), answer: t('faq_shooter_a8') },
    { question: t('faq_shooter_q9'), answer: t('faq_shooter_a9') }
  ];

  const societyFaqs = [
    { question: t('faq_society_q1'), answer: t('faq_society_a1') },
    { question: t('faq_society_q2'), answer: t('faq_society_a2') },
    { question: t('faq_society_q3'), answer: t('faq_society_a3') },
    { question: t('faq_society_q4'), answer: t('faq_society_a4') },
    { question: t('faq_society_q5'), answer: t('faq_society_a5') },
    { question: t('faq_society_q6'), answer: t('faq_society_a6') },
    { question: t('faq_society_q7'), answer: t('faq_society_a7') },
    { question: t('faq_society_q8'), answer: t('faq_society_a8') },
    { question: t('faq_society_q9'), answer: t('faq_society_a9') }
  ];

  // For non-admin users, force the list matching their role
  const effectiveTab = role === 'admin' ? activeTab : role === 'society' ? 'society' : 'user';
  const faqs = effectiveTab === 'society' ? societyFaqs : shooterFaqs;

  return (
    <div id="faq-section" className="mt-12 pt-8 border-t border-slate-800/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="fas fa-question-circle text-orange-500"></i> {t('faq_support_title')}
        </h3>

        {/* Role selector tab shown ONLY to ADMIN */}
        {role === 'admin' && (
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center shrink-0">
            <button
              onClick={() => {
                setActiveTab('user');
                setOpenIndex(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                effectiveTab === 'user'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fas fa-crosshairs"></i> {t('faq_role_shooter')}
            </button>
            <button
              onClick={() => {
                setActiveTab('society');
                setOpenIndex(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                effectiveTab === 'society'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fas fa-building-columns"></i> {t('faq_role_society')}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="bg-slate-950/50 border border-slate-800/50 rounded-2xl overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors gap-3"
              >
                <span className="text-sm font-bold text-slate-200">{faq.question}</span>
                <i
                  className={`fas fa-chevron-down text-xs text-slate-500 transition-transform duration-300 shrink-0 ${
                    isOpen ? 'rotate-180 text-orange-400' : ''
                  }`}
                ></i>
              </button>
              <AnimatePresence>
                {isOpen && (
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
          );
        })}
      </div>

      {onReplayTour && (
        <div className="mt-8 p-6 bg-orange-600/5 border border-orange-600/20 rounded-2xl text-center">
          <p className="text-xs text-slate-400 mb-4">{t('faq_replay_tour_desc')}</p>
          <button
            onClick={onReplayTour}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-black py-2.5 px-6 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest border border-slate-700/50"
          >
            <i className="fas fa-play-circle text-orange-500"></i> {t('faq_replay_tour_btn')}
          </button>
        </div>
      )}
    </div>
  );
};

export default FAQSection;
