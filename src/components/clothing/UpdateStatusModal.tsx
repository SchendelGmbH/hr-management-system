'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Package, CheckCircle, XCircle } from 'lucide-react';

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order: {
    id: string;
    status: 'ORDERED' | 'DELIVERED' | 'RETURNED';
    totalAmount: number;
    employee: {
      firstName: string;
      lastName: string;
      remainingBudget: number;
    };
  };
}

export default function UpdateStatusModal({
  isOpen,
  onClose,
  onSuccess,
  order,
}: UpdateStatusModalProps) {
  const [newStatus, setNewStatus] = useState<'ORDERED' | 'DELIVERED' | 'RETURNED'>(order.status);
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newStatus === order.status) {
      alert('Bitte wählen Sie einen anderen Status.');
      return;
    }

    setUpdating(true);

    try {
      const response = await fetch(`/api/clothing/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.details || 'Update failed');
      }

      const result = await response.json();
      alert(result.message);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      alert(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setUpdating(false);
    }
  };

  const getBudgetImpact = () => {
    if (order.status === 'ORDERED' && newStatus === 'DELIVERED') {
      return { change: -order.totalAmount, text: 'Budget wird abgezogen' };
    }
    if (order.status === 'DELIVERED' && newStatus === 'RETURNED') {
      return { change: order.totalAmount, text: 'Budget wird zurückgegeben' };
    }
    return { change: 0, text: 'Keine Budget-Änderung' };
  };

  const budgetImpact = getBudgetImpact();
  const newBudget = order.employee.remainingBudget + budgetImpact.change;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bestellstatus ändern">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Status */}
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Aktueller Status:</p>
          <p className="text-lg font-semibold text-gray-900">
            {order.status === 'ORDERED' && '📦 Bestellt'}
            {order.status === 'DELIVERED' && '✅ Geliefert'}
            {order.status === 'RETURNED' && '↩️ Retourniert'}
          </p>
        </div>

        {/* Employee Info */}
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm font-medium text-gray-900">
            Mitarbeiter: {order.employee.firstName} {order.employee.lastName}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Aktuelles Budget: {Number(order.employee.remainingBudget).toFixed(2)} €
          </p>
        </div>

        {/* New Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Neuer Status *</label>
          <select
            required
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as any)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="ORDERED">📦 Bestellt</option>
            <option value="DELIVERED">✅ Geliefert</option>
            <option value="RETURNED">↩️ Retourniert</option>
          </select>
        </div>

        {/* Budget Impact Warning */}
        {budgetImpact.change !== 0 && (
          <div
            className={`rounded-lg border p-4 ${
              budgetImpact.change < 0
                ? 'border-orange-200 bg-orange-50'
                : 'border-green-200 bg-green-50'
            }`}
          >
            <div className="flex items-start">
              {budgetImpact.change < 0 ? (
                <XCircle className="mr-2 h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{budgetImpact.text}</p>
                <p className="mt-1 text-sm text-gray-600">
                  Betrag: {Math.abs(budgetImpact.change).toFixed(2)} €
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  Neues Budget: {newBudget.toFixed(2)} €
                </p>
                {newBudget < 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    ⚠️ Warnung: Budget wird negativ!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            placeholder="Optionale Notizen zu dieser Statusänderung..."
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={updating || newStatus === order.status}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? 'Wird aktualisiert...' : 'Status ändern'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
