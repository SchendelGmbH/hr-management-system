'use client';

import { useState, useCallback } from 'react';
import { SignatureCanvas } from '@/components/chat/SignatureCanvas';
import { PDFPreview } from '@/components/chat/PDFPreview';
import { useRouter } from 'next/navigation';

interface SignatureParticipant {
  id: string;
  role: string;
  user: {
    id: string;
    username: string;
    employee?: {
      firstName: string;
      lastName: string;
    };
  };
}

interface Signature {
  id: string;
  signer: {
    id: string;
    username: string;
    employee?: {
      firstName: string;
      lastName: string;
    };
  };
  signedAt: string;
}

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
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  participants: SignatureParticipant[];
  signatures: Signature[];
}

interface SignatureClientProps {
  request: SignatureRequest;
}

export function SignatureClient({ request }: SignatureClientProps) {
  const router = useRouter();
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  const handleSign = useCallback(async () => {
    if (!signatureData) {
      setError('Bitte unterschreiben Sie zuerst');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/signatures/${request.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          pageNumber: 1,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Signieren');
      }

      router.refresh();
    } catch (err: any) {
      console.error('Error signing:', err);
      setError(err.message || 'Fehler beim Signieren');
    } finally {
      setIsSubmitting(false);
    }
  }, [signatureData, request.id, router]);

  const displayName = (user: { employee?: { firstName: string; lastName: string }; username: string }) => {
    return user.employee 
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : user.username;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      SIGNED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };

    const labels = {
      PENDING: 'Ausstehend',
      APPROVED: 'Genehmigt',
      SIGNED: 'Signiert',
      REJECTED: 'Abgelehnt',
      CANCELLED: 'Storniert',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const alreadySigned = request.status === 'SIGNED' && request.signatures.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Dokument signieren</h1>
            <StatusBadge status={request.status} />
          </div>
          
          <p className="text-lg text-gray-700 mb-2">{request.title}</p>
          {request.message && (
            <p className="text-gray-600">{request.message}</p>
          )}
          
          <div className="mt-4 text-sm text-gray-500">
            <span>Von: {displayName(request.createdBy)}</span>
            <span className="mx-2">•</span>
            <span>{new Date(request.createdAt).toLocaleString('de-DE')}</span>
          </div>
        </div>

        {/* Document Section */}
        {request.document && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Dokument</h2>
            
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path 
                    fillRule="evenodd" 
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{request.document.fileName || request.document.title}</p>
                <p className="text-sm text-gray-500">
                  {request.document.employee && 
                    `Mitarbeiter: ${request.document.employee.firstName} ${request.document.employee.lastName}`
                  }
                </p>
              </div>
              <button
                onClick={() => setShowPdf(!showPdf)}
                className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {showPdf ? 'Vorschau schließen' : 'Vorschau anzeigen'}
              </button>
            </div>
            
            {showPdf && request.document.filePath && (
              <div className="mt-4">
                <PDFPreview
                  filePath={request.document.filePath}
                  fileName={request.document.fileName}
                  height={500}
                  showToolbar={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Already Signed */}
        {alreadySigned && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center text-green-800 mb-2">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                  clipRule="evenodd" 
                />
              </svg>
              <span className="font-semibold">Bereits signiert!</span>
            </div>
            <p className="text-green-700">
              Dieses Dokument wurde bereits am {' '}
              {new Date(request.signatures[0].signedAt).toLocaleString('de-DE')} {' '}
              von {displayName(request.signatures[0].signer)} signiert.
            </p>
          </div>
        )}

        {/* Signature Canvas */}
        {!alreadySigned && request.status !== 'CANCELLED' && request.status !== 'REJECTED' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Ihre Unterschrift</h2>
            
            <SignatureCanvas
              width={700}
              height={200}
              onChange={setSignatureData}
              penColor="#000000"
              penWidth={2}
            />
            
            {error && (
              <p className="text-red-600 mt-4">{error}</p>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSign}
                disabled={isSubmitting || !signatureData}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium
                           hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                           transition-colors flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Wird signiert...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
                      />
                    </svg>
                    Dokument signieren
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
