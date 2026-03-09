import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-950/30 flex items-center justify-center text-red-500">
            <i className="fas fa-exclamation-triangle"></i>
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
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-red-600/20 text-xs uppercase"
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
