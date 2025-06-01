import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import {PermissionsAndroid, Platform, Alert} from 'react-native';
import {CONFIG} from '../utils/rtcConfig';
import {RTC_CONFIGURATION, ConnectionStatus} from './webRTCTypes';
import RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel';

/**
 * Request audio permission (mainly for Android)
 */
export const requestAudioPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for voice chat.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Microphone permission granted');
        return true;
      } else {
        console.warn('Microphone permission denied');
        Alert.alert(
          'Permission Required',
          'Microphone permission is required for voice chat functionality.',
        );
        return false;
      }
    } catch (err) {
      console.error('Failed to request microphone permission', err);
      return false;
    }
  }
  return true; // iOS handles permissions automatically
};

/**
 * Get WebSocket secret key from OpenAI
 */
export const getOpenAIWebSocketSecretKey = async () => {
  try {
    const url = 'https://api.openai.com/v1/realtime/sessions';
    const body = {
      model: CONFIG.OPENAI_REALTIME_MODEL,
      voice: CONFIG.OPENAI_VOICE,
    };

    console.log('📡 Requesting OpenAI WebSocket key with model:', CONFIG.OPENAI_REALTIME_MODEL);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`Failed to fetch secret key: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting WebSocket key:', error);
    throw error;
  }
};

/**
 * Send SDP to OpenAI server
 */
export const sendSDPToServer = async (
  pc: RTCPeerConnection,
  offer: {sdp: any},
  clientSecret: string,
) => {
  console.log('Send SDP to service');
  const url = `https://api.openai.com/v1/realtime?model=${CONFIG.OPENAI_REALTIME_MODEL}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/sdp',
    },
    body: offer.sdp,
  });

  if (!response.ok) {
    throw new Error(`Failed to send SDP to server: ${response.statusText}`);
  }

  const remoteSDP = await response.text();
  console.log('Remote SDP received');

  const remoteDescription = new RTCSessionDescription({
    type: 'answer',
    sdp: remoteSDP,
  });
  await pc.setRemoteDescription(remoteDescription);
  console.log('Remote SDP set successfully');
};

/**
 * Connect WebSocket for WebRTC communication
 */
