'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SignatureCanvas } from './SignatureCanvas';
// PDF Preview temporarily disabled due to version compatibility issues
// import { PDFPreview, PDFPreviewCard } from './PDFPreview';
import { useRouter } from 'next/navigation';

interface SignatureRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'SIGNED' | 'REJECTED' | 'CANCELLED';
  title: string;
  message?: string;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
    employee?: {
      firstName: string;
      lastName: string;
    };
  };
  document?: {
    id: string;
    title: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
  };
  signatures: {
    id: string;
    signer: {
      id: string;
      employee?: {
        firstName: string;
        lastName: string;
      };
      username: string;
    };
    signedAt: string;
  }[];
}

interface SignatureModalProps {
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  onSigned?: () => void;
}

export function SignatureModal({ 
  requestId, 
  isOpen, 
  onClose, 
  onSigned 
}: SignatureModalProps) {
  const router = useRouter();
  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Lade Signatur-Anfrage
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const loadRequest = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/signatures/${requestId}`);
        if (!response.ok) {
          throw new Error('Fehler beim Laden der Signatur-Anfrage');
        }

        const data = await response.json();
        setRequest(data.request);
      } catch (err) {
        console.error('Error loading signature request:', err);
        setError('Konnte Signatur-Anfrage nicht laden');
      } finally {
        setIsLoading(false);
      }
    };

    loadRequest();
  }, [isOpen, requestId]);

  // Speichere Signatur
  const handleSign = useCallback(async () => {
    if (!signatureData) {
      setError('Bitte unterschreibe zuerst');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/signatures/${requestId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          pageNumber: 1,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Speichern der Signatur');
      }

      onSigned?.();
      onClose();
      router.refresh();
    } catch (err: any) {
      console.error('Error signing document:', err);
      setError(err.message || 'Fehler beim Signieren');
    } finally {
      setIsSubmitting(false);
    }
  }, [signatureData, requestId, onSigned, onClose, router]);

  // Genehmige Anfrage (zusätzlicher Schritt im Workflow)
  const handleApprove = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/signatures/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (!response.ok) {
        throw new Error('Fehler bei der Genehmigung');
      }

      // Aktualisiere Request-Status
      setRequest(prev => prev ? { ...prev, status: 'APPROVED' } : null);
    } catch (err) {
      console.error('Error approving request:', err);
      setError('Fehler bei der Genehmigung');
    } finally {
      setIsSubmitting(false);
    }
  }, [requestId]);

  // Status-Badge
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
      SIGNED: 'bg-green-100 text-green-800 border-green-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const labels = {
      PENDING: '⏳ Ausstehend',
      APPROVED: '✅ Genehmigt',
      SIGNED: '✍️ Signiert',
      REJECTED: '❌ Abgelehnt',
      CANCELLED: '🚫 Storniert',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Dokument signieren
              </h3>
              <div className="mt-1">
                {request && <StatusBadge status={request.status} />}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error && !request ? (
            <div className="text-center py-8 text-red-600">
              {error}
            </div>
          ) : request ? (
            <div className="space-y-4">
              {/* Dokument Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{request.title}</h4>
                <p className="text-sm text-gray-600">{request.message}</p>
                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <span>Von: {request.createdBy.employee 
                    ? `${request.createdBy.employee.firstName} ${request.createdBy.employee.lastName}`
                    : request.createdBy.username
                  }</span>
                  <span className="mx-2">•</span>
                  <span>Am: {new Date(request.createdAt).toLocaleString('de-DE')}</span>
                </div>
              </div>

              {/* PDF Preview Card - temporarily disabled */}
              {request.document && request.document.fileName && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Dokument</h5>
                  <div className="p-3 bg-gray-100 rounded text-sm text-gray-600">
                    📄 {request.document.fileName} (Vorschau nicht verfügbar)
                  </div>
                  {/* 
                  <PDFPreviewCard
                    fileName={request.document.fileName}
                    filePath={request.document.filePath}
                    onClick={() => setShowPdfPreview(!showPdfPreview)}
                  />
                  
                  {showPdfPreview && request.document.filePath && (
                    <div className="mt-2">
                      <PDFPreview
                        filePath={request.document.filePath}
                        fileName={request.document.fileName}
                        height={300}
                        showToolbar={true}
                      />
                    </div>
                  )}
                  */}
                </div>
              )}

              {/* Signatur-Bereich (nur für SIGNER) */}
              {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                <div className="border-t pt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Ihre Unterschrift
                  </h5>
                  
                  <SignatureCanvas
                    width={550}
                    height={150}
                    onChange={setSignatureData}
                    penColor="#000000"
                    penWidth={2}
                  />
                  
                  {error && (
                    <p className="text-sm text-red-600 mt-2">{error}</p>
                  )}
                </div>
              )}

              {/* Bereits signiert */}
              {request.status === 'SIGNED' && request.signatures.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center text-green-800 mb-2">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path 
                        fillRule="evenodd" 
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                    <span className="font-medium">Bereits signiert</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Dieses Dokument wurde bereits von {request.signatures[0].signer.employee
                      ? `${request.signatures[0].signer.employee.firstName} ${request.signatures[0].signer.employee.lastName}`
                      : request.signatures[0].signer.username
                    } am {new Date(request.signatures[0].signedAt).toLocaleString('de-DE')} unterschrieben.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md 
                       hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          
          {request?.status === 'PENDING' && (
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="px-4 py-2 text-white bg-blue-600 rounded-md 
                         hover:bg-blue-700 disabled:bg-gray-400 transition-colors
                         flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Wird genehmigt...
                </>
              ) : (
                <>Genehmigen</>
              )}
            </button>
          )}
          
          {(request?.status === 'PENDING' || request?.status === 'APPROVED') && (
            <button
              onClick={handleSign}
              disabled={isSubmitting || !signatureData}
              className="px-4 py-2 text-white bg-green-600 rounded-md 
                         hover:bg-green-700 disabled:bg-gray-400 transition-colors
                         flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Wird signiert...
                </>
              ) : (
                <>Signieren</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SignatureModal;
