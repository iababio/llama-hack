import {useState, useRef} from 'react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type: 'text' | 'audio' | 'external_query';
  isMarkdown?: boolean;
  externalData?: {
    data: any;
    queryType: 'weather' | 'restaurant' | 'shop' | 'general';
  };
}

export const useMessageHandling = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messageCounter = useRef(0);

  const addMessage = (
    text: string,
    isUser: boolean,
    type: 'text' | 'audio' | 'external_query' = 'text',
    externalData?: {
      data: any;
      queryType: 'weather' | 'restaurant' | 'shop' | 'general';
    },
    isMarkdown: boolean = false,
  ) => {
    messageCounter.current += 1;
    const newMessage: Message = {
      id: `msg_${messageCounter.current}_${Date.now()}`,
      text,
      isUser,
      timestamp: new Date(),
      type,
      externalData,
      isMarkdown: isMarkdown || text.includes('**') || text.includes('##'),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const clearMessages = () => {
    setMessages([]);
    messageCounter.current = 0;
  };

  return {
    messages,
    setMessages,
    addMessage,
    clearMessages,
  };
};