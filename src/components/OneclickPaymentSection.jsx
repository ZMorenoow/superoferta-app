import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '../utils/supabase';

const PRIMARY = '#ED1D26';
const RETURN_PATH = '/functions/v1/oneclick-inscription-return';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// Cuando una Edge Function responde con error, el mensaje útil viene en el cuerpo de la respuesta
const mensajeDeError = async (error, porDefecto) => {
  try {
    const cuerpo = await error?.context?.json?.();
    const texto = cuerpo?.message ?? cuerpo?.error;
    if (texto) return String(texto);
  } catch (_) {
    // el cuerpo no era JSON: se usa el mensaje por defecto
  }
  return porDefecto;
};

// Detecta la marca a partir de card_type que devuelve Transbank (Visa, MasterCard, AmericanExpress...)
const getBrand = (tipo) => {
  const t = String(tipo ?? '').toLowerCase();
  if (t.includes('visa')) return 'visa';
  if (t.includes('master')) return 'mastercard';
  if (t.includes('american') || t.includes('amex')) return 'amex';
  if (t.includes('diners')) return 'diners';
  if (t.includes('magna')) return 'magna';
  return 'otra';
};

// Colores de cada tarjeta: Visa azul, Mastercard oscura con círculos, Amex turquesa, etc.
const BRAND_THEMES = {
  visa: { bg: '#1A47B8', deco: 'rgba(255,255,255,0.10)' },
  mastercard: { bg: '#1C1C24', deco: 'rgba(255,255,255,0.06)' },
  amex: { bg: '#0A7F8F', deco: 'rgba(255,255,255,0.10)' },
  diners: { bg: '#3F4A5A', deco: 'rgba(255,255,255,0.08)' },
  magna: { bg: '#7A1F5C', deco: 'rgba(255,255,255,0.10)' },
  otra: { bg: '#3A3A44', deco: 'rgba(255,255,255,0.08)' },
};

function BrandMark({ brand, label }) {
  if (brand === 'visa') {
    return <Text style={styles.visaMark}>VISA</Text>;
  }
  if (brand === 'mastercard') {
    return (
      <View style={styles.mcMark}>
        <View style={[styles.mcCircle, { backgroundColor: '#EB001B', left: 0 }]} />
        <View style={[styles.mcCircle, { backgroundColor: '#F79E1B', left: 18, opacity: 0.9 }]} />
      </View>
    );
  }
  return <Text style={styles.otherMark}>{String(label ?? 'TARJETA').toUpperCase()}</Text>;
}

