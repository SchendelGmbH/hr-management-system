export type CallType = 'video' | 'audio';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'declined';

export interface VideoCallParticipant {
  id: string;
  name: string;
  avatar?: string;
  stream?: MediaStream;
  isScreenSharing?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
}

export interface VideoCallState {
  callId: string;
  roomId: string;
  initiatorId: string;
  participants: VideoCallParticipant[];
  status: CallStatus;
  callType: CallType;
  startTime?: Date;
  endTime?: Date;
  isScreenSharing: boolean;
  isGroupCall: boolean;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-started' | 'call-ended' | 'call-declined' | 'screen-share' | 'mute-state' | 'participant-joined' | 'participant-left';
  callId: string;
  roomId: string;
  senderId: string;
  targetId?: string;
  payload?: any;
  timestamp: Date;
}

export interface PeerConnection {
  userId: string;
  peer: any; // SimplePeer instance
  stream?: MediaStream;
}
