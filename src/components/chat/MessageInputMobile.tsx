'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Plus, Mic, Image, Paperclip } from 'lucide-react';
import { clsx } from 'clsx';

interface MessageInputMobileProps {
  onSend: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onCommand?: (command: string, args: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isOffline?: boolean;
}

export function MessageInputMobile({ 
  onSend, 
  onTyping, 
  onCommand,
  disabled = false,
  placeholder = 'Nachricht schreiben...',
  isOffline = false,
}: MessageInputMobileProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
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
    
    // Auto-resize for mobile (kleiner max-height)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
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
    
    // Check for commands
    if (trimmedContent.startsWith('/')) {
      const parts = trimmedContent.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).filter(Boolean);
      
      if (onCommand) {
        onCommand(command, args);
        setContent('');
        
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      }
    }
    
    onSend(trimmedContent);
    setContent('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
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
      'border-t bg-white dark:bg-gray-900 dark:border-gray-700',
      isFocused && 'ring-1 ring-inset ring-primary-200 dark:ring-primary-800'
    )}>
      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2 dark:bg-amber-900/20 dark:border-amber-800">
          <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Offline - Nachrichten werden später gesendet
          </span>
        </div>
      )}

      {/* Input Area - Touch-optimiert */}
      <div className="px-3 py-3">
        <div className="flex items-end gap-2">
          {/* Attachment Button - Größer für Touch */}
          <div className="relative">
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              disabled={disabled || isOffline}
              className={clsx(
                'flex-shrink-0 rounded-full p-3 transition-colors',
                disabled || isOffline
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800',
                'touch-manipulation'
              )}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Plus className="h-6 w-6" strokeWidth={2} />
            </button>

            {/* Attachment Menu */}
            {showAttachmentMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowAttachmentMenu(false)} 
                />
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50 min-w-[180px]">
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left">
                    <Image className="h-5 w-5 text-primary-600" />
                    <span className="text-gray-900 dark:text-white">Bild</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left">
                    <Paperclip className="h-5 w-5 text-primary-600" />
                    <span className="text-gray-900 dark:text-white">Datei</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Textarea - Größere Touch-Ziele */}
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isOffline ? 'Offline - Wird später gesendet...' : placeholder}
              disabled={disabled}
              rows={1}
              className={clsx(
                'w-full resize-none rounded-2xl border-0 bg-gray-100 px-4 py-3.5',
                'text-base text-gray-900 placeholder:text-gray-500',
                'focus:ring-2 focus:ring-inset focus:ring-primary-500',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'max-h-[100px] min-h-[52px]',
                'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500'
              )}
              style={{ fontSize: '16px' }} // Verhindert Zoom auf iOS
            />
          </div>

          {/* Send Button - Größer für Touch */}
          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className={clsx(
              'flex-shrink-0 rounded-full p-3.5 transition-all duration-200',
              'min-h-[52px] min-w-[52px]',
              'active:scale-95',
              isSendDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg'
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Send className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Safe Area für iOS */}
      <div className="h-safe-area-inset-bottom" />
    </div>
  );
}
