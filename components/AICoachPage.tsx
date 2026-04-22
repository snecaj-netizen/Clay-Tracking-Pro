
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
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
  const [needsKey, setNeedsKey] = useState(false);
  const [coachStatus, setCoachStatus] = useState<'idle' | 'thinking'>('idle');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
      });
    }
  };

  useEffect(() => {
    // Only scroll if there's more than one message (i.e., after initial greeting)
    if (messages.length > 1) {
      scrollToBottom(true);
    }
  }, [messages]);

  // Initial greeting and analysis
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

  const checkAndOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        setNeedsKey(false);
      } catch (err) {
        console.error("Error opening key selector:", err);
      }
    }
  };

  const getApiKey = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const res = await fetch('/api/gemini-key', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return data.key;
        }
      }
    } catch (e) {
      console.error("Failed to fetch API key from server", e);
    }
    const rawKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    return typeof rawKey === 'string' ? rawKey.trim() : rawKey;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setCoachStatus('thinking');

    try {
      const apiKey = await getApiKey();
      
      if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        setNeedsKey(true);
        setLoading(false);
        setCoachStatus('idle');
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const isSociety = user?.role === 'society';
      
      // Prepare context - Filter out trainings for society
      const filteredComps = isSociety 
        ? competitions.filter(c => c.discipline !== Discipline.TRAINING && c.level !== CompetitionLevel.TRAINING)
        : competitions;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const lastComps = [...filteredComps]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30); // More data for society

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

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: context,
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      });

      const response = await chat.sendMessage({
        message: userMessage.text,
      });

      const modelText = response.text;
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: modelText || t('coach_error_no_response'),
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error("Coach Error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: t('coach_error_generic'),
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
      <div className="bg-slate-900 border border-slate-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
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
        
        {needsKey && (
          <button 
            onClick={checkAndOpenKeySelector}
            className="bg-orange-600/10 hover:bg-orange-600/20 text-orange-500 border border-orange-500/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all"
          >
            <i className="fas fa-key sm:mr-2"></i> <span className="hidden sm:inline">{t('configure_api')}</span>
          </button>
        )}
      </div>

      {/* Chat Area */}
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
                className="whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
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
    </div>
  );
};

export default AICoachPage;
