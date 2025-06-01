import {Platform, PermissionsAndroid, Alert} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
}

/**
 * Request location permission for Android
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location to share your current position.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      
      console.log('Location permission result:', granted);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }
  
  // iOS permissions are handled automatically by the system
  return true;
};

/**
 * Get current location with high accuracy
 */
export const getCurrentLocation = (): Promise<LocationData> => {
  return new Promise((resolve, reject) => {
    console.log('📍 Getting current location...');
    
    Geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 Location obtained:', position);
        
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        
        resolve(locationData);
      },
      (error) => {
        console.error('📍 Location error:', error);
        
        let errorMessage = 'Unable to get your location';
        
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Location permission denied. Please enable location access in settings.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Location unavailable. Please check your GPS settings.';
            break;
          case 3: // TIMEOUT
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = `Location error: ${error.message}`;
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
};

/**
 * Get address from coordinates using reverse geocoding
 */
export const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number,
): Promise<string> => {
  try {
    // Using a free geocoding service
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const data = await response.json();
    
    // Format the address
    const address = [
      data.locality,
      data.principalSubdivision,
      data.countryName,
    ]
      .filter(Boolean)
      .join(', ');
    
    return address || 'Address not found';
  } catch (error) {
    console.error('Error getting address:', error);
    return 'Address unavailable';
  }
};

/**
 * Get location with address
 */
export const getLocationWithAddress = async (): Promise<LocationData> => {
  try {
    // First check permission
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }
    
    // Get coordinates
    const location = await getCurrentLocation();
    
    // Get address
    console.log('📍 Getting address for coordinates...');
    const address = await getAddressFromCoordinates(
      location.latitude,
      location.longitude,
    );
    
    return {
      ...location,
      address,
    };
  } catch (error) {
    console.error('Error getting location with address:', error);
    throw error;
  }
};

/**
 * Format location data for sharing
 */
export const formatLocationMessage = (location: LocationData): string => {
  const { latitude, longitude, accuracy, address } = location;
  
  let message = `📍 **My Current Location**\n\n`;
  
  if (address) {
    message += `**Address:** ${address}\n\n`;
  }
  
  message += `**Coordinates:** ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n`;
  message += `**Accuracy:** ±${Math.round(accuracy)}m\n`;
  message += `**Google Maps:** https://maps.google.com/?q=${latitude},${longitude}\n`;
  message += `**Apple Maps:** http://maps.apple.com/?q=${latitude},${longitude}`;
  
  return message;
};

/**
 * Handle location sharing with user confirmation
 */
export const handleLocationSharing = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    Alert.alert(
      'Share Location',
      'Do you want to share your current location?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => reject(new Error('Location sharing cancelled')),
        },
        {
          text: 'Share',
          style: 'default',
          onPress: async () => {
            try {
              const location = await getLocationWithAddress();
              const message = formatLocationMessage(location);
              resolve(message);
            } catch (error) {
              reject(error);
            }
          },
        },
      ],
    );
  });
};