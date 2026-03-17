'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, PermissionKey } from '@/lib/permissions';

interface Permission {
  id: string;
  key: string;
  granted: boolean;
}

interface UsePermissionsReturn {
  permissions: Permission[];
  isLoading: boolean;
  isAdmin: boolean;
  hasPermission: (key: PermissionKey) => boolean;
  hasAnyPermission: (keys: PermissionKey[]) => boolean;
  hasAllPermissions: (keys: PermissionKey[]) => boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check admin status from session role name
  const isAdmin = session?.user?.role === 'ADMIN';

  const fetchPermissions = useCallback(async () => {
    // Admin doesn't need to fetch permissions - has all
    if (isAdmin) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data } = await axios.get('/api/user/permissions');
      setPermissions(data.permissions || []);
    } catch (err) {
      console.error('[usePermissions] Error:', err);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((key: PermissionKey): boolean => {
    // Admin always has all permissions
    if (isAdmin) return true;
    
    return permissions.some(p => p.key === key && p.granted);
  }, [permissions, isAdmin]);

  const hasAnyPermission = useCallback((keys: PermissionKey[]): boolean => {
    return keys.some(key => hasPermission(key));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((keys: PermissionKey[]): boolean => {
    return keys.every(key => hasPermission(key));
  }, [hasPermission]);

  return {
    permissions,
    isLoading,
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

export { PERMISSIONS };
export type { PermissionKey };
