// app/index.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
// Renombrado a AppSplashScreen para evitar conflicto con expo-splash-screen
import AppSplashScreen from '../components/SplashScreen';
import { supabase } from '../utils/supabase';

// Decide a dónde ir al abrir la app:
//   1) Con sesión iniciada: según el rol (picker -> /picker, resto -> /(tabs)).
//      Quien ya tiene sesión nunca ve el onboarding.
//   2) Sin sesión: onboarding la primera vez; después, el inicio como invitado.
async function decidirDestino() {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;

  if (!user) {
    const onboardingDone = await AsyncStorage.getItem('@onboarding_done');
    return onboardingDone ? '/(tabs)' : '/onboarding';
  }

  // Si ya hay sesión, el onboarding ya no corresponde.
  await AsyncStorage.setItem('@onboarding_done', 'true');

  let rol = null;
  try {
    const { data: perfil, error } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    rol = perfil?.rol ?? null;
    if (rol) await AsyncStorage.setItem('@rol', rol);
  } catch {
    // Sin internet o error momentáneo: se usa el último rol conocido.
    rol = await AsyncStorage.getItem('@rol');
  }

  return rol === 'picker' ? '/picker' : '/(tabs)';
}

export default function Entry() {
  const [splashDone, setSplashDone] = useState(false);

  const handleFinish = async () => {
    setSplashDone(true);
    try {
      router.replace(await decidirDestino());
    } catch (e) {
      router.replace('/(tabs)');
    }
  };

  if (!splashDone) return <AppSplashScreen onFinish={handleFinish} />;
  return <View style={{ flex: 1 }} />;
}