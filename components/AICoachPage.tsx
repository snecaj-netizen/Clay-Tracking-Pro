
import React, { useState, useEffect, useRef } from 'react';
import { Competition, Cartridge, Discipline, CompetitionLevel } from '../types';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface AICoachPageProps {
  competitions: Competition[];
  cartridges: Cartridge[];
  user: any;
}

const AICoachPage: React.FC<AICoachPageProps> = ({ 
  competitions = [], 
  cartridges = [], 
  user 
}) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [coachStatus, setCoachStatus] = useState<'idle' | 'thinking'>('idle');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'saved'>('chat');
  const [savedChats, setSavedChats] = useState<Array<{ id: string; question: string; answer: string; date: string }>>(() => {
    try {
      const stored = localStorage.getItem('clay_tracker_saved_coach_chats');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveExchange = (question: string, answer: string) => {
    const newItem = {
      id: 'chat_' + Date.now() + Math.random().toString(36).substr(2, 5),
      question,
      answer,
      date: new Date().toLocaleString()
    };
    const updated = [newItem, ...savedChats];
    setSavedChats(updated);
    try {
      localStorage.setItem('clay_tracker_saved_coach_chats', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving chat to localStorage:', e);
    }
  };

  const removeSavedChat = (id: string) => {
    const updated = savedChats.filter(c => c.id !== id);
    setSavedChats(updated);
    try {
      localStorage.setItem('clay_tracker_saved_coach_chats', JSON.stringify(updated));
    } catch (e) {
      console.error('Error removing saved chat:', e);
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
      });
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      scrollToBottom(true);
    }
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && competitions.length > 0) {
      const initialGreeting = async () => {
        setCoachStatus('thinking');
        const isSociety = user?.role === 'society';
        const filteredCount = isSociety 
          ? competitions.filter(c => c.discipline !== Discipline.TRAINING && c.level !== CompetitionLevel.TRAINING).length
          : competitions.length;

        const nameDisplay = user?.name || (isSociety ? t('society_label') : t('shooter'));

        const greeting = isSociety 
          ? `${t('coach_welcome_society').replace('{{name}}', nameDisplay).replace('{{count}}', filteredCount.toString())} \n\n ${t('coach_welcome_society_desc')}`
          : `${t('coach_welcome_shooter').replace('{{name}}', nameDisplay).replace('{{count}}', filteredCount.toString())} \n\n ${t('coach_welcome_shooter_desc')}`;
        
        setMessages([{
          role: 'model',
          text: greeting,
          timestamp: new Date()
        }]);
        setCoachStatus('idle');
      };
      initialGreeting();
    } else if (messages.length === 0 && competitions.length === 0) {
      setMessages([{
        role: 'model',
        text: t('coach_welcome_no_results'),
        timestamp: new Date()
      }]);
    }
  }, [competitions.length, user?.name, user?.role]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    const currentHistory = [...messages];
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setCoachStatus('thinking');

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Sessione scaduta');
      
      const isSociety = user?.role === 'society';
      
      // Prepare context
      const filteredComps = isSociety 
        ? competitions.filter(c => c.discipline !== Discipline.TRAINING && c.level !== CompetitionLevel.TRAINING)
        : competitions;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const lastComps = [...filteredComps]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      const context = isSociety 
        ? t('ai_coach_sys_society')
            .replace('{{today}}', todayStr)
            .replace('{{name}}', user?.name || '')
            .replace('{{records}}', lastComps.map(c => {
              const isUpcoming = new Date(c.date) >= now || (c.totalScore === 0 && c.totalTargets > 0);
              const status = isUpcoming ? '[FUTURA/IN CORSO]' : '[CONCLUSA]';
              return `- ${status} ${c.date}: ${c.userName || 'Tiratore'} ${c.userSurname || ''} - ${c.name} (${c.discipline}), Punteggio: ${c.totalScore}/${c.totalTargets}, Note: ${c.notes || 'Nessuna'}`;
            }).join('\n'))
        : t('ai_coach_sys_shooter')
            .replace('{{today}}', todayStr)
            .replace('{{name}}', user?.name || '')
            .replace('{{surname}}', user?.surname || '')
            .replace('{{role}}', user?.role || '')
            .replace('{{records}}', lastComps.slice(0, 20).map(c => {
              const isUpcoming = new Date(c.date) >= now || (c.totalScore === 0 && c.totalTargets > 0);
              const status = isUpcoming ? '[FUTURA/IN CORSO]' : '[CONCLUSA]';
              return `- ${status} ${c.date}: ${c.name} (${c.discipline}), Punteggio: ${c.totalScore}/${c.totalTargets}, Media: ${c.averagePerSeries.toFixed(2)}, Note: ${c.notes || 'Nessuna'}`;
            }).join('\n'))
            .replace('{{cartridges}}', cartridges.map(c => `- ${c.producer} ${c.model} (${c.leadNumber}), Qta: ${c.quantity}`).join('\n'));

      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.text,
          history: currentHistory.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          })),
          systemInstruction: context
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella comunicazione con il coach');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: data.text || t('coach_error_no_response'),
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error("Coach Error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: error.message || t('coach_error_generic'),
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
      setCoachStatus('idle');
    }
  };

  const suggestedQuestions = user?.role === 'society' ? [
    t('q_top_3_form'),
    t('q_team_strategy'),
    t('q_analyze_last_results'),
    t('q_recommend_convocations'),
    t('q_identify_competitive')
  ] : [
    t('q_analyze_trend'),
    t('q_improve_compak'),
    t('q_practice_suggestion'),
    t('q_best_cartridges'),
    t('q_mental_analysis')
  ];

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto flex-1 min-h-[calc(100dvh-12rem)] sm:min-h-[calc(100dvh-14rem)]">
      {/* Coach Header */}
      <div className="bg-slate-900 border border-slate-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="relative">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
              <i className="fas fa-user-tie text-xl sm:text-2xl"></i>
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-slate-900 ${coachStatus === 'thinking' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></div>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {user?.role === 'society' ? t('coach_ai_consultant') : t('coach_ai_personal')}
            </h2>
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">
              {coachStatus === 'thinking' ? t('coach_thinking') : (user?.role === 'society' ? t('coach_ready_society') : t('coach_ready_shooter'))}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto justify-center">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'chat' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="fas fa-comments"></i>
            <span>Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'saved' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="fas fa-bookmark"></i>
            <span>Consigli Salvati ({savedChats.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'saved' ? (
        <div className="flex-1 bg-slate-900/50 border border-slate-600 rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-sm p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Consigli e Conversazioni Salvate</h3>
              <p className="text-[10px] text-slate-500">Disponibili per la consultazione offline in qualsiasi momento.</p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-orange-400 px-2.5 py-1 rounded-lg border border-slate-700">
              {savedChats.length} {savedChats.length === 1 ? 'Salvato' : 'Salvati'}
            </span>
          </div>

          {savedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-600 text-2xl">
                <i className="fas fa-bookmark"></i>
              </div>
              <p className="text-sm font-bold text-slate-400">Nessun consiglio salvato</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Durante la chat con il coach AI, clicca sul pulsante "Salva per offline" in qualsiasi risposta per ritrovarla qui anche senza connessione internet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedChats.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg relative group">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>📅 {item.date}</span>
                    <button
                      onClick={() => removeSavedChat(item.id)}
                      className="text-red-400 hover:text-red-300 transition p-1 flex items-center gap-1"
                      title="Rimuovi dai salvati"
                    >
                      <i className="fas fa-trash-alt"></i> Rimuovi
                    </button>
                  </div>
                  
                  <div className="bg-orange-600/10 border border-orange-500/20 p-3 rounded-xl">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-wide mb-1">Domanda:</p>
                    <p className="text-xs text-white font-medium">{item.question}</p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1.5">Risposta del Coach:</p>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 text-xs">
                      <ReactMarkdown>{item.answer}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Chat Area */
        <div className="flex-1 bg-slate-900/50 border border-slate-600 rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-sm">
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-500`}>
                <div className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl ${
                  m.role === 'user' 
                    ? 'bg-orange-600 text-white rounded-tr-none shadow-lg shadow-orange-600/20' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                  
                  {m.role === 'model' && i > 0 && messages[i - 1]?.role === 'user' && (
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400 font-mono">
                        {savedChats.some(s => s.question === messages[i - 1].text && s.answer === m.text) ? '✅ Salvato offline' : ''}
                      </span>
                      <button
                        onClick={() => saveExchange(messages[i - 1].text, m.text)}
                        disabled={savedChats.some(s => s.question === messages[i - 1].text && s.answer === m.text)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                      >
                        <i className="fas fa-bookmark"></i>
                        <span>{savedChats.some(s => s.question === messages[i - 1].text && s.answer === m.text) ? 'Salvato' : 'Salva per offline'}</span>
                      </button>
                    </div>
                  )}

                  <div className={`text-[9px] mt-2 font-bold uppercase tracking-widest opacity-50 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggested Questions */}
          {messages.length < 3 && (
            <div className="px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0 scroll-shadows">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'ENTER' && handleSend()}
                placeholder={t('coach_input_placeholder')}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-600/50 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-12 h-12 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20 transition-all active:scale-95"
              >
                <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICoachPage;
