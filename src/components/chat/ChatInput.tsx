/* eslint-disable react-native/no-inline-styles */
import React, {useRef, useEffect, useState} from 'react';
import {
  View,
  Text, // Add this import
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {IsDarkMode} from '../../utils/config';
import {ATTACHMENT_SHEET_HEIGHT} from './styles';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  handleSend: () => void;
  handleVoicePress: () => void;
  handleVoiceLongPress?: () => void;
  handleAttachmentPress: () => void;
  onAttachmentOption?: (option: string) => void;
  isRecording: boolean;
  attachmentSheetVisible: boolean;
  scrollToEnd: () => void;
}

const ChatInput = ({
  inputText,
  setInputText,
  handleSend,
  handleVoicePress,
  handleVoiceLongPress,
  handleAttachmentPress,
  onAttachmentOption,
  isRecording,
  attachmentSheetVisible,
  scrollToEnd,
}: ChatInputProps) => {
  const isDark = IsDarkMode();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const translateY = useRef(
    new Animated.Value(ATTACHMENT_SHEET_HEIGHT),
  ).current;

  // Listen to keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Animate attachment sheet
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: attachmentSheetVisible ? 0 : ATTACHMENT_SHEET_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [attachmentSheetVisible, translateY]);

  // Handle button press with debugging
  const handleButtonPress = () => {
    console.log('Send button pressed');
    console.log('Input text:', inputText);
    console.log('Input text length:', inputText.length);
    console.log('Trimmed length:', inputText.trim().length);

    if (inputText.trim().length > 0) {
      console.log('Calling handleSend');
      handleSend();
      scrollToEnd();
    } else {
      console.log('Input is empty, not sending');
    }
  };

  return (
    <View style={[styles.keyboardContainer, {bottom: keyboardHeight}]}>
      <View
        style={[styles.inputWrapper, isDark && {backgroundColor: '#2C2C2E'}]}>
        {/* Attachment Button */}
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAttachmentPress}>
          <Ionicons
            name="add"
            size={24}
            color={isDark ? '#FFFFFF' : '#007AFF'}
          />
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            isDark && {color: '#FFFFFF', backgroundColor: '#1C1C1E'},
            {backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF'},
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleButtonPress}
          blurOnSubmit={false}
        />

        {/* Voice Button - for WebRTC voice chat */}
        <TouchableOpacity
          style={[
            styles.voiceButton,
            {
              backgroundColor: isRecording ? '#FF3B30' : '#34C759',
            },
          ]}
          onPress={handleVoicePress}
          onLongPress={handleVoiceLongPress}>
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={20}
            color="white"
          />
        </TouchableOpacity>

        {/* Send Button - for text messages via Llama API */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            inputText.trim().length === 0 && styles.sendButtonDisabled,
          ]}
          onPress={handleButtonPress}
          disabled={inputText.trim().length === 0}>
          <Ionicons name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Attachment Sheet */}
      <Animated.View
        style={[
          styles.attachmentSheet,
          {
            transform: [{translateY: translateY}],
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          },
        ]}
        pointerEvents={attachmentSheetVisible ? 'auto' : 'none'}>
        {/* Attachment options */}
        <View style={styles.attachmentOptions}>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => onAttachmentOption?.('camera')}>
            <View style={[styles.attachmentIcon, {backgroundColor: '#FF9500'}]}>
              <Ionicons name="camera" size={24} color="white" />
            </View>
            <Text style={[styles.attachmentText, isDark && {color: '#FFFFFF'}]}>
              Camera
            </Text>
          </TouchableOpacity>

          

          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => onAttachmentOption?.('location')}>
            <View style={[styles.attachmentIcon, {backgroundColor: '#FF3B30'}]}>
              <Ionicons name="location" size={24} color="white" />
            </View>
            <Text style={[styles.attachmentText, isDark && {color: '#FFFFFF'}]}>
              Location
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderTopRightRadius: 15,
    borderTopLeftRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
  },
  attachButton: {
    padding: 5,
    marginRight: 5,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    maxHeight: 150,
    fontSize: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A52FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  // Add missing attachment sheet styles
  attachmentSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  attachmentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  attachmentOption: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  attachmentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
  },
});

export default ChatInput;
