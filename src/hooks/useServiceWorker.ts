'use client';

import { useEffect, useState, useCallback } from 'react';

export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const registerSW = async () => {
      try {
        registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        setIsRegistered(true);

        // Check for updates
        registration.onupdatefound = () => {
          const newWorker = registration?.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            };
          }
        };

        // Handle messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SYNC_TRIGGERED') {
            // Trigger sync in the app
            window.dispatchEvent(new CustomEvent('chat-sync-triggered'));
          }
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    registerSW();

    return () => {
      // Cleanup if needed
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.serviceWorker?.controller) return;
    
    // Send skip waiting message to SW
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, []);

  const requestSync = useCallback(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    
    if ('sync' in registration) {
      (registration as any).sync.register('chat-messages-sync').catch(console.error);
    }
  }, []);

  return {
    isRegistered,
    updateAvailable,
    updateServiceWorker,
    requestSync,
  };
}

// Registration reference for sync
let registration: ServiceWorkerRegistration | null = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((reg) => {
    registration = reg;
  });
}
