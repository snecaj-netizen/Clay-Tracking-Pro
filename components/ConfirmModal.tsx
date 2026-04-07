import React from 'react';
import { createPortal } from 'react-dom';

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
  confirmText = 'Conferma',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-950/30 text-red-500' : 'bg-orange-950/30 text-orange-500'}`}>
            <i className={`fas ${isDanger ? 'fa-exclamation-triangle' : 'fa-sign-out-alt'}`}></i>
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-xs uppercase"
          >
            Annulla
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 ${isDanger ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20'} text-white font-black py-3 rounded-xl transition-all active:scale-95 shadow-lg text-xs uppercase`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
