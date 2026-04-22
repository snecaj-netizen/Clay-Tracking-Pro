import React from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  variant?: 'danger' | 'primary';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText,
  variant = 'danger'
}) => {
  const { language, t } = useLanguage();
  if (!isOpen) return null;

  const resolvedConfirmText = confirmText || t('confirm_btn');
  const isDanger = variant === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${isDanger ? 'bg-red-950/30 text-red-500' : 'bg-orange-950/30 text-orange-500'}`}>
            <i className={`fas ${isDanger ? 'fa-exclamation-triangle' : 'fa-sign-out-alt'}`}></i>
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">
          {message}
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest"
          >
            {t('cancel_label')}
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 ${isDanger ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20'} text-white font-black py-3 rounded-xl transition-all active:scale-95 shadow-lg text-[10px] uppercase tracking-widest`}
          >
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
,
    document.body
  );
};

export default ConfirmModal;
