/**
 * useVertretung Hook - React Hook für Vertretungsanfragen
 */

import { useState, useCallback } from 'react';

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

interface VertretungSuchenParams {
  krankerMitarbeiterId: string;
  startDatum: string;
  endDatum: string;
}

interface VertretungAnfragenParams {
  vertretungsMitarbeiterId: string;
  krankerMitarbeiterId: string;
  startDatum: string;
  endDatum: string;
  nachricht?: string;
}

interface SucheErgebnis {
  krankerMitarbeiter: {
    id: string;
    name: string;
    employeeNumber: string;
    geplanteBaustellen: string[];
    qualifications: string[];
  };
  zeitraum: {
    start: string;
    end: string;
  };
  vorschlaege: VertretungsVorschlag[];
  alternative: VertretungsVorschlag[];
}

interface UseVertretungReturn {
  suchen: (params: VertretungSuchenParams) => Promise<SucheErgebnis | null>;
  anfragen: (params: VertretungAnfragenParams) => Promise<{ success: boolean; message: string; chatRoomId?: string } | null>;
  loading: boolean;
  error: string | null;
}

export function useVertretung(): UseVertretungReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suchen = useCallback(async (params: VertretungSuchenParams): Promise<SucheErgebnis | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vertretung/suchen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Suchen');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const anfragen = useCallback(async (params: VertretungAnfragenParams): Promise<{ success: boolean; message: string; chatRoomId?: string } | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vertretung/anfragen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Senden der Anfrage');
      }

      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
        chatRoomId: data.chatRoomId,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    suchen,
    anfragen,
    loading,
    error,
  };
}
