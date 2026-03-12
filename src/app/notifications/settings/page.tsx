'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface NotificationTypeSetting {
  notificationType: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  priority: string | null;
  muted: boolean;
  mutedUntil: string | null;
}

interface NotificationSettings {
  id: string;
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart: string | null;
  doNotDisturbEnd: string | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  batchNotifications: boolean;
  batchIntervalMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  hideContentInLockScreen: boolean;
  timezone: string;
  typeSettings: NotificationTypeSetting[];
}

const notificationTypeLabels: Record<string, string> = {
  DOCUMENT_EXPIRING: 'Dokumente laufen ab',
  DOCUMENT_EXPIRED: 'Dokumente abgelaufen',
  LOW_BUDGET: 'Niedriges Budget',
  UPCOMING_VACATION: 'Bevorstehender Urlaub',
  QUALIFICATION_EXPIRING: 'Qualifikationen laufen ab',
  SHIFT_SWAP: 'Schichttausch-Anfragen',
  SHIFT_SWAP_RESPONSE: 'Schichttausch-Antworten',
  SHIFT_SWAP_APPROVED: 'Schichttausch genehmigt',
  SHIFT_SWAP_COMPLETED: 'Schichttausch abgeschlossen',
  TASK_ASSIGNED: 'Aufgaben zugewiesen',
  TASK_DUE_SOON: 'Aufgabe fällig bald',
  TASK_OVERDUE: 'Aufgabe überfällig',
  TASK_COMPLETED: 'Aufgabe abgeschlossen',
  SIGNATURE_REQUESTED: 'Unterschrift angefordert',
  SIGNATURE_APPROVED: 'Unterschrift genehmigt',
  SIGNATURE_SIGNED: 'Unterschrift geleistet',
  SIGNATURE_REJECTED: 'Unterschrift abgelehnt',
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      const data = await response.json();
      setSettings(data);
      setSuccess('Einstellungen erfolgreich gespeichert');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const updateGlobalSetting = (key: keyof NotificationSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const updateTypeSetting = (type: string, key: keyof NotificationTypeSetting, value: any) => {
    if (!settings) return;
    const typeSettings = settings.typeSettings.map((ts) =>
      ts.notificationType === type ? { ...ts, [key]: value } : ts
    );
    setSettings({ ...settings, typeSettings });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Benachrichtigungseinstellungen</h1>
          <p>Einstellungen laden...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Benachrichtigungseinstellungen</h1>
          <div className="bg-red-50 text-red-700 p-4 rounded">
            {error || 'Einstellungen konnten nicht geladen werden'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Benachrichtigungseinstellungen</h1>
        <div className="flex gap-2">
          {success && (
            <span className="text-green-600 mr-4">{success}</span>
          )}
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>
      )}

      <div className="space-y-6">
        {/* Global Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Globale Einstellungen</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Push-Benachrichtigungen</label>
                <p className="text-sm text-gray-500">Push-Benachrichtigungen auf allen Geräten erhalten</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.pushEnabled}
                  onChange={(e) => updateGlobalSetting('pushEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">E-Mail-Benachrichtigungen</label>
                <p className="text-sm text-gray-500">Benachrichtigungen auch per E-Mail erhalten</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.emailEnabled}
                  onChange={(e) => updateGlobalSetting('emailEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Benachrichtigungstöne</label>
                <p className="text-sm text-gray-500">Ton bei neuen Benachrichtigungen abspielen</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.soundEnabled}
                  onChange={(e) => updateGlobalSetting('soundEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Inhalt verbergen</label>
                <p className="text-sm text-gray-500">Benachrichtigungsinhalt im Sperrbildschirm ausblenden</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.hideContentInLockScreen}
                  onChange={(e) => updateGlobalSetting('hideContentInLockScreen', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Do Not Disturb */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Nicht stören</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Nicht stören aktivieren</label>
                <p className="text-sm text-gray-500">Wichtige Benachrichtigungen werden trotzdem angezeigt</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.doNotDisturb}
                  onChange={(e) => updateGlobalSetting('doNotDisturb', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.doNotDisturb && (
              <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-gray-200">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <Input
                    type="time"
                    value={settings.doNotDisturbStart || '22:00'}
                    onChange={(e) => updateGlobalSetting('doNotDisturbStart', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ende</label>
                  <Input
                    type="time"
                    value={settings.doNotDisturbEnd || '07:00'}
                    onChange={(e) => updateGlobalSetting('doNotDisturbEnd', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Ruhezeit (ohne Ton)</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Ruhezeit aktivieren</label>
                <p className="text-sm text-gray-500">Werden stumm empfangen, aber angezeigt</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.quietHoursEnabled}
                  onChange={(e) => updateGlobalSetting('quietHoursEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-gray-200">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <Input
                    type="time"
                    value={settings.quietHoursStart}
                    onChange={(e) => updateGlobalSetting('quietHoursStart', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ende</label>
                  <Input
                    type="time"
                    value={settings.quietHoursEnd}
                    onChange={(e) => updateGlobalSetting('quietHoursEnd', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Type-specific Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Benachrichtigungstypen</h2>
          
          <div className="space-y-4">
            {settings.typeSettings.map((typeSetting) => (
              <div
                key={typeSetting.notificationType}
                className="border rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">
                    {notificationTypeLabels[typeSetting.notificationType] ||
                      typeSetting.notificationType}
                  </span>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!typeSetting.muted}
                      onChange={(e) =>
                        updateTypeSetting(
                          typeSetting.notificationType,
                          'muted',
                          !e.target.checked
                        )
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {!typeSetting.muted && (
                  <div className="pl-6 border-l-2 border-gray-200 space-y-3">
                    <div className="flex flex-wrap gap-4">
                      {['inAppEnabled', 'pushEnabled', 'emailEnabled', 'smsEnabled'].map((key) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={typeSetting[key as keyof typeof typeSetting] as boolean}
                            onChange={(e) =>
                              updateTypeSetting(
                                typeSetting.notificationType,
                                key as keyof NotificationTypeSetting,
                                e.target.checked
                              )
                            }
                          />
                          <span className="text-sm">
                            {key === 'inAppEnabled' && 'In-App'}
                            {key === 'pushEnabled' && 'Push'}
                            {key === 'emailEnabled' && 'E-Mail'}
                            {key === 'smsEnabled' && 'SMS'}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm">Priorität:</span>
                      <Select
                        value={typeSetting.priority || 'NORMAL'}
                        onChange={(value) =>
                          updateTypeSetting(
                            typeSetting.notificationType,
                            'priority',
                            value
                          )
                        }
                        options={[
                          { value: 'LOW', label: 'Niedrig' },
                          { value: 'NORMAL', label: 'Normal' },
                          { value: 'HIGH', label: 'Hoch' },
                          { value: 'URGENT', label: 'Dringend' },
                        ]}
                        className="w-32"
                      >
                        <option value="LOW">Niedrig</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">Hoch</option>
                        <option value="URGENT">Dringend</option>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}