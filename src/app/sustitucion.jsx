import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';
const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

function Foto({ uri, size = 56 }) {
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 10, backgroundColor: '#f5f5f5' }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="cube-outline" size={22} color="#aaa" />
    </View>
  );
}

export default function SustitucionScreen() {
  const router = useRouter();
  const { pedido } = useLocalSearchParams();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondiendo, setRespondiendo] = useState(null); // id de la sugerencia en curso

  // Un ref bloquea al instante; useState tarda un render y deja pasar el segundo toque.
  const enCurso = useRef(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedido_items')
      .select(`
        id, cantidad, precio_unitario, motivo_faltante,
        productos ( nombre, imagen_url ),
        sustituciones ( id, estado, cantidad, precio_unitario, nota, productos ( nombre, imagen_url ) )
      `)
      .eq('id_pedido', pedido)
      .eq('estado', 'faltante');

    if (error) console.error(error);
    setItems(data ?? []);
    setLoading(false);
  }, [pedido]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const pendientes = items
    .map((i) => ({
      item: i,
      sust: (i.sustituciones ?? []).find((s) => s.estado === 'propuesta'),
    }))
    .filter((x) => x.sust);

  const responder = async (sust, acepta) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setRespondiendo(sust.id);

    try {
      const { error } = await supabase.rpc('responder_sustitucion', {
        p_sustitucion: sust.id,
        p_acepta: acepta,
      });

      if (error) {
        Alert.alert('No se pudo completar', error.message || 'Intenta de nuevo.');
        await cargar();
        return;
      }

      const quedan = pendientes.filter((x) => x.sust.id !== sust.id).length;
      if (quedan === 0) router.back();
      else await cargar();
    } finally {
      enCurso.current = false;
      setRespondiendo(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={23} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Productos no disponibles</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 80 }} />
      ) : pendientes.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="checkmark-circle-outline" size={52} color={VERDE} />
          <Text style={styles.vacioTitulo}>No tienes sugerencias pendientes</Text>
          <Text style={styles.vacioTexto}>
            Te avisaremos si el preparador propone un reemplazo.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.intro}>
            No encontramos algunos productos. El preparador te sugiere estos reemplazos:
          </Text>

          {pendientes.map(({ item, sust }) => {
            const diff =
              sust.precio_unitario * sust.cantidad - item.precio_unitario * item.cantidad;
            const ocupado = respondiendo !== null; // apaga todos los botones
            const esteCargando = respondiendo === sust.id;

            return (
              <View key={sust.id} style={styles.card}>
                <Text style={styles.label}>NO DISPONIBLE</Text>
                <View style={styles.row}>
                  <Foto uri={item.productos?.imagen_url} />
                  <View style={styles.info}>
                    <Text style={[styles.nombre, styles.tachado]} numberOfLines={2}>
                      {item.productos?.nombre}
                    </Text>
                    <Text style={styles.sub}>
                      {item.cantidad} × {formatCLP(item.precio_unitario)}
                      {item.motivo_faltante ? ` · ${item.motivo_faltante}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.flecha}>
                  <Ionicons name="arrow-down" size={20} color="#bbb" />
                </View>

                <Text style={[styles.label, { color: VERDE }]}>SUGERENCIA</Text>
                <View style={styles.row}>
                  <Foto uri={sust.productos?.imagen_url} />
                  <View style={styles.info}>
                    <Text style={styles.nombre} numberOfLines={2}>
                      {sust.productos?.nombre}
                    </Text>
                    <Text style={styles.sub}>
                      {sust.cantidad} × {formatCLP(sust.precio_unitario)}
                    </Text>
                  </View>
                </View>

                {!!sust.nota && (
                  <View style={styles.nota}>
                    <Text style={styles.notaLabel}>Mensaje del preparador</Text>
                    <Text style={styles.notaTexto}>{sust.nota}</Text>
                  </View>
                )}

                <Text style={[styles.diff, { color: diff > 0 ? PRIMARY : VERDE }]}>
                  {diff === 0
                    ? 'Mismo precio'
                    : diff > 0
                    ? `Diferencia: +${formatCLP(diff)}`
                    : `Diferencia: -${formatCLP(Math.abs(diff))}`}
                </Text>

                <View style={styles.botones}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnNo, ocupado && styles.btnApagado]}
                    disabled={ocupado}
                    onPress={() => responder(sust, false)}
                  >
                    <Text style={styles.btnNoTexto}>No, gracias</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSi, ocupado && styles.btnApagado]}
                    disabled={ocupado}
                    onPress={() => responder(sust, true)}
                  >
                    {esteCargando ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnSiTexto}>Aceptar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  intro: { fontSize: 14, color: '#666', marginBottom: 14, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  label: { fontSize: 11, fontWeight: '800', color: PRIMARY, marginBottom: 8, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  nombre: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  tachado: { color: '#aaa', textDecorationLine: 'line-through' },
  sub: { fontSize: 12, color: '#888', marginTop: 3 },
  flecha: { alignItems: 'center', marginVertical: 8 },
  nota: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F8F9FA' },
  notaLabel: { fontSize: 11, fontWeight: '800', color: '#555', marginBottom: 3 },
  notaTexto: { fontSize: 13, color: '#444', lineHeight: 18 },
  diff: { fontSize: 14, fontWeight: '800', marginTop: 14 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnApagado: { opacity: 0.55 },
  btnNo: { backgroundColor: '#f1f1f1' },
  btnNoTexto: { color: '#555', fontWeight: '700', fontSize: 14 },
  btnSi: { backgroundColor: VERDE },
  btnSiTexto: { color: '#fff', fontWeight: '800', fontSize: 14 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  vacioTexto: { fontSize: 14, color: '#888', textAlign: 'center' },
});