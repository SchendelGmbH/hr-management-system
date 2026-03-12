/**
 * React Hook für Shift Swap Funktionalität
 * Bietet CRUD-Operationen und Realtime-Updates
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { onSwapEvent, ShiftSwapEvents } from '@/lib/eventBus';

export interface SwapRequest {
  id: string;
  requesterId: string;
  requesterShiftId: string;
  requesterDate: string;
  requesterSiteId: string;
  requesterStartTime: string;
  requesterEndTime: string;
  requestedEmployeeId: string | null;
  requestedShiftId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  expiresAt: string | null;
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: { name: string };
  };
  requested?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: { name: string };
  } | null;
  requesterShift?: {
    id: string;
    site: {
      name: string;
      location?: string;
      workSite?: { name: string };
    };
  };
  responses?: SwapResponse[];
}

export interface SwapResponse {
  id: string;
  swapRequestId: string;
  responderId: string;
  responderShiftId: string;
  responderDate: string;
  responderSiteId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  responder?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  responderShift?: {
    id: string;
    site: {
      name: string;
      location?: string;
    };
  };
}

interface UseShiftSwapsOptions {
  employeeId?: string;
  status?: string;
  type?: 'sent' | 'received' | 'all';
}

export function useShiftSwaps(options: UseShiftSwapsOptions = {}) {
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSwaps = useCallback(async () => {
    if (!options.employeeId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('employeeId', options.employeeId);
      if (options.status) params.append('status', options.status);
      if (options.type) params.append('type', options.type);

      const response = await fetch(`/api/swaps/request?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden der Tauschanfragen');
      }

      setSwaps(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      console.error('Error fetching swaps:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options.employeeId, options.status, options.type]);

  // Lade Initialdaten
  useEffect(() => {
    fetchSwaps();
  }, [fetchSwaps]);

  // Abonniere Realtime-Updates
  useEffect(() => {
    const unsubscribeUpdate = onSwapEvent(ShiftSwapEvents.SWAP_UPDATED, () => {
      fetchSwaps();
    });

    const unsubscribeResponse = onSwapEvent(ShiftSwapEvents.SWAP_RESPONSE_CREATED, () => {
      fetchSwaps();
    });

    const unsubscribeCompleted = onSwapEvent(ShiftSwapEvents.SWAP_COMPLETED, () => {
      fetchSwaps();
    });

    return () => {
      unsubscribeUpdate();
      unsubscribeResponse();
      unsubscribeCompleted();
    };
  }, [fetchSwaps]);

  const createSwapRequest = async (data: {
    requesterShiftId: string;
    requesterDate: string;
    requesterSiteId: string;
    requesterStartTime?: string;
    requesterEndTime?: string;
    requestedEmployeeId?: string | null;
    requestedShiftId?: string | null;
    note?: string;
    expiresAt?: string | null;
  }) => {
    try {
      const response = await fetch('/api/swaps/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Erstellen der Anfrage');
      }

      await fetchSwaps();
      return result.data;
    } catch (err) {
      console.error('Error creating swap request:', err);
      throw err;
    }
  };

  const approveSwap = async (swapId: string, responseId?: string, note?: string) => {
    try {
      const response = await fetch('/api/swaps/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId,
          responseId,
          action: 'APPROVE',
          note,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Genehmigen');
      }

      await fetchSwaps();
      return result.data;
    } catch (err) {
      console.error('Error approving swap:', err);
      throw err;
    }
  };

  const rejectSwap = async (swapId: string, responseId?: string) => {
    try {
      const response = await fetch('/api/swaps/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId,
          responseId,
          action: 'REJECT',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Ablehnen');
      }

      await fetchSwaps();
      return result.data;
    } catch (err) {
      console.error('Error rejecting swap:', err);
      throw err;
    }
  };

  const cancelSwap = async (swapId: string) => {
    try {
      const response = await fetch('/api/swaps/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId,
          action: 'CANCEL',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Stornieren');
      }

      await fetchSwaps();
      return result.data;
    } catch (err) {
      console.error('Error cancelling swap:', err);
      throw err;
    }
  };

  const respondToSwap = async (data: {
    swapId: string;
    responderShiftId: string;
    responderDate: string;
    responderSiteId: string;
  }) => {
    try {
      const response = await fetch('/api/swaps/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Antworten');
      }

      await fetchSwaps();
      return result.data;
    } catch (err) {
      console.error('Error responding to swap:', err);
      throw err;
    }
  };

  const searchSwapPartners = async (date: string, employeeId: string) => {
    try {
      const params = new URLSearchParams({
        date,
        employeeId,
        excludeOwn: 'true',
      });

      const response = await fetch(`/api/swaps/search?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler bei der Suche');
      }

      return result;
    } catch (err) {
      console.error('Error searching swap partners:', err);
      throw err;
    }
  };

  return {
    swaps,
    isLoading,
    error,
    refetch: fetchSwaps,
    createSwapRequest,
    approveSwap,
    rejectSwap,
    cancelSwap,
    respondToSwap,
    searchSwapPartners,
  };
}
