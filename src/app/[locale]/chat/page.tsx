'use client';

import { useState } from 'react';
import { ChatRoomList } from '@/components/chat/ChatRoomList';
import { ChatRoom } from '@/components/chat/ChatRoom';

export default function ChatPage() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar - Room List */}
      <div className="w-80 flex-shrink-0">
        <ChatRoomList
          onSelectRoom={setSelectedRoomId}
          selectedRoomId={selectedRoomId}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 p-4">
        {selectedRoomId ? (
          <ChatRoom roomId={selectedRoomId} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">Wähle einen Chat aus der Liste aus</p>
              <p className="text-sm">oder starte einen neuen Chat</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}