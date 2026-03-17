'use client';

import { useEffect, useState } from 'react';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  MessageCircle,
  Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { Toast, ToastType } from '@/hooks/useToast';

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const styles = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800',
};

const iconColors = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
};

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const Icon = icons[toast.type];

  useEffect(() => {
    const duration = toast.duration || 5000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast.duration]);

  const handleClick = () => {
    if (toast.onClick) {
      toast.onClick();
      onRemove(toast.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'relative flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'transform transition-all duration-300 ease-out',
        'animate-slide-in-right',
        styles[toast.type],
        toast.onClick && 'cursor-pointer hover:shadow-xl'
      )}
      role="alert"
    >
      {/* Icon */}
      <div className={clsx('flex-shrink-0', iconColors[toast.type])}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-sm opacity-90 mt-0.5">{toast.message}</p>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(toast.id);
        }}
        className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full hover:bg-black/5 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-lg overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-100 ease-linear',
            iconColors[toast.type].replace('text-', 'bg-')
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Spezialisierte Toast-Typen für Chat
export function ChatToast({ 
  sender, 
  message, 
  onClick 
}: { 
  sender: string; 
  message: string; 
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'bg-indigo-50 border-indigo-200 text-indigo-900',
        'cursor-pointer hover:bg-indigo-100 transition-colors',
        'transform transition-all duration-300 animate-slide-in-right'
      )}
    >
      <div className="flex-shrink-0 bg-indigo-100 p-2 rounded-full">
        <MessageCircle className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{sender}</p>
        <p className="text-sm opacity-90 mt-0.5 truncate">{message}</p>
      </div>
    </div>
  );
}

// Spezialisierte Toast-Typen für System-Benachrichtigungen
export function NotificationToast({ 
  title, 
  message, 
  type = 'info',
  onClick 
}: { 
  title: string; 
  message?: string; 
  type?: ToastType;
  onClick?: () => void;
}) {
  const Icon = type === 'info' ? Bell : icons[type];
  
  return (
    <div 
      onClick={onClick}
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        styles[type],
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        'transform transition-all duration-300 animate-slide-in-right'
      )}
    >
      <div className={clsx('flex-shrink-0', iconColors[type])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        {message && <p className="text-sm opacity-90 mt-0.5">{message}</p>}
      </div>
    </div>
  );
}
