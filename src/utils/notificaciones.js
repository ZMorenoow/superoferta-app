import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Muestra la notificación aunque la app esté abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pide permiso, obtiene el token de Expo y lo guarda en perfiles.push_token
export async function registrarPushToken() {
  // En web no hay push de Expo: se prueba solo en el celular
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Pedidos',
      importance: Notifications.AndroidImportance.MAX,
      lightColor: '#C21807',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    console.log('[push] permiso de notificaciones denegado');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] falta el projectId de EAS (extra.eas.projectId en app.json)');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  console.log('[push] token obtenido:', `${token.slice(0, 24)}…`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[push] no hay sesión, el token no se guarda todavía');
    return null;
  }

  const { error } = await supabase.from('perfiles').update({ push_token: token }).eq('id', user.id);
  if (error) {
    console.warn('[push] no se pudo guardar el token:', error.message);
    return null;
  }

  console.log('[push] token guardado en perfiles para', user.id);
  return token;
}

/**
 * Llamar una vez en el layout raíz (app/_layout.jsx):
 *   usePushNotifications();
 */
export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Registrar al abrir la app (si ya hay sesión) y al iniciar sesión
    registrarPushToken().catch((e) => console.warn('[push] error registrando el token', e));
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN') {
        registrarPushToken().catch((e) => console.warn('[push] error registrando el token', e));
      }
    });

    // Log de cada notificación que llega con la app abierta
    const recibida = Notifications.addNotificationReceivedListener((n) => {
      console.log('[push] recibida:', n.request.content.title, '-', n.request.content.body);
    });

    // Al tocar una notificación, ir a la pantalla indicada por la Edge Function
    const toque = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data ?? {};
      console.log('[push] tocada, ruta:', data.ruta);
      if (data.ruta) {
        router.push({ pathname: data.ruta, params: data.params ?? {} });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      recibida.remove();
      toque.remove();
    };
  }, []);
}