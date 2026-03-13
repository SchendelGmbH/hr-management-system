'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  X, 
  MessageSquare, 
  Users, 
  User,
  Filter,
  Hash,
  ArrowRight,
  Command,
  ChevronDown,
  ChevronUp,
  CornerDownLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface SearchMessage {
  id: string;
  content: string;
  sentAt: string;
  sender: {
    id: string;
    username: string;
    employee?: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
  } | null;
  room: {
    id: string;
    name: string | null;
    type: string;
  };
}

interface SearchRoom {
  id: string;
  name: string | null;
  type: string;
  members: {
    user: {
      id: string;
      username: string;
      employee?: {
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
      };
    };
  }[];
  messages: { content: string; sentAt: string }[];
}

interface SearchUser {
  id: string;
  username: string;
  email: string;
  employee?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    department?: { name: string };
  };
}

interface FilterState {
  roomId: string | null;
  senderId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export function ChatSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<SearchMessage[]>([]);
  const [rooms, setRooms] = useState<SearchRoom[]>([]);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'rooms' | 'users'>('messages');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    roomId: null,
    senderId: null,
    dateFrom: null,
    dateTo: null,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cmd+K / Ctrl+K Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setMessages([]);
      setRooms([]);
      setUsers([]);
      setSelectedIndex(0);
      setActiveTab('messages');
    }
  }, [isOpen]);

  const debouncedSearch = useCallback((searchQuery: string, searchFilters: FilterState) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (!searchQuery && !searchFilters.roomId && !searchFilters.senderId && !searchFilters.dateFrom) {
        setMessages([]);
        setRooms([]);
        setUsers([]);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('query', searchQuery);
        if (searchFilters.roomId) params.append('roomId', searchFilters.roomId);
        if (searchFilters.senderId) params.append('senderId', searchFilters.senderId);
        if (searchFilters.dateFrom) params.append('dateFrom', searchFilters.dateFrom);
        if (searchFilters.dateTo) params.append('dateTo', searchFilters.dateTo);
        params.append('limit', '20');

        const response = await fetch(`/api/chat/search?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
          setRooms(data.rooms || []);
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    debouncedSearch(query, filters);
  }, [query, filters, debouncedSearch]);

  const getTotalItems = () => {
    switch (activeTab) {
      case 'messages': return messages.length;
      case 'rooms': return rooms.length;
      case 'users': return users.length;
      default: return 0;
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const total = getTotalItems();
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(total, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + Math.max(total, 1)) % Math.max(total, 1));
        break;
      case 'Enter':
        e.preventDefault();
        handleSelectItem(selectedIndex);
        break;
      case 'Tab':
        e.preventDefault();
        const tabs: ('messages' | 'rooms' | 'users')[] = ['messages', 'rooms', 'users'];
        const currentIdx = tabs.indexOf(activeTab);
        const newIdx = e.shiftKey 
          ? (currentIdx - 1 + 3) % 3 
          : (currentIdx + 1) % 3;
        setActiveTab(tabs[newIdx]);
        setSelectedIndex(0);
        break;
    }
  }, [activeTab, messages.length, rooms.length, users.length, selectedIndex]);

  const handleSelectItem = (index: number) => {
    switch (activeTab) {
      case 'messages':
        if (messages[index]) {
          router.push(`/chat?room=${messages[index].room.id}`);
          setIsOpen(false);
        }
        break;
      case 'rooms':
        if (rooms[index]) {
          router.push(`/chat?room=${rooms[index].id}`);
          setIsOpen(false);
        }
        break;
      case 'users':
        if (users[index]) {
          startDirectChat(users[index].id);
        }
        break;
    }
  };

  const startDirectChat = async (userId: string) => {
    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DIRECT',
          memberIds: [userId],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        router.push(`/chat?room=${data.room.id}`);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to create direct chat:', error);
    }
  };

  const formatMessageDate = (date: string) => {
    const msgDate = new Date(date);
    if (isToday(msgDate)) return format(msgDate, 'HH:mm', { locale: de });
    if (isYesterday(msgDate)) return 'Gestern';
    return format(msgDate, 'dd.MM.yy', { locale: de });
  };

  const getSenderName = (sender: SearchMessage['sender']) => {
    if (!sender) return 'Unbekannt';
    if (sender.employee?.firstName && sender.employee?.lastName) {
      return `${sender.employee.firstName} ${sender.employee.lastName}`;
    }
    return sender.username;
  };

  const getRoomName = (room: SearchRoom) => {
    if (room.name) return room.name;
    if (room.type === 'DIRECT') {
      const otherMember = room.members.find(m => m.user.id !== 'current-user-id');
      if (otherMember?.user.employee) {
        return `${otherMember.user.employee.firstName} ${otherMember.user.employee.lastName}`;
      }
      return otherMember?.user.username || 'Direktchat';
    }
    return 'Unbenannter Raum';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        title="Chat durchsuchen (Ctrl+K / Cmd+K)"
      >
        <Search className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">Chat suchen</span>
        <span className="hidden sm:flex items-center gap-1 text-xs bg-primary-700 px-1.5 py-0.5 rounded">
          <Command className="w-3 h-3" />
          <span>K</span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col mx-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachrichten, Räume oder Personen suchen..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {isLoading && (
              <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex items-center gap-1 mt-4">
            {(['messages', 'rooms', 'users'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedIndex(0);
                }}
                className={clsx(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                {tab === 'messages' && (
                  <>
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    Nachrichten
                    {messages.length > 0 && (
                      <span className="ml-1.5 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-xs">
                        {messages.length}
                      </span>
                    )}
                  </>
                )}
                {tab === 'rooms' && (
                  <>
                    <Hash className="w-4 h-4 inline mr-1" />
                    Räume
                    {rooms.length > 0 && (
                      <span className="ml-1.5 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-xs">
                        {rooms.length}
                      </span>
                    )}
                  </>
                )}
                {tab === 'users' && (
                  <>
                    <User className="w-4 h-4 inline mr-1" />
                    Personen
                    {users.length > 0 && (
                      <span className="ml-1.5 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-xs">
                        {users.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors',
                showFilters || Object.values(filters).some(Boolean)
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              <Filter className="w-4 h-4" />
              Filter
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Raum</label>
                  <select
                    value={filters.roomId || ''}
                    onChange={(e) => setFilters(f => ({ ...f, roomId: e.target.value || null }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  >
                    <option value="">Alle Räume</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{getRoomName(room)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Absender</label>
                  <select
                    value={filters.senderId || ''}
                    onChange={(e) => setFilters(f => ({ ...f, senderId: e.target.value || null }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  >
                    <option value="">Alle Personen</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Von Datum</label>
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value || null }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bis Datum</label>
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value || null }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>
              
              {Object.values(filters).some(Boolean) && (
                <button
                  onClick={() => setFilters({ roomId: null, senderId: null, dateFrom: null, dateTo: null })}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === 'messages' && (
            <div className="space-y-1">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-300" />
                  <p className="mt-4 text-gray-500">{query ? 'Keine Nachrichten gefunden' : 'Tippe um Nachrichten zu suchen'}</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectItem(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={clsx(
                      'w-full p-3 rounded-lg text-left transition-colors group',
                      selectedIndex === idx 
                        ? 'bg-primary-50 dark:bg-primary-900/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {msg.sender?.employee?.avatarUrl ? (
                          <img 
                            src={msg.sender.employee.avatarUrl} 
                            alt="" 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-600">
                            {getInitials(getSenderName(msg.sender))}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {getSenderName(msg.sender)}
                          </span>
                          <span className="text-gray-400">·</span>
                          <span className="text-xs text-gray-500">
                            {msg.room.name || (msg.room.type === 'DIRECT' ? 'Direktchat' : 'Raum')}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">
                            {formatMessageDate(msg.sentAt)}
                          </span>
                        </div>
                        
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="space-y-1">
              {rooms.length === 0 ? (
                <div className="text-center py-12">
                  <Hash className="w-12 h-12 mx-auto text-gray-300" />
                  <p className="mt-4 text-gray-500">Keine Räume gefunden</p>
                </div>
              ) : (
                rooms.map((room, idx) => (
                  <button
                    key={room.id}
                    onClick={() => handleSelectItem(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={clsx(
                      'w-full p-3 rounded-lg text-left transition-colors flex items-center gap-3',
                      selectedIndex === idx 
                        ? 'bg-primary-50 dark:bg-primary-900/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                      {room.type === 'DIRECT' ? (
                        <User className="w-5 h-5 text-white" />
                      ) : room.type === 'GROUP' ? (
                        <Users className="w-5 h-5 text-white" />
                      ) : (
                        <Hash className="w-5 h-5 text-white" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {getRoomName(room)}
                        </span>
                        <ArrowRight className={clsx(
                          'w-4 h-4 text-gray-400 transition-opacity',
                          selectedIndex === idx ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )} />
                      </div>
                      
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {room.members.length} Mitglied{room.members.length !== 1 ? 'er' : ''}
                        </span>
                        {room.messages[0] && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400 truncate">
                              {room.messages[0].content.slice(0, 50)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-1">
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <User className="w-12 h-12 mx-auto text-gray-300" />
                  <p className="mt-4 text-gray-500">{query ? 'Keine Personen gefunden' : 'Tippe um Personen zu suchen'}</p>
                </div>
              ) : (
                users.map((user, idx) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectItem(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={clsx(
                      'w-full p-3 rounded-lg text-left transition-colors flex items-center gap-3',
                      selectedIndex === idx 
                        ? 'bg-primary-50 dark:bg-primary-900/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {user.employee?.avatarUrl ? (
                        <img 
                          src={user.employee.avatarUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-medium">
                          {getInitials(user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.username)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {user.employee 
                            ? `${user.employee.firstName} ${user.employee.lastName}`
                            : user.username}
                        </span>
                        <span className={clsx(
                          'text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full',
                          selectedIndex === idx && 'bg-primary-100 dark:bg-primary-900/30'
                        )}>
                          Chat starten
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-0.5">
                        {user.employee?.department?.name || user.email}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> zum Auswählen</span>
            <span className="flex items-center gap-1"><span className="px-1 bg-gray-200 dark:bg-gray-700 rounded">↑↓</span> zum Navigieren</span>
            <span className="flex items-center gap-1"><span className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Tab</span> Tabs</span>
          </div>
          <span><span className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Esc</span> zum Schließen</span>
        </div>
      </div>
    </div>
  );
}
