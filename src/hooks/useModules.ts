'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface Module {
  id?: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
  order: number;
}

interface UseModulesReturn {
  modules: Module[];
  activeModules: Module[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Hook für alle Benutzer (nur aktive Module)
export function useModules(): UseModulesReturn {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get('/api/modules');
      setModules(data.modules || []);
      setError(null);
    } catch (err) {
      console.error('[useModules] Error:', err);
      setError('Failed to load modules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  return {
    modules,
    activeModules: modules.filter(m => m.isActive !== false),
    isLoading,
    error,
    refetch: fetchModules,
  };
}

// Hook für Admin (alle Module mit Status)
export function useAdminModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get('/api/admin/modules');
      setModules(data.modules || []);
      setError(null);
    } catch (err) {
      console.error('[useAdminModules] Error:', err);
      setError('Failed to load modules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleModule = useCallback(async (id: string, isActive: boolean) => {
    try {
      await axios.patch('/api/admin/modules', { id, isActive });
      // Optimistic update
      setModules(prev => prev.map(m => 
        m.id === id ? { ...m, isActive } : m
      ));
      return true;
    } catch (err) {
      console.error('[useAdminModules] Toggle error:', err);
      return false;
    }
  }, []);

  const seedModules = useCallback(async () => {
    try {
      const { data } = await axios.post('/api/admin/modules', { action: 'seed' });
      await fetchModules();
      return data;
    } catch (err) {
      console.error('[useAdminModules] Seed error:', err);
      throw err;
    }
  }, [fetchModules]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  return {
    modules,
    isLoading,
    error,
    refetch: fetchModules,
    toggleModule,
    seedModules,
  };
}

// Hilfsfunktion: Prüfen ob ein Modul aktiv ist
export function isModuleActive(modules: Module[], key: string): boolean {
  return modules.some(m => m.key === key);
}
