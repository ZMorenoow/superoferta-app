// app/_layout.jsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePushNotifications } from '../utils/notificaciones';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  usePushNotifications();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order-status" />
        <Stack.Screen name="product-detail" />
        <Stack.Screen name="picker" />
        <Stack.Screen name="admin" />
      </Stack>
    </SafeAreaProvider>
  );
}