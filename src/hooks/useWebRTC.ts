'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from './useSocket';
import { VideoCallState, VideoCallParticipant, SignalingMessage, CallType, CallStatus, PeerConnection } from '@/types/videoCall';
import SimplePeer from 'simple-peer';

const MAX_PARTICIPANTS = 5;

export function useWebRTC() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { socket, isConnected } = useSocket();
  
  const [callState, setCallState] = useState<VideoCallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string>('');

  // Generate call ID
  const generateCallId = useCallback(() => {
    return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get local media stream
  const getLocalStream = useCallback(async (callType: CallType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true,
      });
      setLocalStream(stream);
      setIsVideoEnabled(callType === 'video');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Could not access camera/microphone');
    }
  }, []);

  // Get screen share stream
  const getScreenStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      return stream;
    } catch (error) {
      console.error('Error accessing screen:', error);
      throw new Error('Could not access screen');
    }
  }, []);

  // Create peer connection
  const createPeer = useCallback((targetId: string, stream: MediaStream, initiator: boolean) => {
    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: true,
    });

    peer.on('signal', (signal: any) => {
      socket?.emit('signaling', {
        type: initiator ? 'offer' : 'answer',
        callId: callIdRef.current,
        senderId: userId,
        targetId,
        payload: signal,
        timestamp: new Date(),
      });
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      setCallState((prev) => {
        if (!prev) return null;
        const updatedParticipants = prev.participants.map((p) =>
          p.id === targetId ? { ...p, stream: remoteStream } : p
        );
        return { ...prev, participants: updatedParticipants };
      });
    });

    peer.on('error', (err: Error) => {
      console.error('Peer error:', err);
    });

    peer.on('close', () => {
      peersRef.current.delete(targetId);
    });

    peersRef.current.set(targetId, { userId: targetId, peer });
    return peer;
  }, [socket, userId]);

  // Initiate call
  const initiateCall = useCallback(async (roomId: string, callType: CallType, participants: VideoCallParticipant[]) => {
    if (participants.length > MAX_PARTICIPANTS) {
      throw new Error(`Maximum ${MAX_PARTICIPANTS} participants allowed`);
    }

    const callId = generateCallId();
    callIdRef.current = callId;

    const stream = await getLocalStream(callType);

    const newCallState: VideoCallState = {
      callId,
      roomId,
      initiatorId: userId!,
      participants: participants.map((p) => ({ ...p, stream: undefined })),
      status: 'calling',
      callType,
      isScreenSharing: false,
      isGroupCall: participants.length > 1,
    };

    setCallState(newCallState);

    // Create peer connections for each participant
    participants.forEach((participant) => {
      if (participant.id !== userId) {
        createPeer(participant.id, stream, true);
      }
    });

    // Notify other participants
    socket?.emit('call-started', {
      callId,
      roomId,
      initiatorId: userId,
      participants: participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
      callType,
      timestamp: new Date(),
    });

    return callId;
  }, [generateCallId, getLocalStream, createPeer, socket, userId]);

  // Accept incoming call
  const acceptCall = useCallback(async (callData: Partial<VideoCallState>) => {
    const stream = await getLocalStream(callData.callType || 'video');
    
    setCallState((prev) => ({
      ...prev!,
      ...callData,
      status: 'connected',
      startTime: new Date(),
    } as VideoCallState));

    // Accept all pending peer connections
    peersRef.current.forEach((peerConn) => {
      // Peers are already created from offer
    });

    socket?.emit('call-accepted', {
      callId: callIdRef.current,
      userId,
      timestamp: new Date(),
    });
  }, [getLocalStream, socket, userId]);

  // Decline call
  const declineCall = useCallback((callId: string) => {
    socket?.emit('signaling', {
      type: 'call-declined',
      callId,
      senderId: userId,
      timestamp: new Date(),
    });
    
    cleanup();
  }, [socket, userId]);

  // End call
  const endCall = useCallback(() => {
    if (!callState) return;

    socket?.emit('signaling', {
      type: 'call-ended',
      callId: callState.callId,
      senderId: userId,
      timestamp: new Date(),
    });

    cleanup();
  }, [callState, socket, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
      
      socket?.emit('signaling', {
        type: 'mute-state',
        callId: callIdRef.current,
        senderId: userId,
        payload: { isMuted: !isMuted },
        timestamp: new Date(),
      });
    }
  }, [localStream, isMuted, socket, userId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled((prev) => !prev);
    }
  }, [localStream]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      
      // Notify peers
      socket?.emit('signaling', {
        type: 'screen-share',
        callId: callIdRef.current,
        senderId: userId,
        payload: { isScreenSharing: false },
        timestamp: new Date(),
      });
      
      // Replace with camera stream
      peersRef.current.forEach(({ peer }) => {
        if (localStream) {
          peer.replaceTrack(
            peer.streams[0].getVideoTracks()[0],
            localStream.getVideoTracks()[0],
            localStream
          );
        }
      });
    } else {
      // Start screen sharing
      const screenStream = await getScreenStream();
      setIsScreenSharing(true);
      
      // Notify peers
      socket?.emit('signaling', {
        type: 'screen-share',
        callId: callIdRef.current,
        senderId: userId,
        payload: { isScreenSharing: true },
        timestamp: new Date(),
      });
      
      // Replace with screen stream
      peersRef.current.forEach(({ peer }) => {
        if (localStream) {
          peer.replaceTrack(
            peer.streams[0].getVideoTracks()[0],
            screenStream.getVideoTracks()[0],
            screenStream
          );
        }
      });
      
      // Handle screen share stop from browser
      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        screenStreamRef.current = null;
        
        // Restore camera
        peersRef.current.forEach(({ peer }) => {
          if (localStream) {
            peer.replaceTrack(
              peer.streams[0].getVideoTracks()[0],
              localStream.getVideoTracks()[0],
              localStream
            );
          }
        });
      };
    }
  }, [isScreenSharing, getScreenStream, localStream, socket, userId]);

  // Cleanup
  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    
    peersRef.current.forEach(({ peer }) => {
      peer.destroy();
    });
    peersRef.current.clear();
    
    setLocalStream(null);
    setCallState(null);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsVideoEnabled(false);
    screenStreamRef.current = null;
  }, [localStream]);

  // Handle signaling messages
  useEffect(() => {
    if (!socket) return;

    const handleSignaling = (message: SignalingMessage) => {
      if (message.senderId === userId) return;

      switch (message.type) {
        case 'offer':
          // Create peer as non-initiator
          if (localStream) {
            const peer = createPeer(message.senderId, localStream, false);
            peer.signal(message.payload);
          }
          break;
        
        case 'answer':
          const peerConn = peersRef.current.get(message.senderId);
          if (peerConn) {
            peerConn.peer.signal(message.payload);
          }
          break;
        
        case 'ice-candidate':
          // Simple-peer handles this automatically
          break;
        
        case 'call-ended':
          cleanup();
          break;
        
        case 'call-declined':
          setCallState((prev) => prev ? { ...prev, status: 'declined' } : null);
          setTimeout(cleanup, 3000);
          break;
        
        case 'screen-share':
          setCallState((prev) => {
            if (!prev) return null;
            const updatedParticipants = prev.participants.map((p) =>
              p.id === message.senderId ? { ...p, isScreenSharing: message.payload?.isScreenSharing } : p
            );
            return { ...prev, participants: updatedParticipants };
          });
          break;
        
        case 'mute-state':
          setCallState((prev) => {
            if (!prev) return null;
            const updatedParticipants = prev.participants.map((p) =>
              p.id === message.senderId ? { ...p, isMuted: message.payload?.isMuted } : p
            );
            return { ...prev, participants: updatedParticipants };
          });
          break;
      }
    };

    const handleCallStarted = (data: any) => {
      if (data.initiatorId !== userId) {
        setCallState({
          callId: data.callId,
          roomId: data.roomId,
          initiatorId: data.initiatorId,
          participants: data.participants,
          status: 'ringing',
          callType: data.callType,
          isScreenSharing: false,
          isGroupCall: data.participants.length > 2,
        });
        callIdRef.current = data.callId;
      }
    };

    socket.on('signaling', handleSignaling);
    socket.on('call-started', handleCallStarted);

    return () => {
      socket.off('signaling', handleSignaling);
      socket.off('call-started', handleCallStarted);
    };
  }, [socket, userId, localStream, createPeer, cleanup]);

  return {
    callState,
    localStream,
    isScreenSharing,
    isMuted,
    isVideoEnabled,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
}
