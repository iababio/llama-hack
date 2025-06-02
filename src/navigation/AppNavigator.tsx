import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import App from '../App';
import Camera from '../components/camera/Camera';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1a1a1a',
            },
            headerTintColor: '#0081FB',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}>
          <Stack.Screen
            name="Home"
            component={App}
            options={{
              title: 'Meta Hack',
              headerShown: false, // Hide header for chat interface
            }}
          />
          <Stack.Screen
            name="Camera"
            component={Camera}
            options={{
              headerShown: false, // Hide header for full screen camera
              gestureEnabled: true, // Allow swipe back gesture
              presentation: 'modal', // Present camera as modal
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
