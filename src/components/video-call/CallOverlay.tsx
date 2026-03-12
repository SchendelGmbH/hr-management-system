'use client';

import { cn } from '@/lib/utils';
import { Phone, Users, Video, PhoneIncoming } from 'lucide-react';
import { CallStatus, CallType } from '@/types/videoCall';

interface CallOverlayProps {
  status: CallStatus;
  initiatorName: string;
  callType: CallType;
  participantCount: number;
}

export function CallOverlay({ status, initiatorName, callType, participantCount }: CallOverlayProps) {
  const isRinging = status === 'ringing';
  const isCalling = status === 'calling';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
      {/* Animation rings */}
      {(isRinging || isCalling) && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-primary-500/30 animate-ping" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-primary-500/20 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-primary-500/10 animate-pulse" />
        </div>
      )}

      {/* Icon */}
      <div className="relative z-10 mb-6">
        <div className={cn(
          "w-28 h-28 rounded-full flex items-center justify-center",
          isRinging ? "bg-primary-500 animate-pulse" : "bg-primary-600"
        )}>
          {isRinging ? (
            <PhoneIncoming className="w-14 h-14 text-white" />
          ) : callType === 'video' ? (
            <Video className="w-14 h-14 text-white" />
          ) : (
            <Phone className="w-14 h-14 text-white" />
          )}
        </div>
      </div>

      {/* Status text */}
      <div className="relative z-10 text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">
          {isRinging ? "Eingehender Anruf..." : isCalling ? "Wird angerufen..." : "Verbindung wird hergestellt..."}</h2>
        
        <p className="text-lg text-gray-300">
          {initiatorName}
          {participantCount > 1 && (
            <span className="text-gray-400"><span className="mx-2">•</span>{participantCount} Teilnehmer</span>
          )}
        </p>
        
        <p className="text-sm text-gray-400 mt-4">
          {isRinging ? "Wische zum Annehmen nach rechts oder lehne nach links ab" : 
           callType === 'video' ? 'Videoanruf' : 'Sprachanruf'}</p>
      </div>

      {/* User avatars for group calls */}
      {participantCount > 1 && (
        <div className="relative z-10 mt-8 flex -space-x-3">
          {Array.from({ length: Math.min(participantCount, 5) }).map((_, i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center"
            >
              <Users className="w-5 h-5 text-gray-400" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
