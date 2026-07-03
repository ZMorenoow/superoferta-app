import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import SplashScreen from '../components/SplashScreen';

export default function Entry() {
  const [splashDone, setSplashDone] = useState(false);

  const handleFinish = async () => {
    setSplashDone(true);
    try {
      const onboardingDone = await AsyncStorage.getItem('@onboarding_done');
      if (!onboardingDone) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      router.replace('/(tabs)');
    }
  };

  if (!splashDone) return <SplashScreen onFinish={handleFinish} />;
  return <View style={{ flex: 1 }} />;
}