export const connectWebSocket = async (
  connectStatus: ConnectionStatus,
  setConnectStatus: (status: ConnectionStatus) => void,
  setPeerConnection: (pc: RTCPeerConnection | null) => void,
  setDataChannel: (channel: RTCDataChannel | null) => void,
  localStreamRef: React.MutableRefObject<MediaStream | null>,
  handleOpenAIEvent: (event: {data: string}) => void,
  addMessage: (text: string, isUser: boolean, type?: 'text' | 'audio') => void,
) => {
  console.log('🔌 connectWebSocket called! Current status:', connectStatus);
  
  if (connectStatus !== 'notConnect') {
    console.log('⚠️ Already connecting or connected, ignoring request');
    return;
  }

  setConnectStatus('connecting');
//   addMessage('🔵 Connecting to AI assistant...', false, 'text');

  try {
    // Request audio permission first
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      console.log('❌ No microphone permission');
      setConnectStatus('notConnect');
      addMessage(
        '❌ Microphone permission required for voice chat',
        false,
        'text',
      );
      return;
    }

    // 1. Get WebSocket key
    console.log('1. Getting WebSocket key...');
    const secretDict = await getOpenAIWebSocketSecretKey();
    console.log('Secret Key received');

    // 2. Init RTCPeerConnection
    console.log('2. Init RTCPeerConnection');
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);

    // 3. Setup local audio
    console.log('3. Setup local audio');
    const localStream = await mediaDevices.getUserMedia({audio: true});

    if (!localStream || localStream.getTracks().length === 0) {
      console.error('No audio tracks found in the local stream');
      setConnectStatus('notConnect');
      addMessage('❌ Failed to access microphone', false, 'text');
      return;
    }

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    localStreamRef.current = localStream;

    pc.ontrack = (event: {streams: any[]}) => {
      console.log('Remote audio track received:', event.streams[0]);
      if (event.streams[0]) {
        InCallManager.start({media: 'audio'});
        InCallManager.setSpeakerphoneOn(true);
      }
    };

    // 4. Create data channel
    console.log('4. Create data channel');
    const channel = pc.createDataChannel('oai-events', {ordered: true});

    channel.onopen = () => {
      console.log('Data channel is open');
      // Send session configuration
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions:
            'You are Meta Hack developed during NYC LLamaCon 2025, a helpful AI vision assistant. Be conversational and helpful. if user asks about location, restaurants, shops, products, or weather, just answer "I will check {add user question} and get back to you soon", If user asks about "what am I looking it at, do you see what I see, How about now, what is this picture, what do you see, can you tell me what ypu see" Just answer, "Hang on, let me put on my meta glass or give me a sec, let me put on my meta glasses.',
          voice: CONFIG.OPENAI_VOICE || 'ash',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1',
          },
        },
      };

      console.log('Sending session update');
      channel.send(JSON.stringify(sessionUpdate));
    };

    channel.onmessage = event => {
      console.log('Received message from data channel');
      handleOpenAIEvent(event);
    };

    channel.onerror = error => {
      console.error('Data channel error:', error);
      addMessage('❌ Data channel error', false, 'text');
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      setConnectStatus('notConnect');
    };

    setPeerConnection(pc);
    setDataChannel(channel);

    // 5. Create SDP Offer
    console.log('5. Create SDP Offer and connect backend');
    let sessionConstraints = {
      mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: false,
        VoiceActivityDetection: true,
      },
    };
    const offer = await pc.createOffer(sessionConstraints);

    if (!offer.sdp || !offer.sdp.includes('m=audio')) {
      console.error('Invalid SDP Offer, missing audio track:', offer.sdp);
      setConnectStatus('notConnect');
      addMessage('❌ Failed to create audio connection', false, 'text');
      return;
    }

    // 6. Set Local Description
    console.log('6. Set Local Description');
    try {
      const rsd = new RTCSessionDescription(offer);
      await pc.setLocalDescription(rsd);
      console.log('Local description set successfully');
    } catch (error) {
      console.error('Error setting local description:', error);
      setConnectStatus('notConnect');
      addMessage('❌ Connection failed', false, 'text');
      return;
    }

    // 7. Send SDP to Open AI
    console.log('7. Send SDP to Open AI');
    const clientSecret = secretDict?.client_secret?.value;
    if (clientSecret) {
      await sendSDPToServer(pc, offer, clientSecret);
      setConnectStatus('connected');
    } else {
      console.error('Client secret is missing');
      setConnectStatus('notConnect');
      addMessage('❌ Authentication failed', false, 'text');
    }
  } catch (error) {
    console.error('Error during WebRTC connection:', error);
    setConnectStatus('notConnect');
    addMessage('❌ Connection error: ' + (error as Error).message, false, 'text');
  }
};

/**
 * Disconnect WebSocket
 */
export const disconnectWebSocket = async (
  peerConnection: RTCPeerConnection | null,
  dataChannel: RTCDataChannel | null,
  localStreamRef: React.MutableRefObject<MediaStream | null>,
  setConnectStatus: (status: ConnectionStatus) => void,
  setPeerConnection: (pc: RTCPeerConnection | null) => void,
  setDataChannel: (channel: RTCDataChannel | null) => void,
  addMessage: (text: string, isUser: boolean, type?: 'text' | 'audio') => void,
) => {
  try {
    console.log('Disconnecting WebRTC...');

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Close data channel
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    // Stop audio manager
    InCallManager.stop();

    setConnectStatus('notConnect');
  } catch (error) {
    console.error('Error disconnecting WebRTC:', error);
    addMessage('❌ Error disconnecting: ' + (error as Error).message, false, 'text');
  }
};

/**
 * Handle OpenAI Events and auto-trigger camera for vision requests
 */
