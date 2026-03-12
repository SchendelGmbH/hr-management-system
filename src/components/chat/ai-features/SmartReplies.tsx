'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface SmartRepliesProps {
  roomId: string;
  onSelectReply: (reply: string) => void;
  disabled?: boolean;
}

export function SmartReplies({ roomId, onSelectReply, disabled }: SmartRepliesProps) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    const delay = setTimeout(() => {
      fetchSmartReplies();
    }, 1000);

    return () => clearTimeout(delay);
  }, [roomId]);

  const fetchSmartReplies = async () => {
    if (!roomId) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/ai/smart-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      if (data.replies && data.replies.length > 0) {
        setReplies(data.replies.slice(0, 3));
      } else {
        setReplies([]);
      }
    } catch (err) {
      console.error('Smart replies error:', err);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  };

  if (replies.length === 0 && !loading) return null;

  return (
    <div className='flex items-center gap-2 px-4 py-2 bg-gray-50 border-t'>
      <div className='flex items-center gap-1 text-xs text-gray-500'>
        <Sparkles className='h-3 w-3 text-primary-600' />
        <span>Vorschläge:</span>
      </div>
      
      {loading ? (
        <Loader2 className='h-4 w-4 animate-spin text-primary-600' />
      ) : (
        <div className='flex gap-2'>
          {replies.map((reply, index) => (
            <button
              key={index}
              onClick={() => onSelectReply(reply)}
              disabled={disabled}
              className='px-3 py-1 text-xs bg-white border border-gray-200 rounded-full 
                         text-gray-700 hover:bg-primary-50 hover:border-primary-300
                         hover:text-primary-700 transition-colors truncate max-w-[150px]'
              title={reply}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}