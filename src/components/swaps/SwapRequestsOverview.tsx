/**
 * SwapRequestsOverview - Übersicht aller Tauschanfragen
 * Zeigt gesendete und empfangene Anfragen mit Status
 */
'use client';

import { useState } from 'react';
import { 
  ArrowLeftRight,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useShiftSwaps } from '@/hooks/useShiftSwaps';
import { format, parseISO, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import clsx from 'clsx';

interface SwapRequestsOverviewProps {
  employeeId: string;
}

type TabType = 'sent' | 'received' | 'all';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

const statusConfig = {
  PENDING: {
    label: 'Ausstehend',
    color: 'amber',
    icon: Clock,
  },
  APPROVED: {
    label: 'Genehmigt',
    color: 'emerald',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Abgelehnt',
    color: 'red',
    icon: XCircle,
  },
  COMPLETED: {
    label: 'Abgeschlossen',
    color: 'blue',
    icon: CheckCircle,
  },
  CANCELLED: {
    label: 'Storniert',
    color: 'gray',
    icon: XCircle,
  },
};

export function SwapRequestsOverview({ employeeId }: SwapRequestsOverviewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { swaps, isLoading, error, approveSwap, rejectSwap, cancelSwap } = useShiftSwaps({
    employeeId,
    type: activeTab,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const handleApprove = async (swapId: string, responseId?: string) => {
    try {
      await approveSwap(swapId, responseId);
    } catch (err) {
      console.error('Fehler beim Genehmigen:', err);
    }
  };

  const handleReject = async (swapId: string, responseId?: string) => {
    try {
      await rejectSwap(swapId, responseId);
    } catch (err) {
      console.error('Fehler beim Ablehnen:', err);
    }
  };

  const handleCancel = async (swapId: string) => {
    try {
      await cancelSwap(swapId);
    } catch (err) {
      console.error('Fehler beim Stornieren:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Fehler beim Laden: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex">
            {(['all', 'sent', 'received'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab === 'all' && 'Alle Anfragen'}
                {tab === 'sent' && 'Gesendet'}
                {tab === 'received' && 'Empfangen'}
                <span className={clsx(
                  'ml-2 px-2 py-0.5 rounded-full text-xs',
                  activeTab === tab
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600'
                )}>
                  {tab === 'all' && swaps.length}
                  {tab === 'sent' && swaps.filter(s => s.requesterId === employeeId).length}
                  {tab === 'received' && swaps.filter(s => s.requestedEmployeeId === employeeId).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 mr-2">Status:</span>
          {(['all', 'PENDING', 'APPROVED', 'COMPLETED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === status
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status === 'all' && 'Alle'}
              {status !== 'all' && statusConfig[status]?.label}
            </button>
          ))}
        </div>

        {/* Swap List */}
        <div className="divide-y divide-gray-200">
          {swaps.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Keine Tauschanfragen
              </h3>
              <p className="text-gray-500">
                Sie haben noch keine Schichttausche beantragt oder erhalten.
              </p>
            </div>
          ) : (
            swaps.map((swap) => {
              const isExpanded = expandedId === swap.id;
              const status = statusConfig[swap.status] || statusConfig.PENDING;
              const StatusIcon = status.icon;
              const isRequester = swap.requesterId === employeeId;
              const otherPerson = isRequester ? swap.requested : swap.requester;

              return (
                <div
                  key={swap.id}
                  className={clsx(
                    'p-4 transition-colors hover:bg-gray-50',
                    isExpanded && 'bg-gray-50'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      `bg-${status.color}-100 text-${status.color}-600`
                    )}>
                      <StatusIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {isRequester ? (
                              <>
                                Schichttausch mit{' '}
                                <span className="text-indigo-600">
                                  {otherPerson?.firstName} {otherPerson?.lastName}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-indigo-600">
                                  {swap.requester?.firstName} {swap.requester?.lastName}
                                </span>{' '}
                                möchte tauschen
                              </>
                            )}
                          </p>
                          
                          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                            <span>
                              {format(parseISO(swap.requesterDate), 'dd. MMMM yyyy', { locale: de })}
                            </span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span className={`text-${status.color}-600 font-medium`}>
                              {status.label}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : swap.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          {/* Details */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-gray-100 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">
                                Ihre Schicht
                              </p>
                              <p className="font-medium text-gray-900">
                                {swap.requesterShift?.site?.name || 'Unbekannt'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {swap.requesterStartTime} - {swap.requesterEndTime}
                              </p>
                            </div>

                            <div className="bg-indigo-50 rounded-lg p-3">
                              <p className="text-xs text-indigo-600 mb-1">
                                {isRequester ? 'Ziel' : 'Angebot'}
                              </p>
                              <p className="font-medium text-gray-900">
                                {otherPerson?.firstName} {otherPerson?.lastName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {otherPerson?.department?.name}
                              </p>
                            </div>
                          </div>

                          {/* Note */}
                          {swap.note && (
                            <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                              <p className="text-xs text-amber-700 mb-1">Nachricht:</p>
                              <p className="text-sm text-gray-700">{swap.note}</p>
                            </div>
                          )}

                          {/* Actions */}
                          {swap.status === 'PENDING' && (
                            <div className="flex gap-3">
                              {!isRequester && (
                                <>
                                  <button
                                    onClick={() => handleApprove(swap.id)}
                                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4" /
                                    <span>Genehmigen</span>
                                  </button>
                                  <button
                                    onClick={() => handleReject(swap.id)}
                                    className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <XCircle className="w-4 h-4" /
                                    <span>Ablehnen</span>
                                  </button>
                                </>
                              )}
                              {isRequester && (
                                <button
                                  onClick={() => handleCancel(swap.id)}
                                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                  Anfrage stornieren
                                </button>
                              )}
                            </div>
                          )}

                          {/* Approved Info */}
                          {swap.status === 'APPROVED' && swap.approvedByUser && (
                            <div className="p-3 bg-emerald-50 rounded-lg flex items-center gap-2 text-emerald-700">
                              <CheckCircle className="w-5 h-5 flex-shrink-0" />
                              <p className="text-sm">
                                Genehmigt von {swap.approvedByUser.username}
                                {swap.approvedAt && (
                                  <> am {format(parseISO(swap.approvedAt), 'dd.MM.yyyy HH:mm')}</>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
