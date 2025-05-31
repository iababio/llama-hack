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
  ScrollView,
  Dimensions,
} from 'react-native';
import {useSharedValue} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  useCameraDevices,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {Label} from './Label';

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

  const {
    connectStatus = 'notConnect',
    peerConnection = null,
    dataChannel = null,
    localStreamRef = null,
  } = webRTCState;

  const {handleOpenAIEvent = () => {}, addMessage = () => {}} = webRTCHandlers;

  // Camera states
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [outputText, setOutputText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const currentLabel = useSharedValue('');

  // Animation states
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const captureAnim = useRef(new Animated.Value(1)).current;
  const previewAnim = useRef(new Animated.Value(0)).current;

  const devices = useCameraDevices();
  const device = devices.back || devices.front || Object.values(devices)[0];
  const camera = useRef<Camera>(null);

  // Handle back button press
  const handleBackPress = () => {
    // Don't disconnect WebRTC here since it's managed by App component
    navigation?.goBack();
  };

  // Start animations based on connection status
  useEffect(() => {
    if (connectStatus === 'connecting') {
      // Rotating animation while connecting
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
  }, [connectStatus]);


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

  
  // Handle picture capture - now takes 4 snapshots
  const handleTakePicture = async () => {
    if (!camera.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const photos: CapturedPhoto[] = [];
      
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

      console.log('Taking 4 snapshots...');
      
      // Take 4 photos with small delay between each
      for (let i = 0; i < 4; i++) {
        try {
          const photo = await camera.current.takePhoto({
            qualityPrioritization: 'speed',
            flash: 'off',
            enableAutoRedEyeReduction: false,
          });

          photos.push({
            path: photo.path,
            timestamp: Date.now() + i,
          });

          console.log(`Photo ${i + 1}/4 taken:`, photo.path);
          
          // Small delay between shots (except for the last one)
          if (i < 3) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (photoError) {
          console.error(`Failed to take photo ${i + 1}:`, photoError);
        }
      }

      if (photos.length > 0) {
        setCapturedPhotos(photos);
        setShowPreview(true);
        
        // Animate preview in
        Animated.timing(previewAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        console.log(`Successfully captured ${photos.length} photos`);
      } else {
        Alert.alert('Error', 'No photos were captured');
      }
      
    } catch (error) {
      console.error('Failed to take pictures:', error);
      Alert.alert('Error', 'Failed to take pictures');
    } finally {
      setIsCapturing(false);
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

        {/* Center Vision Labels */}
        {!showPreview && <Label sharedValue={currentLabel} />}

        {/* Bottom Camera Controls */}
        {!showPreview && (
          <View style={styles.bottomCameraControls}>
            {/* Capture Button */}
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
                    <Text style={styles.capturingText}>
                      {capturedPhotos.length}/4
                    </Text>
                  </View>
                ) : (
                  <View style={styles.captureIconContainer}>
                    <Ionicons name="camera" size={32} color="white" />
                    <Text style={styles.captureText}>4 Shots</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Photo Preview Overlay */}
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
              <Text style={styles.previewTitle}>
                Captured {capturedPhotos.length} Photos
              </Text>
              <TouchableOpacity
                style={styles.closePreviewButton}
                onPress={closePreview}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoScroll}
              contentContainerStyle={styles.photoScrollContent}>
              {capturedPhotos.map((photo, index) => (
                <View key={photo.timestamp} style={styles.photoContainer}>
                  <Image
                    source={{uri: `file://${photo.path}`}}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.photoIndex}>{index + 1}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={clearPhotos}>
                <Ionicons name="trash" size={20} color="white" />
                <Text style={styles.actionText}>Clear All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.retakeButton]}
                onPress={closePreview}>
                <Ionicons name="camera" size={20} color="white" />
                <Text style={styles.actionText}>Take More</Text>
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
  photoScroll: {
    flex: 1,
  },
  photoScrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoContainer: {
    marginHorizontal: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: width * 0.7,
    height: height * 0.5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  photoIndex: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingBottom: 50,
    paddingTop: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
});
