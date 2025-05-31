import React, {useState, useRef, useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, Alert, Animated} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {RTCPeerConnection} from 'react-native-webrtc';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Markdown from 'react-native-markdown-display';
import ChatInput from './components/chat/ChatInput';
import ExternalQueryCard from './components/chat/ExternalQueryCard';
import {
  connectWebSocket,
  disconnectWebSocket,
  handleOpenAIEvent as handleOpenAIEventFunc,
  sendTextMessage,
  ConnectionStatus,
  containsExternalQueryKeywords,
  fetchExternalQueryResponse,
  formatExternalQueryResponse,
} from './functions';
import RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel';
import {CONFIG} from './utils/rtcConfig';


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

const App = ({navigation}) => {
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [isLoadingLlama, setIsLoadingLlama] = useState(false);

  const messageCounter = useRef(0);

  // WebRTC states - Default to OFF
  const [connectStatus, setConnectStatus] =
    useState<ConnectionStatus>('notConnect');
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Animation for speak indicator
  const speakIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const speakIndicatorScale = useRef(new Animated.Value(0.8)).current;

  // FlatList ref for scrolling
  const flatListRef = useRef<FlatList>(null);

  // Call Llama API
  const callLlamaAPI = async (userMessage: string): Promise<string> => {
    try {
      setIsLoadingLlama(true);

      const response = await fetch(CONFIG.LLAMA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.LLAMA_API_KEY}`,
        },
        body: JSON.stringify({
          model: CONFIG.LLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Llama API Error:', response.status, errorText);
        
        // Provide more specific error messages
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      }

      const data = await response.json();
      console.log('Llama API Response:', data); // Debug log
      
      // Handle Llama's response format
      if (data.completion_message?.content?.text) {
        return data.completion_message.content.text.trim();
      } else if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        // Fallback for OpenAI-compatible format
        return data.choices[0].message.content.trim();
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('Invalid response format from Llama API');
      }
    } catch (error) {
      console.error('Error calling Llama API:', error);
      
      // Re-throw with user-friendly message
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw error;
      }
    } finally {
      setIsLoadingLlama(false);
    }
  };

  // Sync isRecording with connection status
  useEffect(() => {
    console.log('🔄 connectStatus changed to:', connectStatus);
    const newRecordingState = connectStatus === 'connected';
    console.log('🎤 Setting isRecording to:', newRecordingState);
    setIsRecording(newRecordingState);
  }, [connectStatus]);

  // Animate speak indicator when connection status changes
  useEffect(() => {
    if (connectStatus === 'connected') {
      // Show and animate the speak indicator
      Animated.parallel([
        Animated.timing(speakIndicatorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(speakIndicatorScale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(speakIndicatorScale, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(speakIndicatorScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.start();
    } else {
      // Hide the speak indicator
      Animated.parallel([
        Animated.timing(speakIndicatorOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(speakIndicatorScale, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [connectStatus, speakIndicatorOpacity, speakIndicatorScale]);

  // Add message to chat
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
      isMarkdown,
    };
    setMessages(prev => [...prev, newMessage]);
    scrollToEnd();
  };

  // Scroll to end of chat
  const scrollToEnd = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({animated: true});
    }, 100);
  };

  // Handle text message send with Llama integration only
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();

    // Add user message to chat
    addMessage(messageText, true, 'text');
    setInputText('');

    // Check if the message contains external query keywords
    if (containsExternalQueryKeywords(messageText)) {
      try {
        // Show loading message
        addMessage('🔍 Looking that up for you...', false, 'text');

        // Fetch external query response
        const apiResponse = await fetchExternalQueryResponse(messageText);
        const formattedResponse = formatExternalQueryResponse(
          apiResponse,
          messageText,
        );

        // Remove loading message
        setMessages(prev => prev.slice(0, -1));

        // Add the formatted response with structured data and markdown
        addMessage(
          formattedResponse.text,
          false,
          'external_query',
          {
            data: formattedResponse.data,
            queryType: formattedResponse.queryType,
          },
          true,
        );
      } catch (error) {
        console.error('Error fetching external query:', error);
        // Remove loading message
        setMessages(prev => prev.slice(0, -1));
        addMessage(
          "❌ Sorry, I couldn't retrieve that information right now.",
          false,
          'text',
        );
      }
    } else {
      // Use Llama API for normal text chat (no WebRTC fallback)
      try {
        // Show loading indicator
        addMessage('🦙 Llama is thinking...', false, 'text');

        // Call Llama API
        const llamaResponse = await callLlamaAPI(messageText);
        
        // Remove loading message
        setMessages(prev => prev.slice(0, -1));
        
        // Add Llama response with markdown support
        addMessage(llamaResponse, false, 'text', undefined, true);
        
      } catch (error) {
        console.error('Error calling Llama API:', error);
        
        // Remove loading message
        setMessages(prev => prev.slice(0, -1));
        
        // Show error message (no WebRTC fallback)
        addMessage(
          '❌ Sorry, I encountered an error processing your message. Please try again.',
          false,
          'text',
        );
      }
    }
  };

  // Handle OpenAI Events wrapper
  const handleOpenAIEvent = (event: {data: string}) => {
    handleOpenAIEventFunc(event, addMessage);
  };

  // Handle voice press - Only for WebRTC voice functionality
  const handleVoicePress = async () => {
    console.log('🎤 handleVoicePress called! Current status:', connectStatus);

    if (connectStatus === 'connected') {
      // Turn OFF RTC connection
      console.log('Turning OFF RTC connection...');
      await disconnectWebSocket(
        peerConnection,
        dataChannel,
        localStreamRef,
        setConnectStatus,
        setPeerConnection,
        setDataChannel,
        addMessage,
      );
    } else if (connectStatus === 'notConnect') {
      // Turn ON RTC connection
      console.log('Turning ON RTC connection...');
      await connectWebSocket(
        connectStatus,
        setConnectStatus,
        setPeerConnection,
        setDataChannel,
        localStreamRef,
        handleOpenAIEvent,
        addMessage,
      );
    } else {
      console.log('Ignoring press - currently connecting...');
    }
  };

  // Handle attachment option selection
  const handleAttachmentOption = (option: string) => {
    setAttachmentSheetVisible(false);

    switch (option) {
      case 'camera':
        console.log('Camera option selected - navigating to camera');
        navigation?.navigate('Camera', {
          webRTCState: {
            connectStatus,
            peerConnection,
            dataChannel,
            localStreamRef: localStreamRef.current,
          },
          webRTCHandlers: {
            handleOpenAIEvent,
            addMessage,
          },
        });
        break;
      case 'gallery':
        console.log('Gallery selected');
        navigation?.navigate('Gallery', {
          webRTCState: {
            connectStatus,
            peerConnection,
            dataChannel,
            localStreamRef: localStreamRef.current,
          },
          webRTCHandlers: {
            handleOpenAIEvent,
            addMessage,
          },
        });
        break;
      case 'document':
        console.log('Document selected');
        Alert.alert('Document', 'Document functionality coming soon!');
        break;
      case 'location':
        console.log('Location selected');
        Alert.alert('Location', 'Location functionality coming soon!');
        break;
      default:
        console.log('Unknown option:', option);
    }
  };

  // Handle attachment press
  const handleAttachmentPress = () => {
    setAttachmentSheetVisible(prev => !prev);
  };

  // Render message item with markdown support
  const renderMessage = ({item}: {item: Message}) => {
    // Add debugging to see what data we have
    console.log('Rendering message:', {
      id: item.id,
      type: item.type,
      hasExternalData: !!item.externalData,
    });

    // For external query messages, render text and cards separately
    if (item.type === 'external_query') {
      return (
        <View style={styles.externalQueryContainer}>
          {/* Text message part */}
          <View style={[styles.messageContainer, styles.aiMessage]}>
            {item.isMarkdown ? (
              <Markdown style={markdownStyles}>{item.text}</Markdown>
            ) : (
              <Text style={[styles.messageText, styles.aiMessageText]}>
                {item.text}
              </Text>
            )}
            <Text style={styles.timestamp}>
              {item.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* External query cards part */}
          {item.externalData && (
            <View style={styles.externalQueryCardsContainer}>
              <ExternalQueryCard
                data={item.externalData.data}
                queryType={item.externalData.queryType}
              />
            </View>
          )}
        </View>
      );
    }

    // Regular message rendering
    return (
      <View
        style={[
          styles.messageContainer,
          item.isUser ? styles.userMessage : styles.aiMessage,
        ]}>
        {/* Render markdown content for AI responses or regular text for user messages */}
        {item.isMarkdown && !item.isUser ? (
          <Markdown style={markdownStyles}>{item.text}</Markdown>
        ) : (
          <Text
            style={[
              styles.messageText,
              item.isUser ? styles.userMessageText : styles.aiMessageText,
            ]}>
            {item.text}
          </Text>
        )}

        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Meta Hack</Text>
          <View style={styles.headerRight}>
            {/* Llama Loading Indicator */}
            {isLoadingLlama && (
              <View style={styles.loadingIndicator}>
                <Text style={styles.loadingText}>🦙</Text>
              </View>
            )}

            {/* Speak to Chat Indicator - Only show when connected */}
            <Animated.View
              style={[
                styles.speakIndicator,
                {
                  opacity: speakIndicatorOpacity,
                  transform: [{scale: speakIndicatorScale}],
                },
              ]}>
              <Ionicons
                name="mic"
                size={12}
                color="#0081FB"
                style={styles.speakIcon}
              />
              <Text style={styles.speakText}>Speak to chat</Text>
            </Animated.View>

            {/* Connection Status Indicator */}
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor:
                    connectStatus === 'connected'
                      ? '#0081FB'
                      : connectStatus === 'connecting'
                      ? '#FFB84D'
                      : '#FF6B6B',
                },
              ]}
            />
          </View>
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
          />
        </View>

        {/* Chat Input */}
        <ChatInput
          inputText={inputText}
          setInputText={setInputText}
          handleSend={handleSend}
          handleVoicePress={handleVoicePress}
          handleAttachmentPress={handleAttachmentPress}
          onAttachmentOption={handleAttachmentOption}
          isRecording={isRecording}
          attachmentSheetVisible={attachmentSheetVisible}
          scrollToEnd={scrollToEnd}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0.4,
    borderBottomColor: '#ededed',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0081FB',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingIndicator: {
    backgroundColor: 'rgba(255, 184, 77, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  loadingText: {
    fontSize: 14,
  },
  speakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  speakIcon: {
    marginRight: 4,
  },
  speakText: {
    color: '#0081FB',
    fontSize: 12,
    fontWeight: '500',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 80,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messagesContent: {
    paddingVertical: 10,
    flexGrow: 1,
  },
  messageContainer: {
    marginVertical: 5,
    padding: 12,
    borderRadius: 15,
    maxWidth: '95%',
    flexShrink: 1,
    alignSelf: 'flex-start',
    flex: 0,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0081FB',
    maxWidth: '80%',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    maxWidth: '95%',
  },
  externalQueryContainer: {
    marginVertical: 5,
    alignSelf: 'flex-start',
    width: '100%',
    flex: 0,
  },
  externalQueryCardsContainer: {
    marginTop: 8,
    alignSelf: 'flex-start',
    width: '100%',
    flex: 0,
    overflow: 'visible',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#000',
  },
  aiMessageText: {
    color: '#333333',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
    alignSelf: 'flex-end',
  },
});

// Markdown styles to match your app's design
const markdownStyles = {
  body: {
    color: '#333333',
    fontSize: 16,
    lineHeight: 20,
  },
  heading1: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0081FB',
    marginVertical: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0081FB',
    marginVertical: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0081FB',
    marginVertical: 4,
  },
  strong: {
    fontWeight: 'bold',
    color: '#333333',
  },
  em: {
    fontStyle: 'italic',
    color: '#333333',
  },
  text: {
    color: '#333333',
    fontSize: 16,
    lineHeight: 20,
  },
  link: {
    color: '#0081FB',
    textDecorationLine: 'underline',
  },
  list_item: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: '#0081FB',
    marginRight: 8,
  },
  code_inline: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  fence: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0081FB',
  },
  blockquote: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#0081FB',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
};

export default App;
