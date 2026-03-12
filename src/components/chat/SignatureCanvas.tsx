'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  onChange?: (signatureData: string | null) => void;
  value?: string | null;
  disabled?: boolean;
  className?: string;
  backgroundColor?: string;
  penColor?: string;
  penWidth?: number;
}

export function SignatureCanvas({
  width = 600,
  height = 200,
  onChange,
  value,
  disabled = false,
  className = '',
  backgroundColor = '#ffffff',
  penColor = '#000000',
  penWidth = 2,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Setze den Canvas-Context für bessere Qualität
  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Handle High-DPI Displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Canvas-Style setzen
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    return { ctx, dpr, rect };
  }, []);

  // Initialisierung
  useEffect(() => {
    const result = getCanvasContext();
    if (!result) return;
    
    const { ctx, rect } = result;
    
    // Initial: Weißer Hintergrund
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Vor-Initialisierung mit bestehendem Wert
    if (value) {
      loadSignature(value);
    }
  }, [getCanvasContext, backgroundColor, value]);

  // Lade existierende Signatur
  const loadSignature = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      setHasSignature(true);
    };
    img.src = dataUrl;
  }, []);

  // Berechne Canvas-Koordinaten
  const getCanvasCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // Beginne Zeichnen
  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    event.preventDefault();
    const { x, y } = getCanvasCoordinates(event);
    
    lastPos.current = { x, y };
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
  }, [disabled, penColor, penWidth, getCanvasCoordinates]);

  // Zeichnen
  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    
    event.preventDefault();
    const { x, y } = getCanvasCoordinates(event);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPos.current) return;
    
    // Zeichne Linien-Segment
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastPos.current = { x, y };
    setHasSignature(true);
  }, [isDrawing, disabled, getCanvasCoordinates]);

  // Beende Zeichnen
  const endDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
    
    // Exportiere Signatur als Data-URL
    const canvas = canvasRef.current;
    if (canvas && hasSignature && onChange) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  }, [hasSignature, onChange]);

  // Lösche Signatur
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    setHasSignature(false);
    if (onChange) {
      onChange(null);
    }
  }, [backgroundColor, onChange]);

  // Exportiere als PNG
  const exportSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    
    return canvas.toDataURL('image/png');
  }, [hasSignature]);

  // Expose methods to parent via ref if needed
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).clearSignature = clearSignature;
      (containerRef.current as any).exportSignature = exportSignature;
    }
  }, [clearSignature, exportSignature]);

  return (
    <div ref={containerRef} className={`signature-canvas-wrapper ${className}`}>
      <div 
        className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
        style={{ 
          width: '100%', 
          maxWidth: width,
          height,
          backgroundColor,
          cursor: disabled ? 'not-allowed' : 'crosshair',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full touch-none ${disabled ? 'pointer-events-none' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          style={{ display: 'block' }}
        />
        
        {/* Placeholder Text (only shown when empty) */}
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">
              🖊️ Hier unterschreiben
            </span>
          </div>
        )}
      </div>
      
      {/* Controls */}
      {!disabled && (
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={clearSignature}
            disabled={!hasSignature}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 
                       border border-red-200 hover:border-red-300 rounded transition-colors"
          >
            🗑️ Löschen
          </button>
          
          <span className="text-xs text-gray-500">
            {hasSignature ? '✓ Signatur vorhanden' : 'Noch keine Signatur'}
          </span>
        </div>
      )}
    </div>
  );
}

export default SignatureCanvas;
