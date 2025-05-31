import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Tts from 'react-native-tts';

interface Voice {
  id: string;
  name: string;
  language: string;
  quality?: number;
}

export default function App() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(
    'com.apple.voice.premium.en-US.Zoe',
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const startHandler = () => setIsSpeaking(true);
    const finishHandler = () => setIsSpeaking(false);
    const cancelHandler = () => setIsSpeaking(false);

    const initializeTts = async () => {
      try {
        if (Platform.OS === 'ios') {
          // Initialize TTS
          await Tts.setDefaultLanguage('en-US');

          // Fetch voices first to check what's available
          const voicesData = await Tts.voices();
          setVoices(voicesData);

          // Find Siri voice variants (these are the high-quality neural voices)
          const siriVoices = voicesData.filter(
            voice =>
              voice.id.includes('premium') ||
              voice.id.includes('neural') ||
              voice.name.toLowerCase().includes('siri') ||
              ['Zoe', 'Evan', 'Tom', 'Nicky'].includes(voice.name),
          );

          console.log('Available Siri/Premium voices:', siriVoices);

          // Try different Siri voice IDs in order of preference
          const siriVoiceIds = [
            'com.apple.voice.premium.en-US.Zoe', // Female Siri-like voice
            'com.apple.voice.premium.en-US.Evan', // Male Siri-like voice
            'com.apple.voice.premium.en-US.Tom', // Male voice
            'com.apple.voice.premium.en-US.Nicky', // Female voice
            'com.apple.ttsbundle.siri_female_en-US_compact',
            'com.apple.ttsbundle.siri_male_en-US_compact',
            'com.apple.voice.enhanced.en-US.Zoe',
            'com.apple.voice.enhanced.en-US.Evan',
            'Zoe',
            'Evan',
          ];

          let selectedSiriVoice = null;
          for (const voiceId of siriVoiceIds) {
            const foundVoice = voicesData.find(voice => voice.id === voiceId);
            if (foundVoice) {
              selectedSiriVoice = voiceId;
              break;
            }
          }

          if (selectedSiriVoice) {
            setSelectedVoice(selectedSiriVoice);
            await Tts.setDefaultVoice(selectedSiriVoice);
            console.log('Set Siri voice:', selectedSiriVoice);
          } else {
            console.log('Siri voice not found, using default');
            // Fallback to first available voice
            if (voicesData.length > 0) {
              await Tts.setDefaultVoice(voicesData[0].id);
              setSelectedVoice(voicesData[0].id);
            }
          }

          // Add event listeners
          Tts.addEventListener('tts-start', startHandler);
          Tts.addEventListener('tts-finish', finishHandler);
          Tts.addEventListener('tts-cancel', cancelHandler);

          setIsReady(true);
        } else {
          Alert.alert('Error', 'TTS is only supported on iOS in this demo');
        }
      } catch (error) {
        console.error('TTS initialization error:', error);
        Alert.alert('Error', 'Failed to initialize Text-to-Speech');
      }
    };

    initializeTts();

    return () => {
      if (isReady) {
        Tts.removeEventListener('tts-start', startHandler);
        Tts.removeEventListener('tts-finish', finishHandler);
        Tts.removeEventListener('tts-cancel', cancelHandler);
      }
    };
  }, [isReady]);

  const handleSpeak = async () => {
    if (!isReady) {
      Alert.alert('Error', 'TTS is not ready yet');
      return;
    }

    try {
      if (isSpeaking) {
        await Tts.stop();
      } else {
        // Check if using a Siri-like voice
        const currentVoice = voices.find(voice => voice.id === selectedVoice);
        if (
          currentVoice &&
          (currentVoice.id.includes('premium') ||
            currentVoice.id.includes('neural') ||
            ['Zoe', 'Evan', 'Tom', 'Nicky'].includes(currentVoice.name))
        ) {
          await Tts.speak(
            "Hey there! I'm using a Siri-quality voice from Apple's premium text-to-speech system.",
          );
        } else {
          await Tts.speak(
            "Hello! This is coming from Apple's TTS, but may not be the premium Siri voice.",
          );
        }
      }
    } catch (error) {
      console.error('TTS speak error:', error);
      Alert.alert('Error', 'Failed to use Text-to-Speech');
    }
  };

  const handleVoiceChange = async (voiceId: string) => {
    if (!isReady) return;

    try {
      setSelectedVoice(voiceId);
      await Tts.setDefaultVoice(voiceId);

      // Show which voice was selected
      const selectedVoiceInfo = voices.find(voice => voice.id === voiceId);
      if (selectedVoiceInfo) {
        console.log('Voice changed to:', selectedVoiceInfo.name);
      }
    } catch (error) {
      console.error('Voice change error:', error);
    }
  };

  // Add a function to specifically select Siri voice
  const selectSiriVoice = () => {
    const siriVoice = voices.find(
      voice =>
        voice.id.includes('premium') ||
        voice.id.includes('neural') ||
        ['Zoe', 'Evan', 'Tom', 'Nicky'].includes(voice.name),
    );

    if (siriVoice) {
      handleVoiceChange(siriVoice.id);
      Alert.alert('Success', `Selected ${siriVoice.name} (Siri-quality voice)`);
    } else {
      Alert.alert(
        'Not Found',
        'Siri-quality voice is not available on this device',
      );
    }
  };

  if (!isReady) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Initializing Text-to-Speech...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Text to Speech Demo</Text>

      <TouchableOpacity
        style={[styles.speakButton, isSpeaking && styles.speakButtonActive]}
        onPress={handleSpeak}
        disabled={!isReady}>
        <Text style={styles.speakButtonText}>
          {isSpeaking ? 'Stop Speaking' : 'Start Speaking'}
        </Text>
      </TouchableOpacity>

      {/* Add button to quickly select Siri voice */}
      <TouchableOpacity style={styles.siriButton} onPress={selectSiriVoice}>
        <Text style={styles.siriButtonText}>Use Siri Voice</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Available Voices:</Text>

      <ScrollView style={styles.voicesList}>
        {voices.map(voice => (
          <TouchableOpacity
            key={voice.id}
            style={[
              styles.voiceItem,
              selectedVoice === voice.id && styles.selectedVoice,
              (voice.id.includes('premium') ||
                voice.id.includes('neural') ||
                ['Zoe', 'Evan', 'Tom', 'Nicky'].includes(voice.name)) &&
                styles.siriVoice,
            ]}
            onPress={() => handleVoiceChange(voice.id)}>
            <Text style={styles.voiceName}>
              {voice.name}
              {(voice.id.includes('premium') ||
                voice.id.includes('neural') ||
                ['Zoe', 'Evan', 'Tom', 'Nicky'].includes(voice.name)) &&
                ' 🎙️'}
            </Text>
            <Text style={styles.voiceLanguage}>{voice.language}</Text>
            <Text style={styles.voiceId}>{voice.id}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  speakButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  speakButtonActive: {
    backgroundColor: '#FF3B30',
  },
  speakButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  siriButton: {
    backgroundColor: '#5856D6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  siriButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  voicesList: {
    flex: 1,
  },
  voiceItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedVoice: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  siriVoice: {
    borderColor: '#5856D6',
    backgroundColor: '#F0F0FF',
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  voiceLanguage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  voiceId: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontFamily: 'Courier',
  },
});
