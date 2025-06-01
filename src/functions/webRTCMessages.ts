import RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel';
import {MessageCreationEvent, ResponseCreationEvent} from './webRTCTypes';

/**
 * Create a message to send to the AI
 */
export const createConversationItem = (text: string): MessageCreationEvent => {
  return {
    type: 'conversation.item.create',
    item: {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: text,
        },
      ],
    },
  };
};

/**
 * Create a response event to trigger AI response
 */
export const createResponseEvent = (
  modalities: string[] = ['text', 'audio'],
  instructions: string = 'Please respond to the user message in a helpful and conversational way.',
): ResponseCreationEvent => {
  return {
    type: 'response.create',
    response: {
      modalities,
      instructions,
    },
  };
};

/**
 * Send text message through data channel
 */
export const sendTextMessage = (
  dataChannel: RTCDataChannel | null,
  text: string,
  addMessage: (text: string, isUser: boolean, type?: 'text' | 'audio') => void,
): boolean => {
  if (dataChannel && dataChannel.readyState === 'open') {
    try {
      // Create conversation item with user text
      const conversationItemEvent = createConversationItem(text);
      console.log('Sending conversation item');
      dataChannel.send(JSON.stringify(conversationItemEvent));

      // Trigger AI response
      const responseEvent = createResponseEvent();
      console.log('Triggering response');
      dataChannel.send(JSON.stringify(responseEvent));
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  } else {
    console.log('Data channel not ready, status:', dataChannel?.readyState);
    return false;
  }
};

/**
 * Send camera context message through data channel
 */
export const sendCameraContextMessage = (
  dataChannel: RTCDataChannel | null,
): boolean => {
  if (dataChannel && dataChannel.readyState === 'open') {
    try {
      const conversationItemEvent = {
        type: 'conversation.item.create',
        item: {
          id: `vision_${Date.now()}`,
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'I am now using the camera. Please help me analyze what you can see.',
            },
          ],
        },
      };

      console.log('Sending camera context message');
      dataChannel.send(JSON.stringify(conversationItemEvent));

      // Trigger AI response
      const responseEvent = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions:
            'The user is now using the camera. Provide helpful vision assistance.',
        },
      };

      dataChannel.send(JSON.stringify(responseEvent));
      return true;
    } catch (error) {
      console.error('Error sending camera context message:', error);
      return false;
    }
  }
  return false;
};