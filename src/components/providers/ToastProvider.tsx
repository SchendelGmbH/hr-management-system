'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useToast, Toast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  // Convenience methods
  info: (title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, addToast, removeToast, clearToasts } = useToast();

  // Convenience methods
  const info = (title: string, message?: string) => {
    addToast({ title, message, type: 'info' });
  };

  const success = (title: string, message?: string) => {
    addToast({ title, message, type: 'success' });
  };

  const warning = (title: string, message?: string) => {
    addToast({ title, message, type: 'warning' });
  };

  const error = (title: string, message?: string) => {
    addToast({ title, message, type: 'error' });
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        clearToasts,
        info,
        success,
        warning,
        error,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}
