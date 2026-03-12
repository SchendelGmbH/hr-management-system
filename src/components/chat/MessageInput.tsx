'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { clsx } from 'clsx';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onCommand?: (command: string, args: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ 
  onSend, 
  onTyping, 
  onCommand,
  disabled = false,
  placeholder = 'Nachricht schreiben...'
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
    
    // Typing indicator
    if (onTyping) {
      onTyping(true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = useCallback(() => {
    const trimmedContent = content.trim();
    
    if (!trimmedContent || disabled) {
      return;
    }
    
    // Check for commands (e.g. /call)
    if (trimmedContent.startsWith('/')) {
      const parts = trimmedContent.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).filter(Boolean);
      
      if (onCommand) {
        onCommand(command, args);
        setContent('');
        
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      }
    }
    
    onSend(trimmedContent);
    setContent('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Clear typing indicator
    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [content, disabled, onSend, onTyping, onCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled = disabled || !content.trim();

  return (
    <div className={clsx(
      'border-t bg-white px-4 py-3 dark:bg-gray-900 dark:border-gray-700',
      isFocused && 'ring-1 ring-inset ring-primary-200 dark:ring-primary-800'
    )}>
      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* Commands hint */}
        <div className="flex-shrink-0">
          <button
            disabled={disabled}
            className={clsx(
              'rounded-full p-2 transition-colors',
              disabled
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
            )}
            title="Befehle: /call - Videoanruf starten"
          >
            <span className="text-lg font-bold">/</span>
          </button>
        </div>
        
        {/* Textarea */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={clsx(
              'w-full resize-none rounded-xl border-0 bg-gray-100 px-4 py-2.5',
              'text-sm text-gray-900 placeholder:text-gray-400',
              'focus:ring-2 focus:ring-inset focus:ring-primary-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-[120px] min-h-[40px]',
              'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500'
            )}
          />
        </div>
        
        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isSendDisabled}
          className={clsx(
            'flex-shrink-0 rounded-full p-2.5 transition-all',
            isSendDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
              : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md active:scale-95'
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      
      {/* Quick send hint */}
      <div className="mt-1 text-center">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Enter zum Senden · Shift+Enter für neue Zeile
        </span>
      </div>
    </div>
  );
}