export const handleOpenAIEvent = (
  event: {data: string},
  addMessage: (text: string, isUser: boolean, type?: 'text' | 'audio') => void,
  navigation?: any,
  isCameraOpen?: boolean,
  camera?: React.RefObject<any>,
  dataChannel?: RTCDataChannel | null,
) => {
  try {
    const eventData = JSON.parse(event.data);
    console.log('OpenAI Event:', eventData.type);

    switch (eventData.type) {
      case 'response.audio_transcript.delta':
        // Handle audio transcript for vision responses
        console.log('🎵 Audio transcript delta:', eventData.delta);
        break;

      case 'response.audio_transcript.done':
        console.log('🎵 Audio transcript complete:', eventData.transcript);
        // Add the transcript as a message so user can see what OpenAI said
        if (eventData.transcript) {
          addMessage(`🔊 ${eventData.transcript}`, false, 'audio');
        }
        break;

      case 'response.audio.delta':
        // Handle audio response chunks from vision analysis
        console.log('🎵 Receiving audio response chunk for vision analysis');
        break;

      case 'response.audio.done':
        console.log('🎵 Audio response complete for vision analysis');
        break;

      case 'response.done':
        console.log('✅ Vision analysis response complete');
        // Log the full response for debugging
        if (eventData.response) {
          console.log('📋 Full response:', JSON.stringify(eventData.response, null, 2));
        }
        break;

      case 'response.output_audio.delta':
        // Handle audio output for vision responses
        console.log('🔊 Playing vision analysis audio response chunk');
        break;

      case 'response.output_audio.done':
        console.log('🔊 Vision analysis audio playback complete');
        break;

      case 'output_audio_buffer.stopped':
        console.log('🔊 Audio output buffer stopped');
        break;

      case 'response.text.delta':
        // Handle text response (backup for audio)
        if (eventData.delta) {
          console.log('📝 Text response delta:', eventData.delta);
        }
        break;

      case 'response.text.done':
        console.log('📝 Text response complete');
        if (eventData.text) {
          addMessage(eventData.text, false, 'text');
        }
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 User started speaking');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 User stopped speaking');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const transcript = eventData.transcript;
        console.log('🎤 User said:', transcript);
        
        // Check for vision requests in the transcript
        if (containsVisionKeywords(transcript)) {
          console.log('🥽 Vision request detected in audio!');
          handleVisionRequest(navigation, isCameraOpen, camera, dataChannel, addMessage);
        }
        
        addMessage(transcript, true, 'audio');
        break;

      case 'conversation.item.created':
        console.log('📝 Conversation item created:', eventData.item?.type);
        break;

      case 'response.created':
        console.log('🎯 Response created for vision analysis');
        break;

      case 'response.output_audio.speech_started':
        console.log('🗣️ OpenAI started speaking (vision response)');
        break;

      case 'response.output_audio.speech_stopped':
        console.log('🔇 OpenAI stopped speaking (vision response)');
        break;

      case 'error':
        console.error('❌ OpenAI Error:', eventData.error);
        addMessage(`Error: ${eventData.error.message}`, false, 'text');
        break;

      default:
        console.log('🔄 Unhandled event:', eventData.type, eventData);
        break;
    }
  } catch (error) {
    console.error('Error parsing OpenAI event:', error);
  }
};

/**
 * Check if text contains vision-related keywords
 */
const containsVisionKeywords = (text: string): boolean => {
  const visionKeywords = [
    'what am i looking at',
    'what do you see',
    'describe what you see',
    'look at this',
    'what is this',
    'can you see',
    'take a look',
    'show you something',
    'what\'s in front of me',
    'analyze this image',
    'tell me what you see',
    'describe the scene',
    'what\'s happening here',
  ];

  const textLower = text.toLowerCase();
  return visionKeywords.some(keyword => textLower.includes(keyword));
};

/**
 * Handle vision request - take snapshot or open camera
 */
const handleVisionRequest = async (
  navigation?: any,
  isCameraOpen?: boolean,
  camera?: React.RefObject<any>,
  dataChannel?: RTCDataChannel | null,
  addMessage?: (text: string, isUser: boolean, type?: 'text' | 'audio') => void,
) => {
  console.log('🥽 Processing vision request...', { isCameraOpen, hasNavigation: !!navigation, hasCamera: !!camera });
  
  if (isCameraOpen && camera?.current) {
    // Camera is open, take snapshot and analyze
    console.log('📸 Camera is open, taking snapshot...');
    await takeSnapshotAndAnalyze(camera, dataChannel, addMessage);
  } else if (navigation) {
    // Camera is not open, navigate to camera
    console.log('📱 Camera not open, opening camera...');
    navigation.navigate('Camera', {
      autoVisionMode: true, // Flag to indicate this is for vision analysis
      webRTCState: {
        dataChannel, // Pass the dataChannel
        connectStatus: 'connected', // Assume connected if we're handling vision request
      },
      webRTCHandlers: {
        addMessage, // Pass addMessage function to camera
      },
    });
  } else {
    console.warn('⚠️ Cannot handle vision request - no navigation or camera available');
  }
};

