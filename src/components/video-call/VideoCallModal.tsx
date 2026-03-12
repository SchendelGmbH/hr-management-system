'use client';

import { useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { VideoCallState, VideoCallParticipant } from '@/types/videoCall';
import { VideoGrid } from './VideoGrid';
import { CallControls } from './CallControls';
import { CallOverlay } from './CallOverlay';
import { cn } from '@/lib/utils';

interface VideoCallModalProps {
  callState: VideoCallState | null;
  localStream: MediaStream | null;
  isScreenSharing: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  onAccept?: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

export function VideoCallModal({
  callState,
  localStream,
  isScreenSharing,
  isMuted,
  isVideoEnabled,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}: VideoCallModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!callState) return null;

  const isIncomingCall = callState.status === 'ringing';
  const isActiveCall = callState.status === 'connected' || callState.status === 'calling';
  const initiatorName = callState.participants.find(p => p.id === callState.initiatorId)?.name || 'Unknown';

  return (
    <Modal 
      isOpen={!!callState} 
      onClose={() => {}}
      size="xl"
    >
      <div 
        className={cn(
          "flex flex-col w-full bg-gray-900 rounded-lg overflow-hidden",
          callState.isGroupCall ? "h-[90vh]" : "h-[600px]"
        )}
      >
        {/* Video Grid */}
        {isActiveCall ? (
          <VideoGrid 
            participants={callState.participants}
            localStream={localStream}
            isScreenSharing={isScreenSharing}
          />
        ) : (
          <CallOverlay
            status={callState.status}
            initiatorName={initiatorName}
            callType={callState.callType}
            participantCount={callState.participants.length}
          />
        )}

        {/* Call Controls */}
        <CallControls
          status={callState.status}
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={isScreenSharing}
          isGroupCall={callState.isGroupCall}
          onAccept={onAccept}
          onDecline={onDecline}
          onEnd={onEnd}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onToggleScreenShare={onToggleScreenShare}
        />

        {/* Call Info Overlay */}
        {isActiveCall && (
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-full text-white text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>{callState.isGroupCall ? >Gruppenanruf' : 'Videoanruf'}</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-300">{callState.participants.length + 1} Teilnehmer</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
