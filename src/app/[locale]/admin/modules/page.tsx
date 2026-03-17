'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminModules } from '@/hooks/useModules';
import { 
  Loader2, 
  Power, 
  PowerOff, 
  RefreshCw, 
  Plus,
  LayoutDashboard,
  Users,
  FileText,
  ShoppingCart,
  Calendar,
  ClipboardList,
  Award,
  ArrowRightLeft,
  CheckSquare,
  MessageCircle,
  PenTool,
  Bell,
  Package,
  Download
} from 'lucide-react';
import { clsx } from 'clsx';

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  LayoutDashboard,
  Users,
  FileText,
  ShoppingCart,
  Calendar,
  ClipboardList,
  Award,
  ArrowRightLeft,
  CheckSquare,
  MessageCircle,
  PenTool,
  Bell,
  Package,
  Download,
};

export default function AdminModulesPage() {
  const t = useTranslations();
  const { modules, isLoading, error, toggleModule, seedModules, refetch } = useAdminModules();
  const [seeding, setSeeding] = useState(false);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await toggleModule(id, !currentStatus);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedModules();
    } finally {
      setSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Modul-Verwaltung
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Aktivieren oder deaktivieren Sie Module für alle Benutzer
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding || modules.length > 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Standard-Module erstellen
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {/* Empty State */}
      {modules.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            Noch keine Module vorhanden. Erstellen Sie die Standard-Module.
          </p>
        </div>
      )}

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((module) => {
          const IconComponent = module.icon ? iconMap[module.icon] : LayoutDashboard;
          
          return (
            <div
              key={module.id}
              className={clsx(
                'p-6 rounded-lg border-2 transition-all',
                module.isActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-3 rounded-lg',
                    module.isActive
                      ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  )}>
                    {IconComponent && <IconComponent className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {module.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {module.description}
                    </p>
                    <code className="text-xs text-gray-400 mt-1 block">
                      {module.key}
                    </code>
                  </div>
                </div>
              </div>

              {/* Aktions-Button - Zeigt was passiert wenn man klickt */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleToggle(module.id!, module.isActive!)}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                    module.isActive
                      ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                  )}
                >
                  {module.isActive ? (
                    <>
                      <PowerOff className="h-4 w-4" />
                      Jetzt deaktivieren
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4" />
                      Jetzt aktivieren
                    </>
                  )}
                </button>
              </div>

              {/* Status Badge - Zeigt aktuellen Status */}
              <div className="mt-3 flex justify-center">
                <span className={clsx(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  module.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                )}>
                  {module.isActive ? '✓ Aktiviert' : '✗ Deaktiviert'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg">
        <p className="text-sm">
          <strong>Hinweis:</strong> Deaktivierte Module werden für alle Benutzer ausgeblendet. 
          Die Daten bleiben erhalten, aber der Zugriff ist nicht mehr möglich.
        </p>
      </div>
    </div>
  );
}
