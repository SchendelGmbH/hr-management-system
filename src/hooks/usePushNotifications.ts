'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Convert URL-safe base64 to Uint8Array
 * Needed for Web Push API
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  subscription: PushSubscription | null;
  isSubscribing: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { data: session } = useSession();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check support and current permission
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if Push API is supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      // Get current permission
      setPermission(Notification.permission);

      // Check existing subscription
      checkExistingSubscription();
    }
  }, []);

  // Check for existing subscription
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      setSubscription(existingSubscription);
      return existingSubscription;
    } catch (err) {
      console.error('Failed to check existing subscription:', err);
      return null;
    }
  };

  // Request notification permission
  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      throw new Error('Push notifications not supported');
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (err) {
      console.error('Failed to request permission:', err);
      throw err;
    }
  };

  // Subscribe to push notifications
  const subscribe = async () => {
    if (!isSupported) {
      setError('Push-Benachrichtigungen werden in diesem Browser nicht unterstützt');
      return;
    }

    if (!session?.user?.id) {
      setError('Sie müssen eingeloggt sein');
      return;
    }

    setIsSubscribing(true);
    setError(null);

    try {
      // Request permission first
      const permissionResult = await requestPermission();
      if (permissionResult !== 'granted') {
        setError('Benachrichtigungsberechtigung wurde verweigert');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError('Push-Konfiguration nicht verfügbar');
        return;
      }

      // Subscribe
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      setSubscription(pushSubscription);

      // Send subscription to server
      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: pushSubscription.endpoint,
            keys: {
              p256dh: pushSubscription.toJSON().keys?.p256dh || '',
              auth: pushSubscription.toJSON().keys?.auth || '',
            },
          },
          deviceInfo: {
            deviceType: 'WEB',
            deviceName: navigator.userAgent,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register subscription on server');
      }

      console.log('[Push] Successfully subscribed');
    } catch (err) {
      console.error('Failed to subscribe to push:', err);
      setError(err instanceof Error ? err.message : 'Abonnement fehlgeschlagen');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async () => {
    if (!subscription) return;

    setIsSubscribing(true);
    setError(null);

    try {
      // Unsubscribe from push manager
      await subscription.unsubscribe();
      setSubscription(null);

      // Tell server to remove subscription
      await fetch('/api/notifications/push/subscribe', {
        method: 'DELETE',
      });

      console.log('[Push] Successfully unsubscribed');
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError(err instanceof Error ? err.message : 'Kündigung fehlgeschlagen');
    } finally {
      setIsSubscribing(false);
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    isSubscribing,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}