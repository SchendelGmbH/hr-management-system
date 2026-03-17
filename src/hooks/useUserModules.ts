'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

interface UserModulePermission {
  moduleId: string;
  moduleKey: string;
  moduleName: string;
  canAccess: boolean;
}

interface UseUserModulesReturn {
  permissions: UserModulePermission[];
  allowedModuleKeys: Set<string>;
  isLoading: boolean;
  error: string | null;
}

export function useUserModules(): UseUserModulesReturn {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<UserModulePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Admin has access to all modules
      if (session.user.role === 'ADMIN') {
        const { data } = await axios.get('/api/modules');
        const allModules = (data.modules || []).map((m: any) => ({
          moduleId: m.id,
          moduleKey: m.key,
          moduleName: m.name,
          canAccess: true,
        }));
        setPermissions(allModules);
      } else {
        // Fetch user's module permissions
        const { data } = await axios.get('/api/user/modules');
        setPermissions(data.permissions || []);
      }
      
      setError(null);
    } catch (err) {
      console.error('[useUserModules] Error:', err);
      setError('Failed to load module permissions');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const allowedModuleKeys = useMemo(() => {
    return new Set(
      permissions
        .filter(p => p.canAccess)
        .map(p => p.moduleKey)
    );
  }, [permissions]);

  return {
    permissions,
    allowedModuleKeys,
    isLoading,
    error,
  };
}

// Helper function for useMemo
import { useMemo } from 'react';
