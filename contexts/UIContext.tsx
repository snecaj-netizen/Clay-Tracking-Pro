import React, { createContext, useContext, useState, useCallback } from 'react';

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  variant?: 'danger' | 'primary';
  showCancel?: boolean;
}

interface ToastConfig {
  isOpen: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIContextType {
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  triggerAlert: (title: string, message: string, onConfirm?: () => void, confirmText?: string) => void;
  triggerToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  confirmConfig: ConfirmConfig;
  setConfirmConfig: React.Dispatch<React.SetStateAction<ConfirmConfig>>;
  toastConfig: ToastConfig;
  setToastConfig: React.Dispatch<React.SetStateAction<ToastConfig>>;
  isHeaderVisible: boolean;
  setIsHeaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    showCancel: true,
  });

  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    isOpen: false,
    message: '',
    type: 'success',
  });

  const triggerConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, confirmText, variant, showCancel: true });
  }, []);

  const triggerAlert = useCallback((title: string, message: string, onConfirm: () => void = () => {}, confirmText?: string) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, confirmText, variant: 'primary', showCancel: false });
  }, []);

  const triggerToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastConfig({ isOpen: true, message, type });
  }, []);

  return (
    <UIContext.Provider value={{
      triggerConfirm,
      triggerAlert,
      triggerToast,
      confirmConfig,
      setConfirmConfig,
      toastConfig,
      setToastConfig,
      isHeaderVisible,
      setIsHeaderVisible
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
