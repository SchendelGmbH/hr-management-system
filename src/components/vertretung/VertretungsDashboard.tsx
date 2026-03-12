'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  Calendar, 
  User, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface OffeneVertretung {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  messageCount: number;
  latestMessage: {
    id: string;
    content: string;
    sentAt: string;
    isSystem: boolean;
  } | null;
  krankerMitarbeiter: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: { name: string } | null;
  } | null;
  startDatum: string | null;
  endDatum: string | null;
  isActive: boolean;
  members: Array<{
    userId: string;
    role: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNumber: string;
    } | null;
  }>;
}

export function VertretungsDashboard() {
  const router = useRouter();
  const [vertretungen, setVertretungen] = useState<OffeneVertretung[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, active: 0, past: 0 });

  const fetchVertretungen = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/vertretung/offen');
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setVertretungen(data.offeneVertretungen);
      setMeta(data.meta);
    } catch (error) {
      toast.error('Fehler beim Laden der Vertretungen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVertretungen();
  }, []);

  const handleOpenChat = (roomId: string) => {
    router.push(`/chat?room=${roomId}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    // Prüfe ob es bereit DD.MM.YYYY ist
    if (dateStr.includes('.')) return dateStr;
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚑 Offene Vertretungen
            <RefreshCw className="h-4 w-4 animate-spin" />
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Lade...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            🚑 Offene Vertretungen
            <Badge variant={meta.active > 0 ? "destructive" : "secondary"}>
              {meta.active} aktiv
            </Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchVertretungen}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {vertretungen.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Keine offenen Vertretungen</p>
            <p className="text-sm mt-2">
              Alle Krankmeldungen wurden abgedeckt. 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vertretungen.map((v) => (
              <div 
                key={v.id}
                className={`p-4 rounded-lg border transition-colors hover:bg-muted/50 cursor-pointer ${
                  v.isActive ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-gray-300'
                }`}
                onClick={() => handleOpenChat(v.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {v.isActive ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-semibold">
                        {v.krankerMitarbeiter && (
                          <>{v.krankerMitarbeiter.firstName} {v.krankerMitarbeiter.lastName} (</>
                        )}
                        {v.krankerMitarbeiter?.employeeNumber || 'Unbekannt'}
                        {v.krankerMitarbeiter && ')'}
                      </span>
                      <Badge variant={v.isActive ? "destructive" : "secondary"} className="text-xs">
                        {v.isActive ? 'Aktiv' : 'Abgeschlossen'}
                      </Badge>
                    </div>

                    {v.krankerMitarbeiter?.department && (
                      <div className="text-sm text-muted-foreground mb-2">
                        {v.krankerMitarbeiter.department.name}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(v.startDatum)} - {formatDate(v.endDatum)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {v.messageCount} Nachrichten
                      </span>
                    </div>

                    {v.latestMessage && (
                      <div className="mt-2 text-sm text-muted-foreground truncate">
                        <strong>Letzte Nachricht: </strong>
                        {v.latestMessage.isSystem && <span className="text-blue-500">[System] </span>}
                        {v.latestMessage.content.substring(0, 100)}
                        {v.latestMessage.content.length > 100 && '...'}
                      </div>
                    )}
                  </div>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenChat(v.id);
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
