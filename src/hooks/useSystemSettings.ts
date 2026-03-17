'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

type ShiftSwapMode = 'allowed' | 'approval_required' | 'forbidden';

interface SystemSettings {
  shiftSwap: {
    mode: ShiftSwapMode;
  };
}

interface UseSystemSettingsReturn {
  settings: SystemSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateShiftSwapMode: (mode: ShiftSwapMode) => Promise<boolean>;
}

export function useSystemSettings(): UseSystemSettingsReturn {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get('/api/settings/system');
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error('[useSystemSettings] Error:', err);
      setError('Failed to load settings');
      // Set defaults on error
      setSettings({
        shiftSwap: { mode: 'allowed' },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateShiftSwapMode = useCallback(async (mode: ShiftSwapMode) => {
    try {
      await axios.patch('/api/settings/system', { shiftSwap: { mode } });
      // Optimistic update
      setSettings((prev) =>
        prev ? { ...prev, shiftSwap: { mode } } : { shiftSwap: { mode } }
      );
      return true;
    } catch (err) {
      console.error('[useSystemSettings] Update error:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
    updateShiftSwapMode,
  };
}

// Helper: Prüfen ob Schichttausch erlaubt ist
export function isShiftSwapAllowed(settings: SystemSettings | null): boolean {
  if (!settings) return true; // Default: erlaubt
  return settings.shiftSwap.mode !== 'forbidden';
}

// Helper: Prüfen ob Schichttausch Genehmigung braucht
export function isShiftSwapApprovalRequired(settings: SystemSettings | null): boolean {
  if (!settings) return false; // Default: keine Genehmigung
  return settings.shiftSwap.mode === 'approval_required';
}
