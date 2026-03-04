import Link from 'next/link';
import { Building2, Tag, Sliders, Users, Bell, FileCheck, FileText, CircleDollarSign, Award } from 'lucide-react';

export default function SettingsPage() {
  const settings = [
    {
      title: 'Abteilungen',
      description: 'Abteilungen verwalten',
      icon: Building2,
      href: '/de/settings/departments',
      available: true,
    },
    {
      title: 'Kategorien',
      description: 'Dokument-Kategorien verwalten',
      icon: Tag,
      href: '/de/settings/categories',
      available: true,
    },
    {
      title: 'Dokumentvorlagen',
      description: 'Vertragsvorlagen mit Variablen',
      icon: FileText,
      href: '/de/settings/templates',
      available: true,
    },
    {
      title: 'Lohngruppen',
      description: 'Tariflohngruppen verwalten',
      icon: CircleDollarSign,
      href: '/de/settings/pay-grades',
      available: true,
    },
    {
      title: 'Qualifikationstypen',
      description: 'Unterweisungs-, Zertifikats- und Fortbildungstypen verwalten',
      icon: Award,
      href: '/de/settings/qualification-types',
      available: true,
    },
    {
      title: 'Custom Fields',
      description: 'Benutzerdefinierte Felder',
      icon: Sliders,
      href: '#',
      available: false,
    },
    {
      title: 'Benutzer',
      description: 'Benutzer-Verwaltung',
      icon: Users,
      href: '#',
      available: false,
    },
    {
      title: 'Benachrichtigungen',
      description: 'Benachrichtigungs-Einstellungen',
      icon: Bell,
      href: '#',
      available: false,
    },
    {
      title: 'Audit-Log',
      description: 'Änderungsprotokoll',
      icon: FileCheck,
      href: '/de/settings/audit-log',
      available: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
        <p className="mt-2 text-sm text-gray-600">System-Konfiguration und Verwaltung</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settings.map((setting) => {
          const Icon = setting.icon;
          const className = `rounded-lg border border-gray-200 bg-white p-6 transition-shadow ${
            setting.available ? 'hover:shadow-md cursor-pointer' : 'opacity-60'
          }`;

          const content = (
            <div className="flex items-start space-x-3">
              <div className="rounded-lg bg-primary-100 p-2">
                <Icon className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{setting.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{setting.description}</p>
                {!setting.available && (
                  <p className="mt-3 text-xs text-gray-400">Wird in Kürze verfügbar sein</p>
                )}
              </div>
            </div>
          );

          if (setting.available) {
            return (
              <Link key={setting.title} href={setting.href} className={className}>
                {content}
              </Link>
            );
          }

          return (
            <div key={setting.title} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
