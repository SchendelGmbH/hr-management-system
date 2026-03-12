'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { clsx } from 'clsx';

interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ 
  onSend, 
  onTyping, 
  disabled = false,
  placeholder = 'Nachricht schreiben...'
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    
    if ((!trimmedContent && attachments.length === 0) || disabled) {
      return;
    }
    
    onSend(trimmedContent, attachments.length > 0 ? attachments : undefined);
    setContent('');
    setAttachments([]);
    
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
  }, [content, attachments, disabled, onSend, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachments((prev) => [...prev, ...files].slice(0, 5)); // Max 5 attachments
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const isSendDisabled = disabled || (!content.trim() && attachments.length === 0);

  return (
    <div className={clsx(
      'border-t bg-white px-4 py-3',
      isFocused && 'ring-1 ring-inset ring-primary-200'
    )}>
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm"
            >
              <Paperclip className="h-4 w-4 text-gray-500" />
              <span className="max-w-[150px] truncate text-gray-700">{file.name}</span>
              <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= 5}
          className={clsx(
            'flex-shrink-0 rounded-full p-2 transition-colors',
            disabled || attachments.length >= 5
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          )}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
        />
        
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
              'w-full resize-none rounded-xl border-0 bg-gray-100 px-4 py-2.5 pr-10',
              'text-sm text-gray-900 placeholder:text-gray-400',
              'focus:ring-2 focus:ring-inset focus:ring-primary-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-[120px] min-h-[40px]'
            )}
          />
        </div>
        
        {/* Emoji Button */}
        <button
          disabled={disabled}
          className={clsx(
            'flex-shrink-0 rounded-full p-2 transition-colors',
            disabled
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          )}
        >
          <Smile className="h-5 w-5" />
        </button>
        
        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isSendDisabled}
          className={clsx(
            'flex-shrink-0 rounded-full p-2.5 transition-all',
            isSendDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md active:scale-95'
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      
      {/* Quick send hint */}
      <div className="mt-1 text-center">
        <span className="text-[10px] text-gray-400">
          Enter zum Senden · Shift+Enter für neue Zeile
        </span>
      </div>
    </div>
  );
}
