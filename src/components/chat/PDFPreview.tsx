'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PDFPreviewProps {
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  width?: number | string;
  height?: number | string;
  pageNumber?: number;
  className?: string;
  showToolbar?: boolean;
  onPageChange?: (page: number) => void;
}

export function PDFPreview({
  filePath,
  fileUrl,
  fileName,
  width = '100%',
  height = 400,
  pageNumber,
  className = '',
  showToolbar = false,
  onPageChange,
}: PDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Konfiguriere Default Layout Plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      fullScreenPlugin: {
        enableShortcuts: false,
      },
    },
  });

  // Lade PDF-Datei
  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let url = fileUrl;
        
        if (!url && filePath) {
          // Konstruiere URL aus Pfad
          url = `/api/documents/preview?path=${encodeURIComponent(filePath)}`;
        }

        if (!url) {
          setError('Keine PDF-URL verfügbar');
          setIsLoading(false);
          return;
        }

        // Prüfe, ob PDF zugänglich ist
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error('PDF nicht gefunden oder Zugriff verweigert');
        }

        setPdfUrl(url);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Fehler beim Laden der PDF-Vorschau');
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [filePath, fileUrl]);

  // Erstelle ein vereinfachtes Preview (ohne Toolbar)
  const renderSimpleViewer = useCallback(() => {
    if (!pdfUrl) return null;

    return (
      <div 
        className={`pdf-preview-content ${className}`}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <div className="rpv-core__viewer" style={{ height: '100%' }}>
            <Viewer
              fileUrl={pdfUrl}
              plugins={showToolbar ? [defaultLayoutPluginInstance] : []}
              initialPage={pageNumber ? pageNumber - 1 : 0}
              defaultScale={SpecialZoomLevel.PageFit}
              onPageChange={(e) => {
                if (onPageChange) {
                  onPageChange(e.currentPage + 1);
                }
              }}
            />
          </div>
        </Worker>
      </div>
    );
  }, [pdfUrl, pageNumber, className, height, showToolbar, defaultLayoutPluginInstance, onPageChange]);

  // Loading State
  if (isLoading) {
    return (
      <div 
        className={`pdf-preview-loading flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ 
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">PDF wird geladen...​</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div 
        className={`pdf-preview-error flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4 ${className}`}
        style={{ 
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
        }}
      >
        <svg 
          className="w-12 h-12 text-gray-400 mb-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
        <p className="text-sm text-gray-500 text-center mb-2">{error}</p>
        {fileName && (
          <p className="text-xs text-gray-400">{fileName}</p>
        )}
      </div>
    );
  }

  // PDF Viewer
  return (
    <div className={`pdf-preview-container border rounded-lg overflow-hidden ${className}`}>
      {fileName && (
        <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
          <div className="flex items-center">
            <svg 
              className="w-4 h-4 text-red-500 mr-2" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" 
                clipRule="evenodd" 
              />
            </svg>
            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
              {fileName}
            </span>
          </div>
          <a
            href={pdfUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Original öffnen ↗
          </a>
        </div>
      )}
      <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        {renderSimpleViewer()}
      </div>
    </div>
  );
}

// Einfache PDF Card für Chat-Einbettung
export function PDFPreviewCard({ 
  fileName, 
  filePath, 
  fileSize,
  onClick 
}: { 
  fileName: string; 
  filePath?: string;
  fileSize?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`pdf-card flex items-center p-3 bg-white border rounded-lg shadow-sm 
                  hover:shadow-md transition-shadow cursor-pointer ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path 
            fillRule="evenodd" 
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" 
            clipRule="evenodd" 
          />
        </svg>
      </div>
      
      <div className="ml-3 flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {fileName}
        </p>
        {fileSize &c (
          <p className="text-xs text-gray-500">
            {fileSize}
          </p>
        )}
      </div>
      
      <div className="ml-3">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

export default PDFPreview;
