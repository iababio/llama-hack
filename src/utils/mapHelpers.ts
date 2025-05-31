import { Platform, Vibration } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Haptic feedback options
export const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export interface CustomMarkerPressEvent {
  _targetInst: {
    return: {
      key: any;
    };
  };
}

type hapticTypes =
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'rigid'
  | 'soft';

export const triggerHapticFeedback = (type: hapticTypes = 'selection') => {
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger(type, hapticOptions);
  } else {
    Vibration.vibrate(20);
  }
};