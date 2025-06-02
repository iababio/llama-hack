import React, {useEffect, useState, useRef} from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import {useSharedValue} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  useCameraDevices,
  useFrameProcessor,
} from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import {Label} from './Label';
import {CONFIG} from '../../utils/rtcConfig';

const {width, height} = Dimensions.get('window');

interface CameraScreenProps {
  navigation: any;
  route: any;
}

interface CapturedPhoto {
  path: string;
  timestamp: number;
}

export default function CameraScreen({navigation, route}: CameraScreenProps) {
  // Get WebRTC state and handlers from route params
  const webRTCState = route?.params?.webRTCState || {};
  const webRTCHandlers = route?.params?.webRTCHandlers || {};
  const autoVisionMode = route?.params?.autoVisionMode || false; // New flag

  const {connectStatus = 'notConnect', dataChannel} = webRTCState;

  const {handleOpenAIEvent = () => {}, addMessage = () => {}} = webRTCHandlers;

  // Camera states - ALL useState hooks must be at the top
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [outputText, setOutputText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isAutoVisionProcessing, setIsAutoVisionProcessing] = useState(false);

  // ALL useRef hooks must be together
  const camera = useRef<Camera>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const captureAnim = useRef(new Animated.Value(1)).current;
  const previewAnim = useRef(new Animated.Value(0)).current;

  // Shared values
  const currentLabel = useSharedValue('');

  // Camera devices
  const devices = useCameraDevices();
  const device = devices.back || devices.front || Object.values(devices)[0];

  // Frame processor
  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';

      try {
        // Simulate a label detection process
        const labels = [
          'Object detected',
          'Motion detected',
          'Frame processed',
        ];
        const randomLabel = labels[Math.floor(Math.random() * labels.length)];

        // Update the shared value with the detected label
        currentLabel.value = randomLabel;
      } catch (error) {
        console.log('Frame processor error:', error);
      }
    },
    [currentLabel],
  );

  // ALL useEffect hooks must be together and not conditional
  // 1. Permission request effect
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        console.log('Requesting camera permission...');
        const cameraPermission = await Camera.requestCameraPermission();
        console.log('Camera permission result:', cameraPermission);

        console.log('Requesting microphone permission...');
        const microphonePermission = await Camera.requestMicrophonePermission();
        console.log('Microphone permission result:', microphonePermission);

        setHasPermission(cameraPermission === 'granted');
      } catch (error) {
        console.error('Permission request failed:', error);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    requestPermissions();
  }, []);

  // 2. Animation effect for connection status
  useEffect(() => {
    if (connectStatus === 'connecting') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();
    } else if (connectStatus === 'connected') {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [connectStatus, pulseAnim, rotateAnim]);

  // 3. Auto-vision mode effect - MOVED here to maintain hook order
  useEffect(() => {
    if (
      autoVisionMode &&
      device &&
      hasPermission &&
      !isLoading &&
      camera.current &&
      !isAutoVisionProcessing
    ) {
      console.log(
        '🥽 Auto vision mode detected - taking snapshot in 2 seconds...',
      );

      // Give camera a moment to initialize, then take snapshot
      const timer = setTimeout(() => {
        handleAutoVisionSnapshot();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [
    autoVisionMode,
    device,
    hasPermission,
    isLoading,
    isAutoVisionProcessing,
  ]);

  // Handle back button press
  const handleBackPress = () => {
    navigation?.goBack();
  };

  // Handle automatic vision snapshot
  const handleAutoVisionSnapshot = async () => {
    if (!camera.current || isAutoVisionProcessing) {
      return;
    }

    try {
      setIsAutoVisionProcessing(true);
      console.log('📸 Taking automatic snapshot for vision analysis...');

      // Add message to chat indicating vision analysis is starting
      if (addMessage) {
        addMessage("📸 Looking at what you're seeing...", false, 'text');
      }

      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
        enableAutoRedEyeReduction: false,
      });

      console.log('📸 Auto snapshot taken:', photo.path);

      // Add message indicating analysis is in progress
      if (addMessage) {
        addMessage('🔍 Analyzing the image with AI vision...', false, 'text');
      }

      // Convert to base64
      const base64String = await RNFS.readFile(photo.path, 'base64');

      // Analyze with Llama
      const description = await analyzeImageWithLlama(base64String);

      console.log('🦙 Vision analysis complete:', description);

      // Add the vision analysis result to chat messages
      if (addMessage) {
        addMessage(
          `👁️ **Vision Analysis:**\n\n${description}\n\n*Now asking OpenAI to provide voice insights...*`,
          false,
          'text',
        );
      }

      // Send description back to OpenAI WebRTC with proper voice configuration
      if (dataChannel && dataChannel.readyState === 'open') {
        console.log(
          '🔗 Sending vision analysis to OpenAI WebRTC for voice response',
        );

        // Create the conversation item with the vision description
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

        console.log('📤 Sending vision message');
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
      } else {
        console.error('❌ DataChannel not available for voice response');
      }

      // Clean up the temporary photo
      await RNFS.unlink(photo.path);
      console.log('🧹 Temporary photo cleaned up');

      // Navigate back after analysis with longer delay for voice response
      setTimeout(() => {
        navigation?.goBack();
      }, 2000); // Longer delay to allow for voice response
    } catch (error) {
      console.error('💥 Error in auto vision snapshot:', error);

      // Add error message to chat
      if (addMessage) {
        addMessage('❌ Error analyzing image: ' + error.message, false, 'text');
      }

      // Fallback message to OpenAI with voice response
      if (dataChannel && dataChannel.readyState === 'open') {
        const errorMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: "I tried to analyze what I'm looking at but encountered an error with the camera. Can you help me troubleshoot this?",
              },
            ],
          },
        };

        dataChannel.send(JSON.stringify(errorMessage));

        setTimeout(() => {
          const errorResponseConfig = {
            type: 'response.create',
            response: {
              modalities: ['audio'],
              instructions:
                'The user had trouble with their camera analysis. Respond helpfully using your voice.',
              voice: 'alloy',
              output_audio_format: 'pcm16',
              max_output_tokens: 100,
              temperature: 0.5,
            },
          };

          dataChannel.send(JSON.stringify(errorResponseConfig));
        }, 300);
      }

      // Navigate back even on error
      setTimeout(() => {
        navigation?.goBack();
      }, 2000);
    } finally {
      setIsAutoVisionProcessing(false);
    }
  };

  // Analyze image with Llama API for vision description
  const analyzeImageWithLlama = async (
    base64Image: string,
  ): Promise<string> => {
    try {
      console.log('🦙 Analyzing image with Llama...');

      const messageContent = [
        {
          type: 'text',
          text: 'Describe what you see in this image in a concise, natural way. Focus on the main objects, people, scene, and any text visible. Keep it under 100 words and be conversational.',
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
                'You are a helpful vision assistant. Describe images clearly and concisely in a conversational tone.',
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
        throw new Error(
          `Llama API request failed with status ${response.status}`,
        );
      }

      const data = await response.json();

      let description = '';
      if (data.completion_message?.content?.text) {
        description = data.completion_message.content.text.trim();
      } else if (
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message
      ) {
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

  // Handle picture capture - now takes 1 snapshot
  const handleTakePicture = async () => {
    if (!camera.current || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);

      // Animate capture button
      Animated.sequence([
        Animated.timing(captureAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(captureAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      console.log('Taking 1 snapshot...');

      try {
        const photo = await camera.current.takePhoto({
          qualityPrioritization: 'speed',
          flash: 'off',
          enableAutoRedEyeReduction: false,
        });

        const capturedPhoto: CapturedPhoto = {
          path: photo.path,
          timestamp: Date.now(),
        };

        setCapturedPhotos([capturedPhoto]);
        setShowPreview(true);

        // Animate preview in
        Animated.timing(previewAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        console.log('Successfully captured photo:', photo.path);
      } catch (photoError) {
        console.error('Failed to take photo:', photoError);
        Alert.alert('Error', 'Failed to take photo');
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setIsCapturing(false);
    }
  };

  // Convert image to base64
  const imageToBase64 = async (imagePath: string): Promise<string> => {
    try {
      const base64String = await RNFS.readFile(imagePath, 'base64');
      return base64String;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  // Send images to Llama API - use same structure as App.tsx
  const sendImagesToLlama = async (imagePaths: string[]): Promise<string> => {
    try {
      setIsProcessingImages(true);
      console.log('🚀 Starting image analysis...');

      // Log CONFIG values (without exposing sensitive data)
      console.log('CONFIG check:', {
        hasUrl: !!CONFIG.LLAMA_API_URL,
        hasKey: !!CONFIG.LLAMA_API_KEY,
        hasModel: !!CONFIG.LLAMA_MODEL,
        urlLength: CONFIG.LLAMA_API_URL?.length || 0,
        keyLength: CONFIG.LLAMA_API_KEY?.length || 0,
      });

      // Validate CONFIG
      if (!CONFIG.LLAMA_API_URL) {
        throw new Error('LLAMA_API_URL is not configured in CONFIG');
      }
      if (!CONFIG.LLAMA_API_KEY) {
        throw new Error('LLAMA_API_KEY is not configured in CONFIG');
      }
      if (!CONFIG.LLAMA_MODEL) {
        throw new Error('LLAMA_MODEL is not configured in CONFIG');
      }

      // Convert image to base64
      console.log('📷 Converting image to base64...');
      const base64Images = await Promise.all(
        imagePaths.map(async (path, index) => {
          console.log(`Converting image ${index + 1}:`, path);
          const result = await imageToBase64(path);
          console.log(
            `Image ${index + 1} converted, size: ${result.length} chars`,
          );
          return result;
        }),
      );

      // Prepare message content exactly like App.tsx
      let messageContent: any;

      if (base64Images.length > 0) {
        messageContent = [
          {
            type: 'text',
            text: `
# Foreign Menu Parser System Prompt

You are a specialized menu parsing assistant. When a user uploads an image of a menu with foreign prices, your task is to extract and structure the menu information into a clean JSON format.

## Instructions:

1. **Analyze the uploaded menu image** carefully to identify:
   - Menu items with their original foreign language names
   - Prices in the foreign currency
   - Any descriptions or details about the items

2. **Convert the information** into a JSON structure with the following exact format:

'''json
{
  "menu_items": [
    {
      "item_name_foreign": "Original name in foreign language",
      "item_name_english": "Translated name in English",
      "price_foreign_currency": "Original price with currency symbol",
      "price_usd": "Converted price in USD"
    }
  ],
  "currency_detected": "Currency code (e.g., EUR, JPY, GBP)",
  "exchange_rate_used": "Current exchange rate applied",
  "last_updated": "Current date"
}
"""

## Guidelines:

- **Language Detection**: Automatically detect the menu's language and provide accurate English translations
- **Currency Conversion**: Use current exchange rates to convert prices to USD (round to 2 decimal places)
- **Item Names**: Preserve the original foreign name exactly as written, and provide clear, appetizing English translations
- **Price Format**: Include currency symbols and maintain original formatting for foreign prices
- **Completeness**: Extract ALL visible menu items, don't skip items due to image quality unless completely unreadable
- **Categories**: If the menu has sections (appetizers, mains, desserts), maintain the order but don't create separate categories in the JSON
- **Special Characters**: Preserve accent marks and special characters in foreign language names
- **Descriptions**: If items have descriptions, incorporate key details into the English translation

## Error Handling:

- If text is unclear or unreadable, use "UNCLEAR_TEXT" as a placeholder
- If currency cannot be detected, ask the user to specify the currency
- If exchange rates cannot be determined, note this in the response and ask user to specify

## Response Format:

Provide only the clean JSON output without additional commentary, unless clarification is needed about unclear elements in the image.
            `,
          },
          ...base64Images.map(base64Image => ({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          })),
        ];
      } else {
        throw new Error('No images to process');
      }

      console.log('🌐 Making API call...');
      console.log('URL:', CONFIG.LLAMA_API_URL);
      console.log('Model:', CONFIG.LLAMA_MODEL);
      console.log('Content items:', messageContent.length);

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

      console.log('📡 Response status:', response.status);
      console.log(
        '📡 Response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);

        // Parse error details
        let errorDetails = `Status: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorDetails += `\nError: ${
              errorJson.error.message || errorJson.error
            }`;
          }
        } catch (parseError) {
          errorDetails += `\nRaw response: ${errorText}`;
        }

        // Provide specific error messages
        if (response.status === 401) {
          throw new Error(
            `Authentication failed. Check your API key.\n\n${errorDetails}`,
          );
        } else if (response.status === 429) {
          throw new Error(
            `Rate limit exceeded. Try again later.\n\n${errorDetails}`,
          );
        } else if (response.status === 400) {
          throw new Error(
            `Bad request. Check your model name and request format.\n\n${errorDetails}`,
          );
        } else {
          throw new Error(`API request failed.\n\n${errorDetails}`);
        }
      }

      const data = await response.json();
      console.log('✅ API Response received:', JSON.stringify(data, null, 2));

      // Use exact same response parsing as App.tsx
      if (data.completion_message?.content?.text) {
        console.log('Using completion_message format');
        return data.completion_message.content.text.trim();
      } else if (
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message
      ) {
        console.log('Using OpenAI choices format');
        return data.choices[0].message.content.trim();
      } else {
        console.error('❌ Unexpected response format:', data);
        throw new Error(
          `Invalid response format from Llama API.\n\nResponse: ${JSON.stringify(
            data,
            null,
            2,
          )}`,
        );
      }
    } catch (error) {
      console.error('💥 Error in sendImagesToLlama:', error);

      // Enhanced error handling
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Network error. Check your internet connection.\n\nDetails: ${error.message}`,
        );
      } else if (error.message.includes('CONFIG')) {
        throw new Error(
          `Configuration error: ${error.message}\n\nPlease check your rtcConfig.ts file.`,
        );
      } else {
        throw error;
      }
    } finally {
      setIsProcessingImages(false);
    }
  };

  // Process captured photo and send to Llama - updated to handle menu data
  const processAndSendImages = async () => {
    if (capturedPhotos.length === 0) {
      Alert.alert('Error', 'No photo to process');
      return;
    }

    try {
      const imagePaths = capturedPhotos.map(photo => photo.path);
      console.log('🎯 Processing image:', imagePaths[0]);

      const llamaResponse = await sendImagesToLlama(imagePaths);
      console.log('✅ Received Llama response:', llamaResponse);

      // Try to parse the response as JSON (for menu data)
      let isMenuData = false;
      let parsedMenuData = null;

      try {
        // Check if response contains JSON
        const jsonMatch = llamaResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedMenuData = JSON.parse(jsonMatch[1]);
          if (
            parsedMenuData.menu_items &&
            Array.isArray(parsedMenuData.menu_items)
          ) {
            isMenuData = true;
          }
        }
      } catch (parseError) {
        console.log('Response is not JSON menu data, treating as regular text');
      }

      if (isMenuData && parsedMenuData) {
        // Add menu data as external query with the parsed JSON
        addMessage(
          '📋 Menu Analysis Complete',
          false,
          'external_query',
          {
            data: parsedMenuData,
            queryType: 'restaurant',
          },
          false,
        );
      } else {
        // Add regular text response with markdown support
        addMessage(llamaResponse, false, 'text', undefined, true);
      }

      // Show success and navigate back
      Alert.alert('Success', 'Image analyzed successfully!', [
        {
          text: 'OK',
          onPress: () => {
            clearPhotos();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('💥 Error processing image:', error);

      // Show the actual error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert('Image Analysis Failed', errorMessage);
    }
  };

  // Close preview
  const closePreview = () => {
    Animated.timing(previewAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowPreview(false);
      setCapturedPhotos([]);
    });
  };

  // Clear all photos
  const clearPhotos = () => {
    setCapturedPhotos([]);
    closePreview();
  };

  // Show loading while checking permissions
  if (isLoading) {
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.statusText}>Requesting camera permissions...</Text>
      </View>
    );
  }

  // Show error if no permission
  if (!hasPermission) {
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden />
        <Text style={styles.statusText}>Camera permission denied</Text>
        <Text style={styles.statusText}>
          Please enable camera access in Settings
        </Text>
      </View>
    );
  }

  // Show error if no device found
  if (!device) {
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar hidden />
        <Text style={styles.statusText}>No camera device found</Text>
        <Text style={styles.statusText}>
          Available devices: {Object.keys(devices).join(', ')}
        </Text>
        <Text style={styles.statusText}>Please check camera hardware</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      {/* Full Screen Camera Background */}
      <Camera
        ref={camera}
        style={styles.fullScreenCamera}
        device={device}
        isActive={!showPreview}
        frameProcessor={frameProcessor}
        frameProcessorFps={3}
        photo={true}
      />

      {/* Minimal Overlay UI */}
      <View style={styles.overlay}>
        {/* Top Left Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>

        {/* Auto Vision Processing Indicator */}
        {isAutoVisionProcessing && (
          <View style={styles.autoVisionIndicator}>
            <ActivityIndicator size="large" color="#0081FB" />
            <Text style={styles.autoVisionText}>
              🥽 Analyzing what you're looking at...
            </Text>
          </View>
        )}

        {/* Center Vision Labels */}
        {!showPreview && !isAutoVisionProcessing && (
          <Label sharedValue={currentLabel} />
        )}

        {/* Bottom Camera Controls - Hide during auto vision processing */}
        {!showPreview && !isAutoVisionProcessing && (
          <View style={styles.bottomCameraControls}>
            {/* Capture Button - updated text */}
            <Animated.View
              style={[
                styles.captureButtonContainer,
                {
                  transform: [{scale: captureAnim}],
                },
              ]}>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  isCapturing && styles.captureButtonDisabled,
                ]}
                onPress={handleTakePicture}
                disabled={isCapturing}>
                {isCapturing ? (
                  <View style={styles.capturingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.capturingText}>Capturing...</Text>
                  </View>
                ) : (
                  <View style={styles.captureIconContainer}>
                    <Ionicons name="camera" size={32} color="white" />
                    <Text style={styles.captureText}>Capture</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Photo Preview Overlay - updated for single photo */}
        {showPreview && (
          <Animated.View
            style={[
              styles.previewOverlay,
              {
                opacity: previewAnim,
                transform: [
                  {
                    scale: previewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Photo Captured</Text>
              <TouchableOpacity
                style={styles.closePreviewButton}
                onPress={closePreview}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.singlePhotoContainer}>
              {capturedPhotos.length > 0 && (
                <Image
                  source={{uri: `file://${capturedPhotos[0].path}`}}
                  style={styles.singlePreviewImage}
                  resizeMode="cover"
                />
              )}
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={clearPhotos}
                disabled={isProcessingImages}>
                <Ionicons name="trash" size={20} color="white" />
                <Text style={styles.actionText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.retakeButton]}
                onPress={closePreview}
                disabled={isProcessingImages}>
                <Ionicons name="camera" size={20} color="white" />
                <Text style={styles.actionText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.sendButton,
                  isProcessingImages && styles.sendButtonDisabled,
                ]}
                onPress={processAndSendImages}
                disabled={isProcessingImages}>
                {isProcessingImages ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.actionText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="white" />
                    <Text style={styles.actionText}>Analyze</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Bottom Response Area - Only show when connected and response exists */}
        {connectStatus === 'connected' && outputText && !showPreview && (
          <View style={styles.bottomControls}>
            <View style={styles.responseContainer}>
              <Text style={styles.responseText}>{outputText}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  fullScreenCamera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomCameraControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  captureButtonContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  capturingContainer: {
    alignItems: 'center',
  },
  capturingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  captureIconContainer: {
    alignItems: 'center',
  },
  captureText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 2000,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  previewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  closePreviewButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  singlePhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  singlePreviewImage: {
    width: width * 0.85,
    height: height * 0.6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 50,
    paddingTop: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
  },
  sendButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 200,
    left: 20,
    right: 20,
  },
  responseContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    maxHeight: 120,
  },
  responseText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
  },
  autoVisionIndicator: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    marginHorizontal: 40,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  autoVisionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
});
