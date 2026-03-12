'use client';

import { useState } from 'react';
import { useVertretung } from '@/hooks/useVertretung';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  UserCheck, 
  UserX, 
  MapPin, 
  Award, 
  Building2, 
 Loader2,
  Send,
  CheckCircle,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface VertretungsVorschlag {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  score: number;
  gruende: string[];
  qualifications: string[];
  istVerfuegbar: boolean;
  grundNichtVerfuegbar?: string;
}

interface VertretungVorschlagProps {
  krankerMitarbeiterId: string;
  startDatum: string;
  endDatum: string;
  onClose?: () => void;
}

export function VertretungVorschlaege({ 
  krankerMitarbeiterId, 
  startDatum, 
  endDatum,
  onClose 
}: VertretungVorschlagProps) {
  const router = useRouter();
  const { suchen, anfragen, loading, error } = useVertretung();
  const [vorschlaege, setVorschlaege] = useState<VertretungsVorschlag[]>([]);
  const [alternative, setAlternative] = useState<VertretungsVorschlag[]>([]);
  const [krankerName, setKrankerName] = useState<string>('');
  const [searched, setSearched] = useState(false);
  const [anfragendId, setAnfragendId] = useState<string | null>(null);

  const handleSuchen = async () => {
    const result = await suchen({
      krankerMitarbeiterId,
      startDatum,
      endDatum,
    });

    if (result) {
      setVorschlaege(result.vorschlaege);
      setAlternative(result.alternative);
      setKrankerName(result.krankerMitarbeiter.name);
      setSearched(true);
    }
  };

  const handleAnfragen = async (vorschlag: VertretungsVorschlag) => {
    setAnfragendId(vorschlag.employeeId);
    
    const result = await anfragen({
      vertretungsMitarbeiterId: vorschlag.employeeId,
      krankerMitarbeiterId,
      startDatum,
      endDatum,
      nachricht: `Automatische Anfrage zur Vertretung für ${krankerName}`,
    });

    if (result?.success) {
      toast.success(result.message);
      if (result.chatRoomId) {
        // Option: Öffne Chat direkt
        router.push(`/chat?room=${result.chatRoomId}`);
      }
      if (onClose) onClose();
    } else {
      toast.error(result?.message || 'Fehler beim Senden');
    }
    
    setAnfragendId(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreText = (score: number) => {
    if (score >= 80) return 'Exzellent';
    if (score >= 60) return 'Gut';
    if (score >= 40) return 'Mittel';
    return 'Gering';
  };

  if (!searched) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚑 Vertretung suchen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Zeitraum:</strong> {startDatum} bis {endDatum}</p>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
          )}

          <Button 
            onClick={handleSuchen} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suche läuft...
              </>
            ) : (
              <>Suche starten</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🚑 Vertretungsvorschläge für {krankerName}</span>
          <Badge variant="secondary">{vorschlaege.length} gefunden</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vorschlaege.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserX className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Keine Vertretungsvorschläge gefunden.</p>
            <p className="text-sm">Versuchen Sie es mit einem anderen Zeitraum.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vorschlaege.map((vorschlag) => (
              <Card key={vorschlag.employeeId} className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-5 w-5 text-green-500" />
                        <span className="font-semibold">
                          {vorschlag.firstName} {vorschlag.lastName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({vorschlag.employeeNumber})
                        </span>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Match-Score: {getScoreText(vorschlag.score)}</span>
                          <span className="font-mono">{vorschlag.score}%</span>
                        </div>
                        <Progress 
                          value={vorschlag.score} 
                          className={`h-2 ${getScoreColor(vorschlag.score)}`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {vorschlag.gruende.map((grund, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {grund.includes('Abteilung') && <Building2 className="h-3 w-3 mr-1" />}
                            {grund.includes('Baustelle') && <MapPin className="h-3 w-3 mr-1" />}
                            {grund.includes('Qualifikation') && <Award className="h-3 w-3 mr-1" />}
                            {grund}
                          </Badge>
                        ))}
                      </div>

                      {vorschlag.qualifications.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Qualifikationen:</strong> {vorschlag.qualifications.join(', ')}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAnfragen(vorschlag)}
                      disabled={anfragendId === vorschlag.employeeId || !vorschlag.istVerfuegbar}
                      className="ml-4"
                    >
                      {anfragendId === vorschlag.employeeId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          Anfragen
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {alternative.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Alternativen (aktuell nicht verfügbar):
            </h4>
            <div className="space-y-2 opacity-60">
              {alternative.slice(0, 3).map((vorschlag) => (
                <Card key={vorschlag.employeeId}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4 text-red-500" />
                        <span>{vorschlag.firstName} {vorschlag.lastName}</span>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {vorschlag.grundNichtVerfuegbar}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm mt-4">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}