/**
 * Take snapshot and send to Llama for analysis
 */
const takeSnapshotAndAnalyze = async (
  camera: React.RefObject<any>,
  dataChannel: RTCDataChannel | null,
  addMessage?: (text: string, isUser: boolean, type?: 'text' | 'audio') => void,
) => {
  try {
    console.log('📸 Taking snapshot for vision analysis...');
    
    // Add message indicating vision analysis is starting
    if (addMessage) {
      addMessage('📸 Taking a look at what you\'re seeing...', false, 'text');
    }
    
    // Take photo
    const photo = await camera.current.takePhoto({
      qualityPrioritization: 'speed',
      flash: 'off',
      enableAutoRedEyeReduction: false,
    });

    console.log('📸 Snapshot taken:', photo.path);
    
    // Convert to base64
    const RNFS = require('react-native-fs');
    const base64String = await RNFS.readFile(photo.path, 'base64');
    
    // Add message indicating analysis is in progress
    if (addMessage) {
      addMessage('🔍 Analyzing the image...', false, 'text');
    }
    
    // Send to Llama for analysis
    const description = await analyzeImageWithLlama(base64String);
    
    // Add the vision analysis result to chat messages
    if (addMessage) {
      addMessage(`👁️ **Vision Analysis:**\n${description}`, false, 'text');
    }
    
    // Send description back to OpenAI WebRTC
    if (dataChannel && dataChannel.readyState === 'open') {
      const visionMessage = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `I'm looking at something and here's what I can see: ${description}. Please tell me about what you think I'm looking at using your voice, and provide any relevant information or insights about it.`,
            },
          ],
        },
      };
      
      console.log('🔗 Sending vision analysis to OpenAI WebRTC');
      dataChannel.send(JSON.stringify(visionMessage));
      
      // Small delay to ensure message is processed
      setTimeout(() => {
        // Create response with voice output
        const responseConfig = {
          type: 'response.create',
          response: {
            modalities: ['audio'], // Only audio for voice response
            instructions: `You are helping a user understand what they're looking at. Based on the image description provided, give a helpful, conversational voice response about what you think they're seeing. Be descriptive but natural in your speech. The image description is: "${description}"`,
            voice: 'alloy',
            output_audio_format: 'pcm16',
            max_output_tokens: 200,
            temperature: 0.7,
          },
        };

        console.log('🎙️ Requesting voice response from OpenAI');
        dataChannel.send(JSON.stringify(responseConfig));
      }, 500);
    }
    
    // Clean up the temporary photo
    await RNFS.unlink(photo.path);
    console.log('🧹 Temporary photo cleaned up');
    
  } catch (error) {
    console.error('💥 Error in takeSnapshotAndAnalyze:', error);
    
    if (addMessage) {
      addMessage('❌ Error analyzing image: ' + error.message, false, 'text');
    }
  }
};

/**
 * Analyze image with Llama API for vision description
 */
const analyzeImageWithLlama = async (base64Image: string): Promise<string> => {
  try {
    console.log('🦙 Analyzing image with Llama...');
    
    const messageContent = [
      {
        type: 'text',
        text: 'Describe what you see in this image in a concise, natural way. Focus on the main objects, people, scene, and any text visible. Keep it under 100 words.',
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`,
        },
      },
    ];

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
              'You are a helpful vision assistant. Describe images clearly and concisely.',
          },
          {
            role: 'user',
            content: messageContent,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Llama API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    let description = '';
    if (data.completion_message?.content?.text) {
      description = data.completion_message.content.text.trim();
    } else if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      description = data.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response format from Llama API');
    }
    
    console.log('🦙 Image analysis complete:', description);
    return description;
    
  } catch (error) {
    console.error('💥 Error analyzing image with Llama:', error);
    return 'I can see an image, but I encountered an error analyzing it.';
  }
};