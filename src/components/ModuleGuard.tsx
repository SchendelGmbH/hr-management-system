'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useModules } from '@/hooks/useModules';
import { useSystemSettings, isShiftSwapAllowed } from '@/hooks/useSystemSettings';
import { Loader2, Lock } from 'lucide-react';

interface ModuleGuardProps {
  children: React.ReactNode;
  moduleKey: string;
  requireShiftSwap?: boolean;
}

export function ModuleGuard({ children, moduleKey, requireShiftSwap }: ModuleGuardProps) {
  const router = useRouter();
  const { activeModules, isLoading: modulesLoading } = useModules();
  const { settings: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (modulesLoading || settingsLoading) return;

    // Check if module is active
    const moduleActive = activeModules.some((m) => m.key === moduleKey);
    
    // Check shift swap settings if required
    let shiftSwapAllowed = true;
    if (requireShiftSwap || moduleKey === 'shiftSwap') {
      shiftSwapAllowed = isShiftSwapAllowed(systemSettings);
    }

    const allowed = moduleActive && shiftSwapAllowed;
    setIsAllowed(allowed);

    if (!allowed) {
      // Redirect to dashboard after a short delay
      const timer = setTimeout(() => {
        router.push('/de');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeModules, systemSettings, modulesLoading, settingsLoading, moduleKey, requireShiftSwap, router]);

  if (modulesLoading || settingsLoading || isAllowed === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <p className="text-gray-500">Lade...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Zugriff verweigert</h1>
          <p className="text-gray-600 mb-6">
            Dieses Modul ist deaktiviert oder nicht verfügbar.
          </p>
          <p className="text-sm text-gray-500">
            Sie werden zum Dashboard weitergeleitet...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
