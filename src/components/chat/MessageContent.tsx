'use client';

import Link from 'next/link';
import { clsx } from 'clsx';

interface MessageContentProps {
  content: string;
  isOwn: boolean;
  currentUserId?: string;
}

interface MentionMatch {
  fullMatch: string;
  userName: string;
  userId?: string;
}

export function MessageContent({ content, isOwn, currentUserId }: MessageContentProps) {
  // Parse mentions - format: @Name or @Name (userId)
  const parseMentions = (text: string): MentionMatch[] = {
    const mentions: MentionMatch[] = [];
    // Match @ followed by name, optionally followed by (userId)
    const mentionRegex = /@(\S[^@\n\r]*?)(?:\s*\(([^)]+)\))?(?=\s|$|[^\w\s])/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({
        fullMatch: match[0],
        userName: match[1].trim(),
        userId: match[2]
      });
    }

    return mentions;
  };

  const mentions = parseMentions(content);

  if (mentions.length === 0) {
    // No mentions, render as plain text
    return (
      <p className="text-sm whitespace-pre-wrap break-words">
        {content}
      </p>
    );
  }

  // Split content into parts
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Find and replace mentions
  const mentionRegex = /@(\S[^@\n\r]*?)(?:\s*\(([^)]+)\))?(?=\s|$|[^\w\s])/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }

    // Check if current user is mentioned
    const isCurrentUserMentioned = match[2] === currentUserId;

    // Add mention span
    parts.push(
      <span
        key={`mention-${match.index}`}
        className={clsx(
          'inline-flex items-center px-1.5 py-0.5 rounded-md font-medium transition-colors',
          isCurrentUserMentioned
            ? 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 ring-1 ring-primary-300 dark:ring-primary-700'
            : 'bg-gray-200/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300',
          isOwn ? 'hover:bg-primary-300 dark:hover:bg-primary-800' : 'hover:bg-gray-300/50 dark:hover:bg-gray-600/50'
        )}
        title={match[2] ? `Benutzer-ID: ${match[2]}` : undefined}
      >
        <span className="text-orange-500 font-bold">@</span>
        <span>{match[1].trim()}</span>
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-end`}>{content.slice(lastIndex)}</span>
    );
  }

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {parts}
    </p>
  );
}
