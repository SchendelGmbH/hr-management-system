'use client';

import { cn } from '@/lib/utils';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff, 
  ScreenShare, 
  MonitorOff,
  Users,
  X
} from 'lucide-react';
import { CallStatus } from '@/types/videoCall';

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isGroupCall: boolean;
  onAccept?: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

export function CallControls({
  status,
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  isGroupCall,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}: CallControlsProps) {
  const isConnected = status === 'connected';
  const isCalling = status === 'calling';
  const isRinging = status === 'ringing';

  return (
    <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-gray-900 to-transparent">
      {/* Ringing state - Accept/Decline buttons */}
      {isRinging && (
        <>
          {onAccept && (
            <button
              onClick={onAccept}
              className={cn(
                "flex items-center justify-center w-14 h-14 rounded-full",
                "bg-green-500 hover:bg-green-600 text-white",
                "transition-all duration-200 hover:scale-110",
                "shadow-lg shadow-green-500/30"
              )}
              title="Annehmen"
            >
              <Phone className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={onDecline}
            className={cn(
              "flex items-center justify-center w-14 h-14 rounded-full",
              "bg-red-500 hover:bg-red-600 text-white",
              "transition-all duration-200 hover:scale-110",
              "shadow-lg shadow-red-500/30"
            )}
            title="Ablehnen"
          >
            <X className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Connected state - Call controls */}
      {(isConnected || isCalling) && (
        <>
          {/* Mute */}
          <button
            onClick={onToggleMute}
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full",
              "transition-all duration-200 hover:scale-110",
              isMuted
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-white/20 text-white hover:bg-white/30"
            )}
            title={isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video toggle */}
          <button
            onClick={onToggleVideo}
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full",
              "transition-all duration-200 hover:scale-110",
              !isVideoEnabled
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-white/20 text-white hover:bg-white/30"
            )}
            title={isVideoEnabled ? 'Video ausschalten' : 'Video einschalten'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen share */}
          <button
            onClick={onToggleScreenShare}
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full",
              "transition-all duration-200 hover:scale-110",
              isScreenSharing
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "bg-white/20 text-white hover:bg-white/30"
            )}
            title={isScreenSharing ? 'Bildschirmfreigabe beenden' : 'Bildschirmfreigabe'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
          </button>

          {/* End call */}
          <button
            onClick={onEnd}
            className={cn(
              "flex items-center justify-center w-14 h-14 rounded-full",
              "bg-red-500 hover:bg-red-600 text-white",
              "transition-all duration-200 hover:scale-110",
              "shadow-lg shadow-red-500/30"
            )}
            title="Anruf beenden"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
}
