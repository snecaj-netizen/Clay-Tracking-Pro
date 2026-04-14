import React, { createContext, useContext, useState, useCallback } from 'react';

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  variant?: 'danger' | 'primary';
}

interface ToastConfig {
  isOpen: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIContextType {
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  triggerToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  confirmConfig: ConfirmConfig;
  setConfirmConfig: React.Dispatch<React.SetStateAction<ConfirmConfig>>;
  toastConfig: ToastConfig;
  setToastConfig: React.Dispatch<React.SetStateAction<ToastConfig>>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    isOpen: false,
    message: '',
    type: 'success',
  });

  const triggerConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, confirmText, variant });
  }, []);

  const triggerToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastConfig({ isOpen: true, message, type });
  }, []);

  return (
    <UIContext.Provider value={{
      triggerConfirm,
      triggerToast,
      confirmConfig,
      setConfirmConfig,
      toastConfig,
      setToastConfig
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
