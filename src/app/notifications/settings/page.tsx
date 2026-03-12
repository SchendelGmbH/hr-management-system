'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Smartphone, Mail, Clock, Moon, BellOff } from 'lucide-react';

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
        <Card>
          <CardHeader>
            <CardTitle>Einstellungen laden...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Einstellungen konnten nicht geladen werden'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Benachrichtigungseinstellungen
        </h1>
        <div className="flex gap-2">
          {success && (
            <Alert className="mr-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Global Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Globale Einstellungen
            </CardTitle>
            <CardDescription>
              Grundlegende Benachrichtigungseinstellungen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pushEnabled">Push-Benachrichtigungen</Label>
                <p className="text-sm text-gray-500">
                  Push-Benachrichtigungen auf allen Geräten erhalten
                </p>
              </div>
              <Switch
                id="pushEnabled"
                checked={settings.pushEnabled}
                onCheckedChange={(checked) =>
                  updateGlobalSetting('pushEnabled', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailEnabled">E-Mail-Benachrichtigungen</Label>
                <p className="text-sm text-gray-500">
                  Benachrichtigungen auch per E-Mail erhalten
                </p>
              </div>
              <Switch
                id="emailEnabled"
                checked={settings.emailEnabled}
                onCheckedChange={(checked) =>
                  updateGlobalSetting('emailEnabled', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="soundEnabled">Benachrichtigungstöne</Label>
                <p className="text-sm text-gray-500">
                  Ton bei neuen Benachrichtigungen abspielen
                </p>
              </div>
              <Switch
                id="soundEnabled"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) =>
                  updateGlobalSetting('soundEnabled', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="hideContentInLockScreen">Inhalt verbergen</Label>
                <p className="text-sm text-gray-500">
                  Benachrichtigungsinhalt im Sperrbildschirm ausblenden
                </p>
              </div>
              <Switch
                id="hideContentInLockScreen"
                checked={settings.hideContentInLockScreen}
                onCheckedChange={(checked) =>
                  updateGlobalSetting('hideContentInLockScreen', checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Do Not Disturb */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Nicht stören
            </CardTitle>
            <CardDescription>
              Zeitraum festlegen, in dem keine Benachrichtigungen angezeigt werden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="doNotDisturb">Nicht stören aktivieren</Label>
                <p className="text-sm text-gray-500">
                  Wichtige Benachrichtigungen werden trotzdem angezeigt
                </p>
              </div>
              <Switch
                id="doNotDisturb"
                checked={settings.doNotDisturb}
                onCheckedChange={(checked) =>
                  updateGlobalSetting('doNotDisturb', checked)
                }
              />
            </div>

            {settings.doNotDisturb && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="doNotDisturbStart">Start</Label>
                    <Input
                      id="doNotDisturbStart"
                      type="time"
                      value={settings.doNotDisturbStart || '22:00'}
                      onChange={(e) =>
                        updateGlobalSetting('doNotDisturbStart', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doNotDisturbEnd">Ende</Label>
                    <Input
                      id="doNotDisturbEnd"
                      type="time"
                      value={settings.doNotDisturbEnd || '07:00'}
                      onChange={(e) =>
                        updateGlobalSetting('doNotDisturbEnd', e.target.value)
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ruhezeit (ohne Ton)
            </CardTitle>
            <CardDescription>
              Zeitraum festlegen, in dem keine Benachrichtigungstöne abgespielt werden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="quietHoursEnabled">Ruhezeit aktivieren</Label>
                <p className="text-sm text-gray-500">
                  Werden stumm empfangen, aber angezeigt
                </p>
              </div>
              <Switch
                id="quietHoursEnabled"
                checked={settings.quietHoursEnabled}
                onCheckedChange={(checked) =>
                  updateGlobalSetting('quietHoursEnabled', checked)
                }
              />
            </div>

            {settings.quietHoursEnabled && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quietHoursStart">Start</Label>
                    <Input
                      id="quietHoursStart"
                      type="time"
                      value={settings.quietHoursStart}
                      onChange={(e) =>
                        updateGlobalSetting('quietHoursStart', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quietHoursEnd">Ende</Label>
                    <Input
                      id="quietHoursEnd"
                      type="time"
                      value={settings.quietHoursEnd}
                      onChange={(e) =>
                        updateGlobalSetting('quietHoursEnd', e.target.value)
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Type-specific Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Benachrichtigungstypen</CardTitle>
            <CardDescription>
              Konfigurieren Sie die Einstellungen für einzelne Benachrichtigungstypen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settings.typeSettings.map((typeSetting) => (
                <div
                  key={typeSetting.notificationType}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {notificationTypeLabels[typeSetting.notificationType] ||
                        typeSetting.notificationType}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!typeSetting.muted}
                        onCheckedChange={(checked) =>
                          updateTypeSetting(
                            typeSetting.notificationType,
                            'muted',
                            !checked
                          )
                        }
                      />
                      <span className="text-sm text-gray-500">
                        {typeSetting.muted ? 'Stumm' : 'Aktiv'}
                      </span>
                    </div>
                  </div>

                  {!typeSetting.muted && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`${typeSetting.notificationType}-inApp`}
                            checked={typeSetting.inAppEnabled}
                            onCheckedChange={(checked) =>
                              updateTypeSetting(
                                typeSetting.notificationType,
                                'inAppEnabled',
                                checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`${typeSetting.notificationType}-inApp`}
                            className="text-sm cursor-pointer"
                          >
                            In-App
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`${typeSetting.notificationType}-push`}
                            checked={typeSetting.pushEnabled}
                            onCheckedChange={(checked) =>
                              updateTypeSetting(
                                typeSetting.notificationType,
                                'pushEnabled',
                                checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`${typeSetting.notificationType}-push`}
                            className="text-sm cursor-pointer"
                          >
                            Push
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`${typeSetting.notificationType}-email`}
                            checked={typeSetting.emailEnabled}
                            onCheckedChange={(checked) =>
                              updateTypeSetting(
                                typeSetting.notificationType,
                                'emailEnabled',
                                checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`${typeSetting.notificationType}-email`}
                            className="text-sm cursor-pointer"
                          >
                            E-Mail
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`${typeSetting.notificationType}-sms`}
                            checked={typeSetting.smsEnabled}
                            onCheckedChange={(checked) =>
                              updateTypeSetting(
                                typeSetting.notificationType,
                                'smsEnabled',
                                checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`${typeSetting.notificationType}-sms`}
                            className="text-sm cursor-pointer"
                          >
                            SMS
                          </Label>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Priorität:</Label>
                        <Select
                          value={typeSetting.priority || 'NORMAL'}
                          onValueChange={(value) =>
                            updateTypeSetting(
                              typeSetting.notificationType,
                              'priority',
                              value
                            )
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">Niedrig</SelectItem>
                            <SelectItem value="NORMAL">Normal</SelectItem>
                            <SelectItem value="HIGH">Hoch</SelectItem>
                            <SelectItem value="URGENT">Dringend</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Settings } from 'lucide-react';