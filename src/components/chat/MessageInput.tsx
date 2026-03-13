'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, X, FileText, Image, File, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { MentionsDropdown } from './MentionsDropdown';

interface MentionUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'away';
}

interface FileAttachment {
  file: File;
  preview?: string;
  uploading?: boolean;
  uploadProgress?: number;
}

interface UploadResult {
  name: string;
  size: number;
  type: 'image' | 'file';
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

interface MessageInputProps {
  roomId: string;
  onSend: (content: string, attachments?: UploadResult[]) => void;
  onTyping?: (isTyping: boolean) => void;
  onCommand?: (command: string, args: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export function MessageInput({
  roomId,
  onSend,
  onTyping,
  onCommand,
  disabled = false,
  placeholder = 'Nachricht schreiben...'
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);

  // Mentions state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const mentionStartRef = useRef<number | null>(null);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `${file.name} ist zu groß (max. 10MB)` };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `${file.name} hat einen nicht unterstützten Dateityp` };
    }
    return { valid: true };
  };

  const handleFiles = (files: FileList | File[]) => {
    setUploadError(null);
    const filesArray = Array.from(files);
    const newAttachments: FileAttachment[] = [];

    for (const file of filesArray) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error!);
        continue;
      }

      const attachment: FileAttachment = { file };
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        attachment.preview = URL.createObjectURL(file);
      }
      
      newAttachments.push(attachment);
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const attachment = prev[index];
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async (): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      if (!attachment.file) continue;

      // Mark as uploading
      setAttachments(prev => prev.map((att, idx) => 
        idx === i ? { ...att, uploading: true } : att
      ));

      try {
        const formData = new FormData();
        formData.append('file', attachment.file);
        formData.append('roomId', roomId);

        const response = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Upload failed for ${attachment.file.name}`);
        }

        const data = await response.json();
        results.push(data.file);
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      } finally {
        setAttachments(prev => prev.map((att, idx) => 
          idx === i ? { ...att, uploading: false } : att
        ));
      }
    }

    return results;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const caretPosition = e.target.selectionStart || 0;
    setContent(newContent);
    setCursorPosition(caretPosition);

    // Check for mentions - detect @ followed by text
    const textBeforeCaret = newContent.slice(0, caretPosition);
    const mentionMatch = textBeforeCaret.match(/@([^\s]*)$/);

    if (mentionMatch) {
      // Calculate position for dropdown
      const textareaRect = textareaRef.current?.getBoundingClientRect();
      if (textareaRect) {
        // Create a temporary element to measure text
        const span = document.createElement('span');
        span.style.cssText = window.getComputedStyle(textareaRef.current!);
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.style.whiteSpace = 'pre-wrap';
        span.style.wordWrap = 'break-word';
        span.textContent = textBeforeCaret.slice(0, -mentionMatch[0].length); // Text before @

        document.body.appendChild(span);
        const spanRect = span.getBoundingClientRect();
        document.body.removeChild(span);

        // Calculate relative position
        const lineHeight = parseInt(getComputedStyle(textareaRef.current!).lineHeight) || 20;
        const caretLine = textBeforeCaret.split('\n').length - 1;

        setMentionPosition({
          top: textareaRect.top - textareaRef.current!.scrollTop + (caretLine + 1) * lineHeight + 8,
          left: textareaRect.left + spanRect.width % textareaRect.width + 16
        });
      }

      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
      mentionStartRef.current = textBeforeCaret.length - mentionMatch[0].length + 1; // Position after @
    } else {
      setShowMentions(false);
      mentionStartRef.current = null;
    }

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

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    
    // Check if there's something to send
    if ((!trimmedContent && attachments.length === 0) || disabled) {
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
        setAttachments([]);
        
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      }
    }

    let uploadedAttachments: UploadResult[] = [];
    
    // Upload files if any
    if (attachments.length > 0) {
      try {
        uploadedAttachments = await uploadFiles();
      } catch (error) {
        setUploadError('Fehler beim Hochladen der Dateien. Bitte versuche es erneut.');
        return;
      }
    }
    
    onSend(trimmedContent, uploadedAttachments);
    setContent('');
    setAttachments([]);
    setUploadError(null);
    
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
  }, [content, attachments, disabled, onSend, onTyping, onCommand, roomId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't trigger send if mentions dropdown is open
    if (showMentions && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape' || e.key === 'Tab')) {
      // Let the mentions dropdown handle these keys
      if (e.key === 'Tab') {
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMentionSelect = (user: MentionUser) => {
    if (mentionStartRef.current === null) return;

    const beforeMention = content.slice(0, mentionStartRef.current);
    const afterMention = content.slice(cursorPosition);

    // Create mention text format: @username (userId)
    const mentionText = `@${user.name} `;
    const newContent = beforeMention + mentionText + afterMention;

    setContent(newContent);
    setShowMentions(false);
    setMentionQuery('');

    // Restore focus and set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = mentionStartRef.current! + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        setCursorPosition(newPosition);
      }
    }, 0);

    mentionStartRef.current = null;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the container, not entering a child
    if (e.relatedTarget && !dragAreaRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const isSendDisabled = disabled || (!content.trim() && attachments.length === 0);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.includes('pdf')) return FileText;
    if (fileType.includes('word') || fileType.includes('document')) return FileText;
    if (fileType.includes('excel') || fileType.includes('sheet')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div 
      ref={dragAreaRef}
      className={clsx(
        'border-t bg-white dark:bg-gray-900 dark:border-gray-700',
        isFocused && 'ring-1 ring-inset ring-primary-200 dark:ring-primary-800'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary-500/10 border-2 border-dashed border-primary-500 m-2 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-primary-700 dark:text-primary-300">
              Dateien hier ablegen
            </p>
            <p className="text-sm text-primary-600 dark:text-primary-400">
              Max. 10MB pro Datei
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap gap-2">
            {attachments.map((att, index) => {
              const Icon = getFileIcon(att.file.type);
              return (
                <div 
                  key={index} 
                  className={clsx(
                    'relative group flex items-center gap-2 px-3 py-2 rounded-lg border',
                    'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600',
                    'max-w-[200px]'
                  )}
                >
                  {att.preview ? (
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <img 
                        src={att.preview} 
                        alt={att.file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                      {att.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <Icon className="w-8 h-8 text-gray-400 flex-shrink-0" />
                      {att.uploading && (
                        <div className="absolute -inset-1 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center rounded">
                          <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {att.file.name}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {formatFileSize(att.file.size)}
                    </p>
                  </div>
                  {!att.uploading && (
                    <button
                      onClick={() => removeAttachment(index)}
                      className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-2">
          {/* File attachment button */}
          <div className="flex-shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              multiple
              accept={ALLOWED_TYPES.join(',')}
              className="hidden"
              disabled={disabled}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={clsx(
                'rounded-full p-2.5 transition-colors',
                disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
              )}
              title="Datei anhängen"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </div>
          
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
              onBlur={() => {
                // Delay hiding mentions to allow clicking on dropdown
                setTimeout(() => setIsFocused(false), 200);
              }}
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

            {/* Mentions Dropdown */}
            {showMentions && !disabled && (
              <MentionsDropdown
                roomId={roomId}
                query={mentionQuery}
                position={mentionPosition}
                onSelect={handleMentionSelect}
                onClose={() => {
                  setShowMentions(false);
                  setMentionQuery('');
                  mentionStartRef.current = null;
                }}
              />
            )}
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
            Enter zum Senden · Shift+Enter für neue Zeile · @ zum Erwähnen · Drag & Drop für Dateien
          </span>
        </div>
      </div>
    </div>
  );
}
