'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, User } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface ChatUser {
  id: string;
  username: string;
  email: string;
  name: string;
  department?: string;
  position?: string;
}

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function NewChatDialog({ isOpen, onClose, onSelectUser }: NewChatDialogProps) {
  const { data: session } = useSession();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  // Search users when query changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/chat/users?limit=50');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      // Filter out current user
      const filtered = (data.users || []).filter(
        (user: ChatUser) => user.id !== session?.user?.id
      );
      setUsers(filtered);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Fehler beim Laden der Benutzer');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      // Reload all users if query is cleared
      if (!query) {
        loadUsers();
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/users?query=${encodeURIComponent(query)}&limit=20`);
      if (!response.ok) throw new Error('Failed to search users');
      const data = await response.json();
      // Filter out current user
      const filtered = (data.users || []).filter(
        (user: ChatUser) => user.id !== session?.user?.id
      );
      setUsers(filtered);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Neuen Chat starten
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Name oder E-Mail suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tippe mindestens 2 Zeichen für die Suche
          </p>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2">
          {error && (
            <div className="p-4 text-center text-red-500">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
              Lade Benutzer...
            </div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery 
                ? 'Keine Benutzer gefunden' 
                : 'Keine Benutzer verfügbar'}
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {user.department || user.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500">
            {users.length} Benutzer gefunden
          </p>
        </div>
      </div>
    </div>
  );
}
