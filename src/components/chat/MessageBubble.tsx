'use client';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, CheckCheck, Edit2, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ChatMessage } from '@/types/chat';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  message: ChatMessage;
  showAvatar?: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

export function MessageBubble({ message, showAvatar = true, onEdit, onDelete }: MessageBubbleProps) {
  const { data: session } = useSession();
  const isOwn = message.senderId === session?.user?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

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

  return (
    <div
      className={clsx(
        'flex gap-3 mb-4',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
            {message.sender?.name?.charAt(0).toUpperCase() || '?'}
          </div>
        </div>
      )}
      
      {/* Message Content */}
      <div className={clsx('flex max-w-[70%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender Name */}
        {!isOwn && showAvatar && (
          <span className="mb-1 text-xs text-gray-500">
            {message.sender?.name || 'Unbekannt'}
          </span>
        )}
        
        {/* Message Bubble */}
        <div
          className={clsx(
            'relative rounded-2xl px-4 py-2',
            isOwn
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          )}
        >
          {isEditing ? (
            <div className="min-w-[200px]">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full resize-none rounded bg-white/10 border-0 px-2 py-1 text-sm focus:ring-2 focus:ring-white/50"
                rows={2}
                autoFocus
              />
              <div className="mt-1 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content);
                  }}
                  className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleEdit}
                  className="text-xs px-2 py-1 rounded bg-white text-primary-600 hover:bg-gray-100"
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              
              {/* Status und Zeit */}
              <div className="mt-1 flex items-center gap-1">
                <span className={clsx('text-[10px]', isOwn ? 'text-primary-200' : 'text-gray-400')}>
                  {format(new Date(message.createdAt), 'HH:mm', { locale: de })}
                </span>
                {isOwn && (
                  <>
                    {message.isEdited && (
                      <span className={clsx('text-[10px]', isOwn ? 'text-primary-200' : 'text-gray-400')}>
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
        
        {/* Actions (nur für eigene Nachrichten) */}
        {isOwn && !isEditing && (
          <div className="mt-1 flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Bearbeiten"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(message.id)}
                className="p-1 rounded text-gray-400 hover:text-danger-600 hover:bg-danger-50"
                title="Löschen"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
