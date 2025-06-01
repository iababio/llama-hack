import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Animated,
  TouchableOpacity,
  Clipboard,
  Vibration,
} from 'react-native';
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
import {
  handleLocationSharing,
  formatLocationMessage,
} from './utils/geolocation';

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

  // Call Llama API - Single declaration
  const callLlamaAPI = async (
    userMessage: string,
    images?: string[],
  ): Promise<string> => {
    try {
      setIsLoadingLlama(true);

      // Prepare message content
      let messageContent: any;

      if (images && images.length > 0) {
        // Handle image messages
        messageContent = [
          {
            type: 'text',
            text: userMessage,
          },
          ...images.map(base64Image => ({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          })),
        ];
      } else {
        // Handle text-only messages
        messageContent = userMessage;
      }

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
              content:
                'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
            },
            {
              role: 'user',
              content: messageContent,
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
      } else if (
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message
      ) {
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
        throw new Error(
          'Network error. Please check your internet connection.',
        );
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
      isMarkdown: isMarkdown || text.includes('**') || text.includes('##'), // Auto-detect markdown
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

  // Enhanced order state to track conversation flow and persist selected items
  const [orderState, setOrderState] = useState<{
    selectedItems?: any[];
    awaitingResponse?: boolean;
    userResponses?: string[];
    lastSelectedItems?: any[]; // Add this to remember last selection
  }>({});

  // Function to check if message contains order keywords
  const containsOrderKeywords = (message: string): boolean => {
    const orderKeywords = [
      'order for me',
      'order selected food',
      'order selected',
      'place order',
      'i want to order',
      'order these',
      'order this',
      'place my order',
      'order food',
      'make order',
      'place an order',
    ];

    const messageLower = message.toLowerCase();
    return orderKeywords.some(keyword => messageLower.includes(keyword));
  };

  // Function to detect if user is providing allergy/customization information
  const isOrderResponseMessage = (message: string): boolean => {
    const responseKeywords = [
      'no allergies',
      'allergic to',
      'i have allergy',
      'dietary restriction',
      'vegetarian',
      'vegan',
      'gluten free',
      'no customization',
      'extra',
      'no onions',
      'spicy',
      'mild',
      'sauce on side',
      'well done',
      'medium rare',
      'no dairy',
      'nut allergy',
      'shellfish allergy',
      'proceed with order',
      'place the order',
      'ready to order',
      'no allergic',
      'no special requests',
      'everything is fine',
      'proceed',
      'continue',
    ];

    const messageLower = message.toLowerCase();
    return responseKeywords.some(keyword => messageLower.includes(keyword));
  };

  // Function to check if user wants to finalize order with no allergies
  const isNoAllergiesResponse = (message: string): boolean => {
    const noAllergiesKeywords = [
      'no allergies',
      'no allergy',
      'no allergic',
      'no dietary restriction',
      'no special requests',
      'no customization',
      'proceed with order',
      'place the order',
      'ready to order',
      'everything is fine',
      'looks good',
      'proceed',
      'continue',
    ];

    const messageLower = message.toLowerCase();
    return noAllergiesKeywords.some(keyword => messageLower.includes(keyword));
  };

  // Generate cooking instructions based on user preferences
  const generateCookingInstructions = async (
    selectedItems: any[],
    userPreferences: string,
  ): Promise<string> => {
    try {
      const dishesInfo = selectedItems
        .map((item, index) => {
          return `${index + 1}. ${item.item_name_english} (${
            item.item_name_foreign
          }) - $${item.price_usd}`;
        })
        .join('\n');

      const prompt = `Based on the customer's order and preferences, create detailed step-by-step cooking/preparation instructions for the chef and serving instructions for the waiter.

CUSTOMER ORDER:
${dishesInfo}

CUSTOMER PREFERENCES & ALLERGIES:
${userPreferences}

Please provide:

1. **CHEF INSTRUCTIONS** (Kitchen Preparation):
   - Step-by-step cooking instructions in English
   - Special allergy precautions and cross-contamination prevention
   - Customization modifications for each dish
   - Cooking time and temperature adjustments if needed

2. **CHEF INSTRUCTIONS** (Native Language):
   - Same instructions translated to the restaurant's native language (infer from dish names)

3. **WAITER INSTRUCTIONS**:
   - How to serve the dishes
   - What to tell the customer about modifications
   - Allergy warnings to communicate
   - Order presentation notes

4. **ORDER SUMMARY**:
   - Final order with all modifications
   - Total estimated preparation time
   - Special handling notes

Format with clear sections, bullet points, and both English and native language instructions for the kitchen staff.`;

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
              content:
                "You are a professional restaurant operations assistant. Create detailed, clear instructions for kitchen staff and waiters. Always include allergy precautions and translate kitchen instructions to the restaurant's native language. Be thorough and safety-focused.",
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseData = await response.json();

      let instructions = '';
      if (responseData.completion_message?.content?.text) {
        instructions = responseData.completion_message.content.text.trim();
      } else if (
        responseData.choices &&
        responseData.choices.length > 0 &&
        responseData.choices[0].message
      ) {
        instructions = responseData.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response format from Llama API');
      }

      return instructions;
    } catch (error) {
      console.error('Error generating cooking instructions:', error);
      throw error;
    }
  };

  // Centralized order handling function
  const handleOrderRequest = async (
    selectedItems?: any[],
    userMessage?: string,
  ) => {
    try {
      // Show processing message
      addMessage(
        '🛒 I can help you place an order! Let me ask you a few questions first...',
        false,
        'text',
      );

      let orderPrompt = '';
      let itemsToUse = selectedItems;

      // If no items provided but we have last selected items, use those
      if (
        !itemsToUse &&
        orderState.lastSelectedItems &&
        orderState.lastSelectedItems.length > 0
      ) {
        itemsToUse = orderState.lastSelectedItems;
        console.log('🔄 Using previously selected items:', itemsToUse);
      }

      if (itemsToUse && itemsToUse.length > 0) {
        // Handle order from menu card with selected items
        setOrderState({
          selectedItems: itemsToUse,
          lastSelectedItems: itemsToUse, // Always remember the last selection
          awaitingResponse: true,
          userResponses: [],
        });

        const dishesInfo = itemsToUse
          .map((item, index) => {
            return `${index + 1}. ${item.item_name_english} (${
              item.item_name_foreign
            }) - $${item.price_usd}`;
          })
          .join('\n');

        orderPrompt = `The user wants to order the following dishes from a restaurant menu:

${dishesInfo}

Before placing this order, I need to ask important questions about:

1. **Food Allergies & Dietary Restrictions**: Do you have any allergies to nuts, dairy, gluten, shellfish, or any other ingredients? Are you vegetarian, vegan, or have any other dietary preferences?

2. **Customizations & Preferences**: Would you like any modifications to these dishes? (Examples: spice level, extra toppings, sauce on the side, no onions, etc.)

3. **Special Preparation**: Any special cooking instructions or notes for the kitchen?

Please ask these questions in a friendly, conversational way and wait for their responses before proceeding with the order.`;
      } else if (userMessage) {
        // Handle general order request from text input - ask to select dishes first
        setOrderState({
          awaitingResponse: true,
          userResponses: [],
        });

        orderPrompt = `The user wants to place an order and said: "${userMessage}"

Since they haven't selected specific dishes yet, please help them by:

1. **Menu Selection**: First, let them know they need to select dishes from the menu. Ask them to browse the available menu items and select what they'd like to order.

2. **Food Allergies & Dietary Restrictions**: Also ask if they have any allergies to nuts, dairy, gluten, shellfish, or any other ingredients. Ask about dietary preferences (vegetarian, vegan, etc.)

3. **Next Steps**: Let them know that once they select dishes from the menu, you'll help them customize their order.

Be friendly and guide them through the ordering process step by step.`;
      }

      // Call Llama API for order assistance
      const llamaResponse = await callLlamaAPI(orderPrompt);

      // Remove the processing message and add the actual response
      setMessages(prev => prev.slice(0, -1));
      addMessage(llamaResponse, false, 'text', undefined, true);
    } catch (error) {
      console.error('Error handling order request:', error);
      // Remove processing message
      setMessages(prev => prev.slice(0, -1));
      addMessage(
        '❌ Sorry, I encountered an error processing your order request. Please try again.',
        false,
        'text',
      );
    }
  };

  // Enhanced handleSend to detect order responses and keywords
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();

    // Add user message to chat
    addMessage(messageText, true, 'text');
    setInputText('');

    // Check if we're waiting for order responses and this looks like a response
    if (orderState.awaitingResponse && isOrderResponseMessage(messageText)) {
      try {
        // Store the user's response
        const updatedResponses = [
          ...(orderState.userResponses || []),
          messageText,
        ];
        setOrderState(prev => ({
          ...prev,
          userResponses: updatedResponses,
        }));

        // Check if user indicated no allergies and we should proceed with order
        if (
          isNoAllergiesResponse(messageText) &&
          orderState.selectedItems &&
          orderState.selectedItems.length > 0
        ) {
          // Show processing message
          addMessage(
            '👨‍🍳 Perfect! Creating detailed instructions for the chef and waiter...',
            false,
            'text',
          );

          // Combine all user responses
          const allPreferences = updatedResponses.join('\n\n');

          // Generate cooking instructions
          const cookingInstructions = await generateCookingInstructions(
            orderState.selectedItems,
            allPreferences,
          );

          // Remove processing message
          setMessages(prev => prev.slice(0, -1));

          // Add the cooking instructions
          addMessage(
            `## 👨‍🍳 **ORDER PROCESSING COMPLETE**\n\n${cookingInstructions}`,
            false,
            'text',
            undefined,
            true,
          );

          // Keep the selected items in case user wants to modify later
          setOrderState(prev => ({
            ...prev,
            awaitingResponse: false,
          }));
        } else if (orderState.selectedItems && updatedResponses.length > 0) {
          // If user provided specific allergies/customizations, still generate instructions
          // Show processing message
          addMessage(
            '👨‍🍳 Thank you for the details! Creating customized instructions for the chef and waiter...',
            false,
            'text',
          );

          // Combine all user responses
          const allPreferences = updatedResponses.join('\n\n');

          // Generate cooking instructions
          const cookingInstructions = await generateCookingInstructions(
            orderState.selectedItems,
            allPreferences,
          );

          // Remove processing message
          setMessages(prev => prev.slice(0, -1));

          // Add the cooking instructions
          addMessage(
            `## 👨‍🍳 **ORDER PROCESSING COMPLETE**\n\n${cookingInstructions}`,
            false,
            'text',
            undefined,
            true,
          );

          // Keep the selected items in case user wants to modify later
          setOrderState(prev => ({
            ...prev,
            awaitingResponse: false,
          }));
        } else {
          // Continue asking questions or provide acknowledgment
          const followUpPrompt = `The user responded to our order questions with: "${messageText}"

Based on their response and the conversation context, either:
1. Ask any follow-up questions needed to complete their order
2. If you have enough information, let them know we'll prepare their order instructions

Be conversational and ensure we have all necessary allergy and customization information.`;

          const followUpResponse = await callLlamaAPI(followUpPrompt);
          addMessage(followUpResponse, false, 'text', undefined, true);
        }
      } catch (error) {
        console.error('Error processing order response:', error);
        addMessage(
          '❌ Sorry, I encountered an error processing your order details. Please try again.',
          false,
          'text',
        );
      }
    }
    // Check if the message contains order keywords
    else if (containsOrderKeywords(messageText)) {
      console.log('🛒 Order keywords detected:', messageText);
      await handleOrderRequest(undefined, messageText);
    }
    // Check if the message contains external query keywords
    else if (containsExternalQueryKeywords(messageText)) {
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
      // Use Llama API for normal text chat
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

        // Show error message
        addMessage(
          '❌ Sorry, I encountered an error processing your message. Please try again.',
          false,
          'text',
        );
      }
    }
  };

  // Handle OpenAI Events wrapper - Updated to pass navigation and camera state
  const handleOpenAIEvent = (event: {data: string}) => {
    handleOpenAIEventFunc(
      event,
      addMessage,
      navigation, // Pass navigation
      false, // isCameraOpen - false since we're in main app
      undefined, // camera ref - not available in main app
      dataChannel, // Pass dataChannel for sending back to OpenAI
    );
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
  const handleAttachmentOption = async (option: string) => {
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

      case 'location':
        console.log('📍 Location option selected');
        try {
          // Show loading message
          addMessage('📍 Getting your location...', false, 'text');

          // Get location with user confirmation
          const locationMessage = await handleLocationSharing();

          // Remove loading message
          setMessages(prev => prev.slice(0, -1));

          // Add location as user message (since user is sharing their location)
          addMessage(locationMessage, true, 'text', undefined, true);

          // Add AI response about the location
          if (locationMessage.includes('Address:')) {
            // Extract address for AI context
            const addressMatch = locationMessage.match(
              /\*\*Address:\*\* (.+)\n/,
            );
            const address = addressMatch ? addressMatch[1] : 'your location';

            // Send to Llama for contextual response
            try {
              const contextPrompt = `The user shared their location: ${address}. Provide a helpful response acknowledging their location and offering relevant assistance (like nearby restaurants, weather, directions, etc.). Be conversational and helpful.`;

              addMessage('🤖 Analyzing your location...', false, 'text');
              const aiResponse = await callLlamaAPI(contextPrompt);

              // Remove analyzing message
              setMessages(prev => prev.slice(0, -1));

              // Add AI response with markdown
              addMessage(aiResponse, false, 'text', undefined, true);
            } catch (error) {
              console.error('Error getting AI response for location:', error);
              // Remove analyzing message
              setMessages(prev => prev.slice(0, -1));

              // Add simple acknowledgment
              addMessage(
                '📍 Thanks for sharing your location! I can help you find nearby places or provide directions if needed.',
                false,
                'text',
              );
            }
          }
        } catch (error) {
          console.error('Error handling location sharing:', error);

          // Remove loading message if it exists
          setMessages(prev => {
            if (prev[prev.length - 1]?.text.includes('Getting your location')) {
              return prev.slice(0, -1);
            }
            return prev;
          });

          // Show error message
          let errorMessage = '❌ Unable to get your location';
          if (error.message.includes('permission')) {
            errorMessage =
              '❌ Location permission denied. Please enable location access in your device settings.';
          } else if (error.message.includes('cancelled')) {
            errorMessage = '📍 Location sharing cancelled';
          } else if (error.message.includes('unavailable')) {
            errorMessage =
              '❌ Location unavailable. Please check your GPS settings.';
          } else if (error.message.includes('timeout')) {
            errorMessage = '❌ Location request timed out. Please try again.';
          }

          addMessage(errorMessage, false, 'text');
        }
        break;

      case 'document':
        console.log('Document selected');
        Alert.alert('Document', 'Document functionality coming soon!');
        break;

      default:
        console.log('Unknown option:', option);
    }
  };

  // Handle attachment press
  const handleAttachmentPress = () => {
    setAttachmentSheetVisible(prev => !prev);
  };

  // Copy message to clipboard
  const copyMessageToClipboard = (message: Message) => {
    // Vibrate to provide haptic feedback
    Vibration.vibrate(50);

    let textToCopy = message.text;

    // For external query messages, include additional data if available
    if (message.type === 'external_query' && message.externalData) {
      const {data, queryType} = message.externalData;

      // Add structured data to copied text
      textToCopy += '\n\n--- Additional Data ---\n';
      textToCopy += `Query Type: ${queryType}\n`;

      if (data && typeof data === 'object') {
        // Format the data nicely
        try {
          if (Array.isArray(data)) {
            data.forEach((item, index) => {
              textToCopy += `\n${index + 1}. `;
              if (typeof item === 'object') {
                Object.entries(item).forEach(([key, value]) => {
                  textToCopy += `${key}: ${value}, `;
                });
              } else {
                textToCopy += item;
              }
            });
          } else {
            Object.entries(data).forEach(([key, value]) => {
              textToCopy += `${key}: ${value}\n`;
            });
          }
        } catch (error) {
          textToCopy += JSON.stringify(data, null, 2);
        }
      }
    }

    // Copy to clipboard
    Clipboard.setString(textToCopy);

    // Show confirmation
    Alert.alert(
      'Copied!',
      'Message copied to clipboard',
      [{text: 'OK', style: 'default'}],
      {cancelable: true},
    );
  };

  // Show message options menu
  const showMessageOptions = (message: Message) => {
    const options = [
      {
        text: 'Copy Message',
        onPress: () => copyMessageToClipboard(message),
      },
    ];

    // Add additional options for external query messages
    if (message.type === 'external_query' && message.externalData) {
      options.push({
        text: 'Copy Data Only',
        onPress: () => {
          Vibration.vibrate(50);
          const dataText = JSON.stringify(message.externalData.data, null, 2);
          Clipboard.setString(dataText);
          Alert.alert('Copied!', 'Data copied to clipboard');
        },
      });
    }

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert(
      'Message Options',
      `${
        message.isUser ? 'Your' : 'AI'
      } message from ${message.timestamp.toLocaleTimeString()}`,
      options,
    );
  };

  // Render message item with markdown support and long press
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
          {/* Text message part with long press */}
          <TouchableOpacity
            style={[styles.messageContainer, styles.aiMessage]}
            onLongPress={() => showMessageOptions(item)}
            delayLongPress={500}
            activeOpacity={0.8}>
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
          </TouchableOpacity>

          {/* External query cards part */}
          {item.externalData && (
            <View style={styles.externalQueryCardsContainer}>
              <ExternalQueryCard
                data={item.externalData.data}
                queryType={item.externalData.queryType}
                onMoreDetails={(response: string) => {
                  // Add the response as a new AI message with proper formatting
                  addMessage(
                    response,
                    false,
                    'text',
                    undefined,
                    true, // Enable markdown for proper formatting
                  );
                }}
                onOrderSelected={(selectedItems: any[]) => {
                  // Handle order from menu card - use the centralized function
                  console.log(
                    '🛒 Order Selected button clicked with items:',
                    selectedItems,
                  );

                  // Store selected items for future reference
                  setOrderState(prev => ({
                    ...prev,
                    lastSelectedItems: selectedItems,
                  }));

                  handleOrderRequest(selectedItems);
                }}
              />
            </View>
          )}
        </View>
      );
    }

    // Regular message rendering with long press
    return (
      <TouchableOpacity
        style={[
          styles.messageContainer,
          item.isUser ? styles.userMessage : styles.aiMessage,
        ]}
        onLongPress={() => showMessageOptions(item)}
        delayLongPress={500}
        activeOpacity={0.8}>
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
      </TouchableOpacity>
    );
  };

  // Add this function after the other handler functions
  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages? This action cannot be undone.',

      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setOrderState({});
            messageCounter.current = 0;
            // Add a welcome message after clearing
            setTimeout(() => {
              addMessage(
                'Chat cleared! How can I help you today?',
                false,
                'text',
              );
            }, 100);

          },
        },
      ],
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Meta Hack</Text>
          <View style={styles.headerRight}>
            {/* Clear Chat Button */}
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearChat}
              activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>


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
          {messages.length === 0 ? (
            // Empty state when no messages
            <View style={styles.emptyStateContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyStateTitle}>No messages yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Start a conversation by typing a message or using voice chat
              </Text>
              <View style={styles.emptyStateFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="mic" size={20} color="#0081FB" />
                  <Text style={styles.featureText}>Voice Chat</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="camera" size={20} color="#0081FB" />
                  <Text style={styles.featureText}>Vision Analysis</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="location" size={20} color="#0081FB" />
                  <Text style={styles.featureText}>Location Sharing</Text>
                </View>
              </View>
            </View>
          ) : (
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
          )}
        </View>

        {/* Chat Input */}
        <ChatInput
          inputText={inputText}
          setInputText={setInputText}
          handleSend={handleSend}
          handleVoicePress={handleVoicePress}
          handleAttachmentPress={handleAttachmentPress}
          onAttachmentOption={handleAttachmentOption}
          onClearMessages={clearAllMessages} // Add this prop
          isRecording={isRecording}
          attachmentSheetVisible={attachmentSheetVisible}
          scrollToEnd={scrollToEnd}
          hasMessages={messages.length > 0} // Add this prop
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyStateFeatures: {
    alignItems: 'center',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 129, 251, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 140,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0081FB',
    marginLeft: 8,
  },
  messageContainer: {
    marginVertical: 5,
    padding: 12,
    borderRadius: 15,
    maxWidth: '95%',
    flexShrink: 1,
    alignSelf: 'flex-start',
    flex: 0,
    // Add subtle shadow for better touch feedback
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  clearButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
