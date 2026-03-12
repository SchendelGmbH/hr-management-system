/**
 * SwapModal - Modal für Tauschanfragen
 * Zeigt verfügbare Tauschpartner und erlaubt das Erstellen von Anfragen
 */
'use client';

import { useState, useEffect } from 'react';
import { 
  X,
  User,
  MapPin,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useShiftSwaps } from '@/hooks/useShiftSwaps';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  employeeId: string;
  date: Date;
  siteName: string;
  startTime: string;
  endTime: string;
}

interface AvailablePartner {
  assignment: {
    id: string;
    employeeId: string;
    note?: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNumber: string;
      department?: { name: string };
    };
    site: {
      name: string;
      location?: string;
      workSite?: { name: string };
    };
  };
  canSwap: boolean;
  existingSwapId: string | null;
}

export function SwapModal({
  isOpen,
  onClose,
  assignmentId,
  employeeId,
  date,
  siteName,
  startTime,
  endTime,
}: SwapModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [partners, setPartners] = useState<AvailablePartner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<AvailablePartner | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { searchSwapPartners, createSwapRequest } = useShiftSwaps();

  useEffect(() => {
    if (isOpen) {
      loadPartners();
    }
  }, [isOpen]);

  const loadPartners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await searchSwapPartners(
        date.toISOString().split('T')[0],
        employeeId
      );
      
      setPartners(result.availablePartners || []);
    } catch (err) {
      setError('Fehler beim Laden der Tauschpartner');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPartner) return;

    try {
      setIsLoading(true);
      setError(null);

      await createSwapRequest({
        requesterShiftId: assignmentId,
        requesterDate: date.toISOString(),
        requesterSiteId: siteName,
        requesterStartTime: startTime,
        requesterEndTime: endTime,
        requestedEmployeeId: selectedPartner.assignment.employeeId,
        requestedShiftId: selectedPartner.assignment.id,
        note: note || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen der Anfrage');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Schicht tauschen
              </h2>
              <p className="text-indigo-100 text-sm">
                {format(date, 'EEEE, d. MMMM yyyy', { locale: de })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                Anfrage gesendet!
              </h3>
              <p className="text-gray-500">
                Der Mitarbeiter wird benachrichtigt.
              </p>
            </div>
          ) : (
            <>
              {/* Eigene Schicht */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Ihre Schicht
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{siteName}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>{startTime} - {endTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tauschpartner */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Verfügbare Tauschpartner
                </h3>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : partners.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      Keine Tauschpartner verfügbar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {partners.map((partner) => (
                      <button
                        key={partner.assignment.id}
                        onClick={() => partner.canSwap && setSelectedPartner(partner)}
                        disabled={!partner.canSwap}
                        className={`
                          w-full text-left p-3 rounded-lg border transition-all
                          ${selectedPartner?.assignment.id === partner.assignment.id
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                            : partner.canSwap
                              ? 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                              : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                            {partner.assignment.employee.firstName[0]}
                            {partner.assignment.employee.lastName[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {partner.assignment.employee.firstName}{' '}
                              {partner.assignment.employee.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {partner.assignment.employee.department?.name || 'Keine Abteilung'} •{' '}
                              {partner.assignment.site.name}
                            </p>
                          </div>
                          {!partner.canSwap && partner.existingSwapId && (
                            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                              Anfrage ausstehend
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notiz */}
              {selectedPartner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nachricht (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Hallo, ich würde gerne tauschen..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedPartner || isLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Wird gesendet...' : 'Anfrage senden'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
