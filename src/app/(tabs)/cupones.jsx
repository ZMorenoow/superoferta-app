import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';
import { supabase } from '../../utils/supabase';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const formatFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
    : null;

export default function CuponesScreen() {
  const router = useRouter();
  const { handleScroll } = useTabBar();
  const [cupones, setCupones] = useState([]);
  const [activos, setActivos] = useState([]); // ids de cupones activados por el usuario
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('cupones')
      .select('id, codigo, descripcion, tipo, valor, minimo_compra, vence_en, id_categoria, categorias (nombre, emoji)')
      .order('vence_en', { ascending: true, nullsFirst: false });

    if (error) console.error('Error cargando cupones', error);

    let idsActivos = [];
    let idsUsados = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: mios } = await supabase
        .from('cupones_usuario')
        .select('id_cupon, usado_en')
        .eq('id_usuario', user.id);
      idsActivos = (mios || []).filter((m) => !m.usado_en).map((m) => m.id_cupon);
      idsUsados = (mios || []).filter((m) => m.usado_en).map((m) => m.id_cupon);
    }

    setCupones((data || []).filter((c) => !idsUsados.includes(c.id)));
    setActivos(idsActivos);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const alternar = async (cupon) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const yaActivo = activos.includes(cupon.id);
    setProcesando(cupon.id);
    setMensaje(null);

    const { error } = await supabase.rpc(
      yaActivo ? 'desactivar_cupon' : 'activar_cupon',
      { p_id_cupon: cupon.id }
    );

    if (error) {
      setMensaje({ tipo: 'error', texto: error.message || 'No se pudo actualizar el cupón' });
    } else if (!yaActivo) {
      setMensaje({ tipo: 'ok', texto: 'Cupón activado. Se aplicará en tu carrito.' });
    }

    await cargar();
    setProcesando(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Cupones</Text>
        <Text style={styles.subtitle}>
          {cupones.length} {cupones.length === 1 ? 'cupón disponible' : 'cupones disponibles'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ED1C24" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {mensaje && (
            <View style={[styles.mensaje, mensaje.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError]}>
              <Ionicons
                name={mensaje.tipo === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={mensaje.tipo === 'ok' ? '#15803d' : '#ED1C24'}
              />
              <Text style={[styles.mensajeText, { color: mensaje.tipo === 'ok' ? '#15803d' : '#ED1C24' }]}>
                {mensaje.texto}
              </Text>
            </View>
          )}

          {cupones.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={64} color="#d8d8d8" />
              <Text style={styles.emptyText}>No hay cupones disponibles por ahora</Text>
            </View>
          )}

          {cupones.map((cupon) => {
            const activado = activos.includes(cupon.id);
            const esPorcentaje = cupon.tipo === 'porcentaje';
            const fecha = formatFecha(cupon.vence_en);
            const categoria = cupon.categorias
              ? `${cupon.categorias.emoji ?? ''} ${cupon.categorias.nombre}`.trim()
              : 'Toda la tienda';

            return (
              <View key={cupon.id} style={styles.card}>
                {/* Lado izquierdo: descuento */}
                <View style={[styles.discountSide, activado && styles.discountSideActive]}>
                  <Text style={styles.discountText}>
                    {esPorcentaje ? `${cupon.valor}%` : formatCLP(cupon.valor)}
                  </Text>
                  <Text style={styles.discountLabel}>dcto.</Text>
                </View>

                {/* Separador punteado */}
                <View style={styles.separator}>
                  <View style={styles.circleTop} />
                  <View style={styles.dashedLine} />
                  <View style={styles.circleBottom} />
                </View>

                {/* Lado derecho: info */}
                <View style={styles.infoSide}>
                  <View style={styles.categoriaChip}>
                    <Text style={styles.categoriaText}>{categoria}</Text>
                  </View>
                  <Text style={styles.description}>{cupon.descripcion || cupon.codigo}</Text>
                  {cupon.minimo_compra > 0 && (
                    <Text style={styles.min}>Compra mínima: {formatCLP(cupon.minimo_compra)}</Text>
                  )}
                  <View style={styles.footer}>
                    <View style={styles.expiryBadge}>
                      <Ionicons name="time-outline" size={11} color="#888" />
                      <Text style={styles.expiry}>{fecha ? `Vence ${fecha}` : 'Sin vencimiento'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.activateBtn, activado && styles.activatedBtn]}
                      onPress={() => alternar(cupon)}
                      disabled={procesando === cupon.id}
                    >
                      {procesando === cupon.id ? (
                        <ActivityIndicator size="small" color={activado ? '#1B6B3A' : '#fff'} />
                      ) : (
                        <Text style={[styles.activateBtnText, activado && styles.activatedBtnText]}>
                          {activado ? '✓ Activado' : 'Activar'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 120 },

  mensaje: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 12,
  },
  mensajeOk: { backgroundColor: '#dcfce7' },
  mensajeError: { backgroundColor: '#fdecea' },
  mensajeText: { fontSize: 13, fontWeight: '700', flex: 1 },

  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#aaa' },

  card: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  discountSide: {
    width: 84, backgroundColor: '#ED1C24',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, paddingHorizontal: 4,
  },
  discountSideActive: { backgroundColor: '#FBB03B' },
  discountText: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' },
  discountLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  separator: { width: 20, alignItems: 'center', justifyContent: 'center' },
  circleTop: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F8F9FA', position: 'absolute', top: -8,
  },
  circleBottom: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F8F9FA', position: 'absolute', bottom: -8,
  },
  dashedLine: {
    flex: 1, borderLeftWidth: 1.5,
    borderLeftColor: '#e0e0e0', borderStyle: 'dashed',
  },
  infoSide: { flex: 1, padding: 14, justifyContent: 'space-between' },
  categoriaChip: {
    alignSelf: 'flex-start', backgroundColor: '#fdecea',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 6,
  },
  categoriaText: { fontSize: 11, fontWeight: '700', color: '#C21807' },
  description: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, lineHeight: 18 },
  min: { fontSize: 11, color: '#888', marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expiryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expiry: { fontSize: 11, color: '#888' },
  activateBtn: {
    backgroundColor: '#FF5A18', paddingHorizontal: 14, minWidth: 84,
    paddingVertical: 6, borderRadius: 20, alignItems: 'center',
  },
  activatedBtn: { backgroundColor: '#e8f5ed' },
  activateBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  activatedBtnText: { color: '#1B6B3A' },
});