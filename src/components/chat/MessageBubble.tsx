'use client';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CheckCheck, Edit2, Trash2, FileSignature, ChevronRight, Download, FileText, Image as ImageIcon, File, X, ZoomIn, ChevronDown, CornerUpLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage } from '@/types/chat';
import { clsx } from 'clsx';
import { TranslationButton } from './ai-features/TranslationButton';
import { MessageContent } from './MessageContent';

interface MessageBubbleProps {
  message: ChatMessage;
  showAvatar?: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onSignatureClick?: (requestId: string) => void;
  onReplyClick?: (messageId: string) => void;
  onContextMenu?: (e: React.MouseEvent, message: ChatMessage) => void;
}

interface AttachmentPreviewProps {
  attachment: NonNullable<ChatMessage['attachments']>[number];
  isOwn: boolean;
}

function AttachmentPreview({ attachment, isOwn }: AttachmentPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isImage = attachment.mimeType?.startsWith('image/') || attachment.type === 'image';

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (isImage) return ImageIcon;
    if (attachment.mimeType?.includes('pdf')) return FileText;
    if (attachment.mimeType?.includes('word') || attachment.mimeType?.includes('document')) return FileText;
    if (attachment.mimeType?.includes('excel') || attachment.mimeType?.includes('sheet')) return FileText;
    return File;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isImage) {
    return (
      <div className="mt-2">
        <div 
          className={clsx(
            'relative group cursor-pointer overflow-hidden rounded-lg',
            'bg-gray-50 dark:bg-gray-800'
          )}
          onClick={() => setIsPreviewOpen(true)}
        >
          <img
            src={attachment.thumbnailPath || attachment.url}
            alt={attachment.name}
            className="max-w-full max-h-[300px] object-contain rounded-lg"
            loading="lazy"
          />
          <div className={clsx(
            'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
            'bg-black/30 rounded-lg'
          )}>
            <ZoomIn className="w-8 h-8 text-white" />
          </div>
          <div className={clsx(
            'absolute bottom-0 left-0 right-0 px-2 py-1',
            'bg-gradient-to-t from-black/60 to-transparent',
            'text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity'
          )}>
            {formatFileSize(attachment.size)}
          </div>
        </div>

        {/* Image Preview Modal */}
        {isPreviewOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setIsPreviewOpen(false)}
          >
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-w-full max-h-[85vh] object-contain"
              />
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-gray-900 hover:bg-gray-100"
                >
                  <Download className="w-4 h-4" />
                  <span>Herunterladen</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // File (non-image) attachment
  const Icon = getFileIcon();
  const fileColor = isOwn ? 'text-white' : 'text-gray-600 dark:text-gray-300';
  const fileBgColor = isOwn 
    ? 'bg-white/10 hover:bg-white/20' 
    : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600';

  return (
    <div className="mt-2">
      <button
        onClick={handleDownload}
        className={clsx(
          'flex items-center gap-3 w-full max-w-[280px] p-3 rounded-lg transition-colors text-left',
          fileBgColor
        )}
      >
        <div className={clsx(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          isOwn ? 'bg-white/20' : 'bg-primary-100 dark:bg-primary-900'
        )}>
          <Icon className={clsx(
            'w-5 h-5',
            isOwn ? 'text-white' : 'text-primary-600 dark:text-primary-400'
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={clsx(
            'text-sm font-medium truncate',
            isOwn ? 'text-white' : 'text-gray-900 dark:text-gray-100'
          )}>
            {attachment.name}
          </p>
          <p className={clsx(
            'text-xs',
            isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
          )}>
            {formatFileSize(attachment.size)}
          </p>
        </div>

        <Download className={clsx(
          'w-4 h-4 flex-shrink-0',
          isOwn ? 'text-white/70' : 'text-gray-400'
        )} />
      </button>
    </div>
  );
}

export function MessageBubble({ message, showAvatar = true, onEdit, onDelete, onSignatureClick, onReplyClick, onContextMenu }: MessageBubbleProps) {
  const { data: session } = useSession();
  const isOwn = message.senderId === session?.user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  
  // Dropdown menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // Handle context menu (right click) - deprecated, but keep for compatibility
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e, message);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Long press handlers for mobile
  const handleTouchStart = useCallback(() => {
    setIsLongPress(false);
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setIsMenuOpen(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMenuAction = (action: 'reply' | 'edit' | 'delete') => {
    setIsMenuOpen(false);
    
    switch (action) {
      case 'reply':
        onReplyClick?.(message.id);
        break;
      case 'edit':
        if (isOwn) setIsEditing(true);
        break;
      case 'delete':
        if (isOwn) onDelete?.(message.id);
        break;
    }
  };

  // Parse Signature Links from content
  const signatureLinkMatch = message.content.match(/\[Zur Signatur\]\(\/sign\/([a-zA-Z0-9]+)\)/);
  const hasSignatureLink = !!signatureLinkMatch;
  const signatureRequestId = signatureLinkMatch?.[1];

  const handleSignatureClick = () => {
    if (signatureRequestId && onSignatureClick) {
      onSignatureClick(signatureRequestId);
    }
  };

  const handleEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  // Check if message has any visible content
  const hasContent = message.content && message.content.trim().length > 0 && !message.content.match(/^\[Zur Signatur\]\(\/sign\/[^)]+\)$/);
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasReply = message.replyTo && message.replyToId;

  // Get reply preview text (max 2 lines)
  const getReplyPreview = (content: string) => {
    if (!content) return '';
    // Remove markdown and limit to reasonable length for preview
    return content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 100);
  };

  return (
    <div
      className={clsx(
        'flex gap-3 mb-4 group/message',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isMenuOpen) setIsMenuOpen(false);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setIsMenuOpen(true);
      }}
    >
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300">
            {message.sender?.name?.charAt(0).toUpperCase() || '?'}
          </div>
        </div>
      )}
      
      {/* Message Content */}
      <div className={clsx('flex max-w-[70%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender Name */}
        {!isOwn && showAvatar && (
          <span className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            {message.sender?.name || 'Unbekannt'}
          </span>
        )}
        
        {/* Message Bubble */}
        <div
          className={clsx(
            'relative rounded-2xl px-4 py-2 min-w-0 group/bubble',
            isOwn
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
          )}
          style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
        >
          {/* Chevron Dropdown Button - WhatsApp Style */}
          {!isEditing && (
            <div
              className={clsx(
                'absolute top-1 z-10 opacity-70 hover:opacity-100 transition-opacity duration-200',
                isOwn ? 'left-1' : 'right-1'
              )}
            >
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={clsx(
                  'p-1 rounded-full transition-colors',
                  isOwn
                    ? 'text-white/60 hover:text-white hover:bg-white/20'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div
                  ref={menuRef}
                  className={clsx(
                    'absolute top-full mt-1 min-w-[140px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50',
                    isOwn ? 'left-0' : 'right-0'
                  )}
                >
                  {/* Reply Option */}
                  <button
                    onClick={() => handleMenuAction('reply')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                    <span>Antworten</span>
                  </button>

                  {/* Edit Option - Only for own messages */}
                  {isOwn && (
                    <button
                      onClick={() => handleMenuAction('edit')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Bearbeiten</span>
                    </button>
                  )}

                  {/* Delete Option - Only for own messages */}
                  {isOwn && onDelete && (
                    <button
                      onClick={() => handleMenuAction('delete')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Löschen</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {isEditing ? (
            <div className="min-w-[200px]">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full resize-none rounded bg-white/10 border-0 px-2 py-1 text-sm focus:ring-2 focus:ring-white/50 dark:bg-gray-800 dark:text-white"
                rows={2}
                autoFocus
              />
              <div className="mt-1 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content);
                  }}
                  className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleEdit}
                  className="text-xs px-2 py-1 rounded bg-white text-primary-600 hover:bg-gray-100 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Reply Quote Box - WhatsApp Style */}
              {hasReply && (
                <button
                  onClick={() => onReplyClick?.(message.replyTo!.id)}
                  className={clsx(
                    'w-full text-left mb-2 rounded-lg overflow-hidden cursor-pointer transition-colors',
                    isOwn
                      ? 'bg-white/20 hover:bg-white/30'
                      : 'bg-gray-200/70 hover:bg-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-700/80'
                  )}
                >
                  {/* Colored left border */}
                  <div className="flex">
                    <div className={clsx(
                      'w-1 flex-shrink-0',
                      isOwn ? 'bg-primary-300' : 'bg-primary-500'
                    )} />
                    <div className="flex-1 px-2.5 py-1.5 min-w-0">
                      {/* Reply sender name */}
                      <p className={clsx(
                        'text-xs font-semibold truncate',
                        isOwn ? 'text-primary-100' : 'text-primary-600 dark:text-primary-400'
                      )}>
                        {message.replyTo?.sender?.name || 'Unbekannt'}
                      </p>
                      {/* Reply content preview - max 2 lines */}
                      <p className={clsx(
                        'text-xs line-clamp-2',
                        isOwn ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'
                      )}>
                        {getReplyPreview(message.replyTo?.content || '')}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {hasContent && (
                <MessageContent
                  content={message.content.replace(/\[Zur Signatur\]\(\/sign\/[a-zA-Z0-9]+\)/g, '')}
                  isOwn={isOwn}
                  currentUserId={session?.user?.id}
                />
              )}
              
              {/* Signature Link Button */}
              {hasSignatureLink && signatureRequestId && (
                <button
                  onClick={handleSignatureClick}
                  className="mt-2 flex items-center bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors text-sm dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800"
                >
                  <FileSignature className="w-4 h-4 mr-2" />
                  <span>Zum Signieren</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              )}
              
              {/* Attachments */}
              {hasAttachments && (
                <div className={clsx(hasContent && "mt-2")}>
                  {message.attachments?.map((attachment) => (
                    <AttachmentPreview
                      key={attachment.id}
                      attachment={attachment}
                      isOwn={isOwn}
                    />
                  ))}
                </div>
              )}
              
              {/* Translation Button */}
              {<TranslationButton text={message.content} />}
              
              {/* Status und Zeit */}
              <div className={clsx(
                'mt-1 flex items-center gap-1',
                (hasAttachments || hasSignatureLink) && !isEditing && 'pt-1 border-t',
                isOwn 
                  ? 'border-primary-500/30' 
                  : 'border-gray-200/50 dark:border-gray-600/50'
              )}>
                <span className={clsx('text-[10px]', isOwn ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500')}>
                  {format(new Date(message.createdAt), 'HH:mm', { locale: de })}
                </span>
                {isOwn && (
                  <>
                    {message.isEdited && (
                      <span className={clsx('text-[10px]', isOwn ? 'text-primary-200' : 'text-gray-400')} >
                        · Bearbeitet
                      </span>
                    )}
                    <CheckCheck className="h-3 w-3 text-primary-200" />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
