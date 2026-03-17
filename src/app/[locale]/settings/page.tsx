'use client';

import Link from 'next/link';
import { 
  Building2, 
  Tag, 
  Sliders, 
  Users, 
  Bell, 
  FileCheck, 
  FileText, 
  CircleDollarSign, 
  Award, 
  MapPin, 
  CalendarDays, 
  ArrowLeftRight, 
  Shield, 
  BellRing 
} from 'lucide-react';
import { useToastContext } from '@/components/providers/ToastProvider';

const settingsModules = [
  {
    title: 'Unternehmen',
    description: 'Unternehmensdaten und Stamminformationen',
    icon: Building2,
    href: '/de/settings/company',
    available: true,
  },
  {
    title: 'Kategorien',
    description: 'Dokumentenkategorien verwalten',
    icon: Tag,
    href: '/de/settings/categories',
    available: true,
  },
  {
    title: 'Benutzer',
    description: 'Benutzerverwaltung und Berechtigungen',
    icon: Users,
    href: '/de/settings/users',
    available: true,
  },
  {
    title: 'Tagesplanung',
    description: 'Einstellungen für die Tagesplanung',
    icon: CalendarDays,
    href: '/de/settings/planning',
    available: true,
  },
  {
    title: 'Schichttausch',
    description: 'Einstellungen für den Schichttausch',
    icon: ArrowLeftRight,
    href: '/de/settings/shift-swap',
    available: true,
  },
  {
    title: 'Rollen & Berechtigungen',
    description: 'Benutzerrollen und Modul-Zugriffe verwalten',
    icon: Shield,
    href: '/de/settings/roles',
    available: true,
  },
  {
    title: 'Audit-Log',
    description: 'Änderungsprotokoll',
    icon: FileCheck,
    href: '/de/settings/audit-log',
    available: true,
  },
  {
    title: 'E-Mail Vorlagen',
    description: 'E-Mail-Vorlagen verwalten',
    icon: FileText,
    href: '/de/settings/email-templates',
    available: false,
  },
  {
    title: 'Lohngruppen',
    description: 'Lohngruppen und Gehälter verwalten',
    icon: CircleDollarSign,
    href: '/de/settings/salary-groups',
    available: false,
  },
  {
    title: 'Standorte',
    description: 'Standorte und Filialen verwalten',
    icon: MapPin,
    href: '/de/settings/locations',
    available: false,
  },
  {
    title: 'Qualifikationen',
    description: 'Qualifikationen und Zertifikate verwalten',
    icon: Award,
    href: '/de/settings/qualifications',
    available: false,
  },
  {
    title: 'Benachrichtigungen',
    description: 'Benachrichtigungseinstellungen',
    icon: Bell,
    href: '/de/settings/notifications',
    available: false,
  },
  {
    title: 'System',
    description: 'Systemeinstellungen und Konfiguration',
    icon: Sliders,
    href: '/de/settings/system',
    available: false,
  },
];

export default function SettingsPage() {
  const { info } = useToastContext();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
          <p className="mt-2 text-gray-600">
            Verwalten Sie Ihre Systemeinstellungen und Konfigurationen
          </p>
        </div>

        {/* Test Toast Section - Prominent */}
        <div className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-full">
                <BellRing className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Toast-Benachrichtigungen</h2>
                <p className="text-indigo-100">Teste das neue Benachrichtigungs-System</p>
              </div>
            </div>
            <button
              onClick={() => info('Test-Benachrichtigung', 'Dies ist eine Test-Toast-Nachricht!')}
              className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-md"
            >
              Test Toast anzeigen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {settingsModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className={`group relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                  module.available
                    ? 'border-gray-200 hover:border-primary-300'
                    : 'border-gray-100 opacity-60 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  if (!module.available) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="flex items-start space-x-4">
                  <div className={`rounded-lg p-3 ${
                    module.available ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{module.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{module.description}</p>
                    
                    {!module.available && (
                      <span className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Demnächst verfügbar
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