function CreditCardView({ card }) {
  const brand = getBrand(card.card_type);
  const theme = BRAND_THEMES[brand];
  const last4 = card.card_number_last4 ?? '••••';

  return (
    <View style={[styles.creditCard, { backgroundColor: theme.bg }]}>
      <View style={[styles.deco, styles.decoA, { backgroundColor: theme.deco }]} />
      <View style={[styles.deco, styles.decoB, { backgroundColor: theme.deco }]} />

      <View style={styles.ccTop}>
        <View style={styles.chip} />
        <BrandMark brand={brand} label={card.card_type} />
      </View>

      <Text style={styles.ccNumber}>••••  ••••  ••••  {last4}</Text>

      <View style={styles.ccBottom}>
        <View>
          <Text style={styles.ccLabel}>TARJETA GUARDADA</Text>
          <Text style={styles.ccValue}>Oneclick · Transbank</Text>
        </View>
        {brand !== 'visa' && brand !== 'mastercard' ? null : (
          <Text style={styles.ccType}>{String(card.card_type ?? '').toUpperCase()}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * Sección de Oneclick (inscribir, eliminar y pagar con tarjeta).
 *
 * mode: 'checkout' (por defecto, muestra el botón de pagar) o 'profile'
 *       (solo administrar la tarjeta: registrar o eliminar).
 * pedidoId: UUID del pedido pendiente (solo en checkout).
 * onPaymentSuccess: se llama cuando el pago queda autorizado.
 * onPaymentFailed: se llama cuando el pago falla, para que el carrito revise el estado del pedido.
 * onBusyChange: avisa al carrito cuando hay una operación en curso (true) o terminó (false),
 *               para bloquear el otro medio de pago y el botón de atrás.
 */
export default function OneclickPaymentSection({
  pedidoId,
  mode = 'checkout',
  onPaymentSuccess,
  onPaymentFailed,
  onBusyChange,
}) {
  const esPerfil = mode === 'profile';

  // Márgenes de seguridad para el modal (el SafeAreaView dentro de un Modal no los recibe bien)
  const insets = useSafeAreaInsets();
  const topPad = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0
  );

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [webpay, setWebpay] = useState(null);
  const callbackSeen = useRef(false);
  const callbackHandled = useRef(false);
  const pagando = useRef(false);

  // Avisa al carrito mientras se paga o se inscribe una tarjeta
  useEffect(() => {
    onBusyChange?.(working || !!webpay);
  }, [working, webpay, onBusyChange]);

  // Al desmontar, el carrito ya no debe quedar bloqueado
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const formHtml = useMemo(() => {
    if (!webpay?.url || !webpay?.token) return '';
    return `<!doctype html><html><body onload="document.forms[0].submit()">
      <form method="post" action="${escapeHtml(webpay.url)}">
        <input type="hidden" name="TBK_TOKEN" value="${escapeHtml(webpay.token)}" />
      </form>
      <p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#555">Conectando con Oneclick...</p>
    </body></html>`;
  }, [webpay]);

  const refreshCard = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('oneclick-card-info');
    if (error) throw error;
    const tarjeta = data?.tarjeta ?? null;
    setCard(tarjeta);
    return tarjeta;
  }, []);

  // Consulta inicial de la tarjeta (reutiliza refreshCard)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshCard();
      } catch (error) {
        console.error('No se pudo consultar Oneclick', error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [refreshCard]);

  const inscribirTarjeta = async () => {
    try {
      setWorking(true);
      callbackSeen.current = false;
      callbackHandled.current = false;
      const { data, error } = await supabase.functions.invoke('oneclick-inscription-start', { body: {} });
      if (error) throw error;
      if (!data?.url || !data?.token) throw new Error('La respuesta de inscripción está incompleta.');
      setWebpay({ url: data.url, token: data.token });
    } catch (error) {
      const mensaje = await mensajeDeError(error, error?.message ?? 'No se pudo iniciar la inscripción.');
      Alert.alert('Oneclick', mensaje);
    } finally {
      setWorking(false);
    }
  };

  // Transbank ya devolvió al usuario a la función de retorno: se consulta si la tarjeta quedó guardada
  const terminarInscripcion = async () => {
    if (callbackHandled.current) return;
    callbackHandled.current = true;
    try {
      setWorking(true);
      const tarjeta = await refreshCard();
      setWebpay(null);
      if (tarjeta) {
        Alert.alert(
          'Tarjeta guardada',
          esPerfil
            ? 'Tu tarjeta quedó guardada correctamente.'
            : 'Ya puedes pagar con un toque con esta tarjeta.'
        );
      } else {
        Alert.alert(
          'No se pudo guardar la tarjeta',
          esPerfil
            ? 'Tu banco o Transbank no aprobó la inscripción. Prueba con otra tarjeta.'
            : 'Tu banco o Transbank no aprobó la inscripción. Prueba con otra tarjeta o paga con Webpay Plus.'
        );
      }
    } catch (error) {
      setWebpay(null);
      Alert.alert('Oneclick', 'No pudimos confirmar el estado de tu tarjeta. Intenta de nuevo en unos segundos.');
    } finally {
      setWorking(false);
    }
  };

  // Si cierra el formulario antes de tiempo, se revisa igualmente por si la inscripción alcanzó a terminar
  const cerrarInscripcion = async () => {
    setWebpay(null);
    try {
      await refreshCard();
    } catch (_) {
      // sin tarjeta o sin conexión: queda como estaba
    }
  };

  const eliminarTarjeta = () => {
    Alert.alert('Eliminar tarjeta', '¿Quieres eliminar tu tarjeta guardada de Oneclick?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            setWorking(true);
            const { error } = await supabase.functions.invoke('oneclick-card-delete', { body: {} });
            if (error) throw error;
            setCard(null);
            Alert.alert('Oneclick', 'Tu tarjeta fue eliminada.');
          } catch (error) {
            const mensaje = await mensajeDeError(error, error?.message ?? 'No se pudo eliminar la tarjeta.');
            Alert.alert('Oneclick', mensaje);
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const pagarConOneclick = async () => {
    if (!pedidoId) {
      Alert.alert('Oneclick', 'No se recibió el identificador del pedido.');
      return;
    }
    // Evita un segundo cobro si se toca el botón dos veces seguidas
    if (pagando.current) return;
    pagando.current = true;

    try {
      setWorking(true);
      const { data, error } = await supabase.functions.invoke('oneclick-payment', {
        body: { id_pedido: pedidoId },
      });
      if (error) throw error;
      if (!data?.ok || data?.estado !== 'autorizado') {
        throw new Error(data?.message ?? 'Transbank no autorizó el pago.');
      }
      if (onPaymentSuccess) onPaymentSuccess(data);
      else Alert.alert('Pago aprobado', 'Tu pedido fue pagado correctamente.');
    } catch (error) {
      const mensaje = await mensajeDeError(error, error?.message ?? 'Intenta nuevamente.');
      Alert.alert('No se pudo completar el pago', mensaje);
      onPaymentFailed?.();
    } finally {
      pagando.current = false;
      setWorking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{esPerfil ? 'Tarjeta guardada' : 'Pago con Oneclick'}</Text>
      {loading ? (
        <ActivityIndicator color={PRIMARY} />
      ) : card ? (
        <>
          <CreditCardView card={card} />

          {/* El botón de pagar solo existe en el checkout */}
          {!esPerfil && (
            <TouchableOpacity
              style={[styles.primaryButton, (working || !pedidoId) && styles.buttonDisabled]}
              disabled={working || !pedidoId}
              onPress={pagarConOneclick}
            >
              {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Pagar con esta tarjeta</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryButton} disabled={working} onPress={eliminarTarjeta}>
            {working && esPerfil ? (
              <ActivityIndicator color={PRIMARY} />
            ) : (
              <Text style={styles.secondaryText}>Eliminar tarjeta guardada</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.description}>
            Guarda tu tarjeta de forma segura en Transbank para pagar tus próximas compras sin volver a ingresar sus datos.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, working && styles.buttonDisabled]}
            disabled={working}
            onPress={inscribirTarjeta}
          >
            {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Registrar tarjeta</Text>}
          </TouchableOpacity>
        </>
      )}
      <Text style={styles.note}>Los datos completos de tu tarjeta no se almacenan en SuperOferta.</Text>

      {/* Formulario de Transbank en pantalla completa, fuera de la lista del carrito */}
      <Modal
        visible={!!webpay}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={cerrarInscripcion}
      >
        <View style={[styles.modal, { paddingTop: topPad, paddingBottom: insets.bottom }]}>
          <View style={styles.webviewHeader}>
            <Text style={styles.title}>Registrar tarjeta</Text>
            <TouchableOpacity onPress={cerrarInscripcion} hitSlop={10}>
              <Text style={styles.close}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          {!!webpay && (
            <WebView
              source={{ html: formHtml }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              onNavigationStateChange={(nav) => {
                if (typeof nav.url === 'string' && nav.url.includes(RETURN_PATH)) {
                  callbackSeen.current = true;
                }
              }}
              onLoadEnd={() => {
                if (callbackSeen.current) terminarInscripcion();
              }}
              onError={() => Alert.alert('Oneclick', 'No se pudo cargar el formulario de Transbank.')}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  description: { color: '#555', fontSize: 14, lineHeight: 20 },
  cardInfo: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { fontWeight: '700', color: '#222' },
  cardNumber: { color: '#444', letterSpacing: 1 },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: PRIMARY, fontWeight: '700' },
  note: { color: '#777', fontSize: 12, lineHeight: 17 },
  // Tarjeta visual
  creditCard: {
    borderRadius: 20,
    padding: 20,
    minHeight: 180,
    justifyContent: 'space-between',
    overflow: 'hidden',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.18)',
  },
  deco: { position: 'absolute', borderRadius: 999 },
  decoA: { width: 220, height: 220, top: -90, right: -70 },
  decoB: { width: 160, height: 160, bottom: -80, left: -50 },
  ccTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    width: 42, height: 30, borderRadius: 7,
    backgroundColor: '#E8C766',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)',
  },
  visaMark: {
    color: '#fff', fontSize: 26, fontWeight: '900',
    fontStyle: 'italic', letterSpacing: 1,
  },
  mcMark: { width: 44, height: 28 },
  mcCircle: { position: 'absolute', top: 0, width: 28, height: 28, borderRadius: 14 },
  otherMark: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  ccNumber: {
    color: '#fff', fontSize: 20, fontWeight: '700',
    letterSpacing: 2, marginTop: 18,
  },
  ccBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 },
  ccLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  ccValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },
  ccType: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  modal: { flex: 1, backgroundColor: '#fff' },
  webviewHeader: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { color: PRIMARY, fontWeight: '700' },
});