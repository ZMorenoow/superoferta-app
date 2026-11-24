import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';
const VERDE_BRILLO = '#34D17B';
const ROJO_BRILLO = '#FF5A4D';

const MARCO_W = 290;
const MARCO_H = 190;
const ESQUINA = 36;
const GROSOR = 5;
const MASCARA = 'rgba(0,0,0,0.65)';

export default function ScannerOverlay({ completados, total, feedback, onClose }) {
  const linea = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // Dentro de un Modal de Android los insets a veces llegan en 0 y los botones
  // quedan bajo la barra de estado o la barra de navegación. Se aplican mínimos.
  const topPad = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0
  );
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 40 : 0) + 16;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(linea, {
          toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(linea, {
          toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [linea]);

  const colorMarco = !feedback ? '#fff' : feedback.ok ? VERDE_BRILLO : ROJO_BRILLO;
  const translateY = linea.interpolate({ inputRange: [0, 1], outputRange: [10, MARCO_H - 12] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.mascara} />
        <View style={styles.filaCentro}>
          <View style={styles.mascara} />
          <View style={styles.ventana}>
            <View style={[styles.esquina, styles.tl, { borderColor: colorMarco }]} />
            <View style={[styles.esquina, styles.tr, { borderColor: colorMarco }]} />
            <View style={[styles.esquina, styles.bl, { borderColor: colorMarco }]} />
            <View style={[styles.esquina, styles.br, { borderColor: colorMarco }]} />
            <Animated.View style={[styles.linea, { transform: [{ translateY }] }]} />
          </View>
          <View style={styles.mascara} />
        </View>
        <View style={[styles.mascara, styles.mascaraAbajo]}>
          <Text style={styles.ayuda}>Centra el código de barras dentro del cuadro</Text>
        </View>
      </View>

      {/* Controles (con márgenes manuales en vez de SafeAreaView) */}
      <View
        style={[styles.capa, { paddingTop: topPad, paddingBottom: bottomPad }]}
        pointerEvents="box-none"
      >
        <View style={styles.top}>
          <View style={styles.pastilla}>
            <Ionicons name="barcode-outline" size={18} color="#fff" />
            <Text style={styles.pastillaTexto}>
              {completados} de {total} listos
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cerrar}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <View style={styles.feedbackCaja}>
            {feedback && (
              <View style={[styles.feedback, { backgroundColor: feedback.ok ? VERDE : PRIMARY }]}>
                <Ionicons
                  name={feedback.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={22}
                  color="#fff"
                />
                <Text style={styles.feedbackTexto}>{feedback.texto}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.listo} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.listoTexto}>Listo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mascara: { flex: 1, backgroundColor: MASCARA },
  mascaraAbajo: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 24 },
  filaCentro: { flexDirection: 'row', height: MARCO_H },
  ventana: { width: MARCO_W, height: MARCO_H },

  esquina: { position: 'absolute', width: ESQUINA, height: ESQUINA },
  tl: { top: 0, left: 0, borderTopWidth: GROSOR, borderLeftWidth: GROSOR, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: GROSOR, borderRightWidth: GROSOR, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: GROSOR, borderLeftWidth: GROSOR, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: GROSOR, borderRightWidth: GROSOR, borderBottomRightRadius: 8 },

  linea: {
    position: 'absolute', top: 0, left: 14, right: 14, height: 2, borderRadius: 1,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30', shadowOpacity: 0.9, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },

  ayuda: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  capa: { flex: 1, justifyContent: 'space-between' },
  top: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12,
  },
  pastilla: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  pastillaTexto: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cerrar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  bottom: { paddingHorizontal: 20, gap: 12 },
  feedbackCaja: { minHeight: 52, justifyContent: 'center' },
  feedback: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16,
  },
  feedbackTexto: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  listo: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  listoTexto: { color: PRIMARY, fontSize: 15, fontWeight: '800' },
});