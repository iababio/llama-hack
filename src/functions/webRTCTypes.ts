import {RTCPeerConnection} from 'react-native-webrtc';
import RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel';

// WebRTC configuration
export const RTC_CONFIGURATION = {
  iceServers: [
    {urls: 'stun:stun.l.google.com:19302'}, // Google STUN server
  ],
};

// Connection status types
export type ConnectionStatus = 'notConnect' | 'connecting' | 'connected';

// WebRTC state interface
export interface WebRTCState {
  connectStatus: ConnectionStatus;
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  localStreamRef: MediaStream | null;
}

// WebRTC handlers interface
export interface WebRTCHandlers {
  handleOpenAIEvent: (event: {data: string}) => void;
  addMessage: (text: string, isUser: boolean, type?: 'text' | 'audio') => void;
}

// OpenAI message interface for type safety
export interface OpenAIMessage {
  type: string;
  [key: string]: any;
}

// Session update message interface
export interface SessionUpdateMessage {
  type: 'session.update';
  session: {
    modalities: string[];
    instructions: string;
    voice: string;
    input_audio_format: string;
    output_audio_format: string;
    input_audio_transcription: {
      model: string;
    };
  };
}

// Message creation interface
export interface MessageCreationEvent {
  type: 'conversation.item.create';
  item: {
    id: string;
    type: string;
    role: string;
    content: {
      type: string;
      text: string;
    }[];
  };
}

// Response creation interface
export interface ResponseCreationEvent {
  type: 'response.create';
  response: {
    modalities: string[];
    instructions: string;
  };
}