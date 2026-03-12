'use client';

import { clsx } from 'clsx';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { QueuedMessage } from '@/hooks/useOfflineSync';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
  queue?: QueuedMessage[];
  onRetryMessage?: (messageId: string) => void;
  onRemoveMessage?: (messageId: string) => void;
  className?: string;
}

export function OfflineIndicator({
  isOnline,
  pendingCount,
  isSyncing,
  onSync,
  queue = [],
  onRetryMessage,
  onRemoveMessage,
  className,
}: OfflineIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={className}>
      {/* Status Bar */}
      <button
        onClick={() => pendingCount > 0 && setShowDetails(!showDetails)}
        className={clsx(
          'w-full px-4 py-2 flex items-center justify-between gap-2 transition-colors',
          isOnline
            ? 'bg-blue-50 border-b border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
            : 'bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
        )}
      >
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          <span className={clsx(
            'text-sm font-medium',
            isOnline ? 'text-blue-800 dark:text-blue-300' : 'text-amber-800 dark:text-amber-300'
          )}>
            {!isOnline && 'Offline'}
            {isOnline && pendingCount > 0 && `${pendingCount} Nachrichten ausstehend`}
          </span>
        </div>

        {isOnline && pendingCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSync();
            }}
            disabled={isSyncing}
            className={clsx(
              'flex items-center gap-1.5 text-sm font-medium transition-colors',
              isSyncing
                ? 'text-blue-400 cursor-not-allowed'
                : 'text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            )}
          >
            <RefreshCw className={clsx('h-4 w-4', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Synchronisiere...' : 'Jetzt senden'}
          </button>
        )}
      </button>

      {/* Pending Messages Details */}
      {showDetails && queue.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ausstehende Nachrichten
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {queue.map((message) => (
              <div key={message.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {message.content}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(message.timestamp).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {message.status === 'failed' && (
                      <span className="text-red-600 dark:text-red-400 ml-2">
                        (Fehlgeschlagen)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {message.status === 'failed' ? (
                    <div className="flex items-center gap-1">
                      {onRetryMessage && (
                        <button
                          onClick={() => onRetryMessage(message.id)}
                          className="p-1.5 rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      {onRemoveMessage && (
                        <button
                          onClick={() => onRemoveMessage(message.id)}
                          className="p-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      message.status === 'sending'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    )}>
                      {message.status === 'sending' ? 'Sende...' : 'Wartend'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Dot Indicator für Chat Header
export function ConnectionStatus({ 
  isOnline, 
  isSyncing 
}: { 
  isOnline: boolean; 
  isSyncing?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx(
        'h-2.5 w-2.5 rounded-full',
        isOnline && !isSyncing && 'bg-success-500',
        isSyncing && 'bg-blue-500 animate-pulse',
        !isOnline && 'bg-amber-500'
      )} />
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {!isOnline ? 'Offline' : isSyncing ? 'Synchronisiere...' : 'Online'}
      </span>
    </div>
  );
}
