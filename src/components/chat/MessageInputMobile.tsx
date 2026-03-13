'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Plus, Mic, Image, FileText, File, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface FileAttachment {
  file: File;
  preview?: string;
  uploading?: boolean;
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

interface MessageInputMobileProps {
  roomId: string;
  onSend: (content: string, attachments?: UploadResult[]) => void;
  onTyping?: (isTyping: boolean) => void;
  onCommand?: (command: string, args: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isOffline?: boolean;
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

export function MessageInputMobile({ 
  roomId,
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
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Cleanup object URLs
      attachments.forEach(att => {
        if (att.preview) URL.revokeObjectURL(att.preview);
      });
    };
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `${file.name} ist zu groß (max. 10MB)` };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Nicht unterstützte Datei' };
    }
    return { valid: true };
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
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
      if (file.type.startsWith('image/')) {
        attachment.preview = URL.createObjectURL(file);
      }
      newAttachments.push(attachment);
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    setShowAttachmentMenu(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const attachment = prev[index];
      if (attachment.preview) URL.revokeObjectURL(attachment.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async (): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      if (!attachment.file) continue;

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
          throw new Error(error.error || 'Upload failed');
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
    setContent(newContent);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
    
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
    }
  };

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    
    if ((!trimmedContent && attachments.length === 0) || disabled) return;
    
    if (trimmedContent.startsWith('/') && onCommand) {
      const parts = trimmedContent.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).filter(Boolean);
      onCommand(command, args);
      setContent('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    let uploadedAttachments: UploadResult[] = [];
    if (attachments.length > 0) {
      try {
        uploadedAttachments = await uploadFiles();
      } catch (error) {
        setUploadError('Upload fehlgeschlagen');
        return;
      }
    }
    
    onSend(trimmedContent, uploadedAttachments);
    setContent('');
    setAttachments([]);
    setUploadError(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  }, [content, attachments, disabled, onSend, onTyping, onCommand, roomId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled = disabled || (!content.trim() && attachments.length === 0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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

      {/* Error */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        </div>
      )}

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachments.map((att, index) => (
              <div 
                key={index}
                className="relative flex-shrink-0 w-16 h-16 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 overflow-hidden"
              >
                {att.preview ? (
                  <img src={att.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <File className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                {att.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
                {!att.uploading && (
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/50 text-[8px] text-white text-center truncate">
                  {formatFileSize(att.file.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-3 py-3">
        <div className="flex items-end gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            multiple
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
          />

          {/* Attachment Button */}
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
                  <button 
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                  >
                    <Image className="h-5 w-5 text-primary-600" />
                    <span className="text-gray-900 dark:text-white">Bild</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = ALLOWED_TYPES.join(',');
                        fileInputRef.current.click();
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                  >
                    <FileText className="h-5 w-5 text-primary-600" />
                    <span className="text-gray-900 dark:text-white">Dokument</span>
                  </button>
                </div>
              </>
            )}
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
              placeholder={isOffline ? 'Offline...' : placeholder}
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
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Send Button */}
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

      {/* Safe Area */}
      <div className="h-safe-area-inset-bottom" />
    </div>
  );
}
