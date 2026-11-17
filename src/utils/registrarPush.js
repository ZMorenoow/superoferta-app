// utils/registrarPush.js
// Pide permiso de notificaciones, obtiene el token de Expo y lo guarda en perfiles.expo_push_token.
//
// Instalar:  npx expo install expo-notifications expo-device expo-constants
// Llamar:    await registrarPush()  justo después de iniciar sesión (y al abrir la app con sesión).
//
// Importante: las notificaciones remotas NO funcionan en Expo Go (Android, SDK 53+).
// Hay que probar con un development build (eas build --profile development).
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registrarPush() {
  try {
    if (!Device.isDevice) return null; // los emuladores no reciben push

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Ofertas y pedidos',
        importance: Notifications.AndroidImportance.MAX,
        lightColor: '#C21807',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('registrarPush: falta el projectId de EAS (ejecuta "eas init").');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase
      .from('perfiles')
      .update({ expo_push_token: token })
      .eq('id', user.id);
    if (error) throw error;

    return token;
  } catch (e) {
    console.warn('registrarPush falló', e);
    return null;
  }
}