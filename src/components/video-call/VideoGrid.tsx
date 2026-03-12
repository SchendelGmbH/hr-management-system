'use client';

import { useEffect, useRef } from 'react';
import { VideoCallParticipant } from '@/types/videoCall';
import { cn } from '@/lib/utils';
import { User, MicOff } from 'lucide-react';

interface VideoGridProps {
  participants: VideoCallParticipant[];
  localStream: MediaStream | null;
  isScreenSharing: boolean;
}

export function VideoGrid({ participants, localStream, isScreenSharing }: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Calculate grid layout based on participant count
  const totalParticipants = participants.length + 1; // +1 for local
  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 md:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    return 'grid-cols-2 md:grid-cols-3';
  };

  const activeParticipants = participants.filter(p => p.stream);

  return (
    <div className={cn(
      "flex-1 grid gap-2 p-2 overflow-auto",
      getGridClass()
    )}>
      {/* Local Video */}
      <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
        {localStream ? (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={cn(
                "w-full h-full object-cover",
                isScreenSharing && "object-contain bg-gray-900"
              )}
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-medium text-white bg-black/50 rounded">
                Du (Bildschirmfreigabe)
              </span>
              {isScreenSharing && (
                <span className="px-2 py-1 text-xs font-medium text-blue-400 bg-black/50 rounded">
                  🔴 Bildschirmfreigabe
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
              <User className="w-10 h-10 text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Remote Participants */}
      {activeParticipants.map((participant) => (
        <ParticipantVideo
          key={participant.id}
          participant={participant}
        />
      ))}

      {/* Waiting/Connecting Participants */}
      {participants.filter(p => !p.stream && p.id !== 'local').map((participant) => (
        <div 
          key={participant.id}
          className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center"
        >
          <div className="text-center">
            {participant.avatar ? (
              <img
                src={participant.avatar}
                alt={participant.name}
                className="w-20 h-20 rounded-full mx-auto mb-2 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-700 mx-auto mb-2 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <span className="text-sm text-gray-400">{participant.name}</span>
            <div className="mt-2 text-xs text-gray-500">Verbindet...</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ParticipantVideo({ participant }: { participant: VideoCallParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {participant.stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={cn(
              "w-full h-full object-cover",
              participant.isScreenSharing && "object-contain bg-gray-900",
              !participant.isVideoEnabled && !participant.isScreenSharing && "hidden"
            )}
          />
          {(!participant.isVideoEnabled && !participant.isScreenSharing) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              {participant.avatar ? (
                <img
                  src={participant.avatar}
                  alt={participant.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                  <User className="w-10 h-10 text-gray-400" />
                </div>
              )}
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-medium text-white bg-black/50 rounded">
              {participant.name}
            </span>
            {participant.isScreenSharing && (
              <span className="px-2 py-1 text-xs font-medium text-blue-400 bg-black/50 rounded">
                🔴 Bildschirmfreigabe
              </span>
            )}
          </div>
          
          {participant.isMuted && (
            <div className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded-full">
              <MicOff className="w-4 h-4 text-white" />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          {participant.avatar ? (
            <img
              src={participant.avatar}
              alt={participant.name}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
              <User className="w-10 h-10 text-gray-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
