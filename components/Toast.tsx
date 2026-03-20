import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
}

const Toast: React.FC<ToastProps> = ({ message, isOpen, onClose, type = 'success' }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-8 duration-500">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-md shadow-2xl ${
        isSuccess ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400' : 
        isError ? 'bg-red-950/80 border-red-500/50 text-red-400' : 
        'bg-slate-900/80 border-slate-700/50 text-slate-300'
      }`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isSuccess ? 'bg-emerald-500/20' : 
          isError ? 'bg-red-500/20' : 
          'bg-slate-700/20'
        }`}>
          <i className={`fas ${isSuccess ? 'fa-check-circle' : isError ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
        </div>
        <p className="text-sm font-black uppercase tracking-tight">{message}</p>
      </div>
    </div>
  );
};

export default Toast;
