import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

// Debe coincidir con RESULT_URL de la función webpay-return.
// Esa dirección es falsa a propósito: el WebView la intercepta y nunca se carga.
const RESULT_PREFIX = 'https://superoferta.local/pago-resultado';

const escapar = (valor) => String(valor).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export default function PagoWebpayScreen() {
  const router = useRouter();
  const { url, token, pedido } = useLocalSearchParams();
  const [cargando, setCargando] = useState(true);
  const terminado = useRef(false);

  // Webpay necesita recibir el token por POST en el campo token_ws.
  const html = useMemo(
    () =>
      `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
        <form method="post" action="${escapar(url)}">
          <input type="hidden" name="token_ws" value="${escapar(token)}" />
        </form>
        <p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#666">
          Conectando con Webpay...
        </p>
      </body></html>`,
    [url, token]
  );

  const irAlResultado = () => {
    if (terminado.current) return;
    terminado.current = true;
    // No se usa nada de la URL: el estado real se lee desde Supabase.
    router.replace({ pathname: '/order-status', params: { pedido } });
  };

  const revisarUrl = (urlNavegada) => {
    if (typeof urlNavegada === 'string' && urlNavegada.startsWith(RESULT_PREFIX)) {
      irAlResultado();
      return false;
    }
    return true;
  };

  const cancelar = () => {
    Alert.alert('Cancelar pago', '¿Quieres salir sin pagar?', [
      { text: 'Seguir pagando', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          // Devuelve el stock reservado de este pedido (si no alcanzó a pagarse).
          await supabase.rpc('cancelar_pedido_pendiente', { p_pedido: pedido });
          router.back();
        },
      },
    ]);
  };

  if (!url || !token || !pedido) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <Text style={styles.mensaje}>No se pudo abrir el pago.</Text>
          <TouchableOpacity style={styles.boton} onPress={() => router.back()}>
            <Text style={styles.botonTexto}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={cancelar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={26} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.titulo}>Pago con Webpay</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.webviewBox}>
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          cacheEnabled={false}
          onShouldStartLoadWithRequest={(req) => revisarUrl(req.url)}
          onNavigationStateChange={(nav) => revisarUrl(nav.url)}
          onLoadEnd={() => setCargando(false)}
          onError={() => {
            Alert.alert('Error', 'No se pudo cargar Webpay. Intenta de nuevo.');
          }}
        />
        {cargando && (
          <View style={styles.cargando} pointerEvents="none">
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  titulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  webviewBox: { flex: 1 },
  cargando: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  mensaje: { fontSize: 16, color: '#1a1a1a' },
  boton: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  botonTexto: { color: '#fff', fontSize: 15, fontWeight: '800' },
});