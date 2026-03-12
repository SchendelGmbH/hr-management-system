'use client';

import { useState } from 'react';
import { Languages, Loader2, X } from 'lucide-react';

interface TranslationButtonProps {
  messageId?: string;
  text: string;
  onTranslate?: (text: string, targetLang: 'de' | 'pl') => Promise<string>;
}

export function TranslationButton({ messageId, text, onTranslate }: TranslationButtonProps) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async (targetLang: 'de' | 'pl') => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setShowOptions(false);

    try {
      // Wenn onTranslate Prop vorhanden, nutze diese
      if (onTranslate) {
        const result = await onTranslate(text, targetLang);
        setTranslation(result);
        return;
      }

      // Sonst API-Call
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          targetLang,
          messageId 
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      setTranslation(data.translation);
    } catch (err) {
      console.error('Translation error:', err);
      setError('Übersetzung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const clearTranslation = () => {
    setTranslation(null);
    setError(null);
  };

  // Zeige Übersetzung an
  if (translation) {
    return (
      <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs text-blue-600 font-medium mb-1">Übersetzung:</p>
            <p className="text-sm text-gray-700">{translation}</p>
          </div>
          <button
            onClick={clearTranslation}
            className="p-1 text-blue-400 hover:text-blue-600 rounded"
            title="Übersetzung schließen"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // Zeige Fehler
  if (error) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <span className="text-xs text-red-500">{error}</span>
        <button
          onClick={() => setError(null)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Translation Button */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={loading}
        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 
                   transition-colors"
        title="Übersetzen"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Languages className="h-3 w-3" />
            <span>Übersetzen</span>
          </>
        )}
      </button>

      {/* Language Options */}
      {showOptions && (
        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 
                        rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
          <button
            onClick={() => handleTranslate('de')}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50
                       flex items-center gap-2"
          >
            <span>🇩🇪</span>
            <span>Auf Deutsch</span>
          </button>
          <button
            onClick={() => handleTranslate('pl')}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50
                       flex items-center gap-2"
          >
            <span>🇵🇱</span>
            <span>Na polski</span>
          </button>
        </div>
      )}
    </div>
  );
}
