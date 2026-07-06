// app/_layout.jsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// DEBE estar fuera del componente, a nivel de módulo
// Evita que el splash nativo de Expo se oculte solo antes de tiempo
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Ocultamos el splash nativo de Expo apenas el layout esté listo.
    // Tu componente SplashScreen en index.jsx se encarga de la animación propia.
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="order-status" />
      <Stack.Screen name="product-detail" />
      <Stack.Screen name="picker" />
    </Stack>
  );
}