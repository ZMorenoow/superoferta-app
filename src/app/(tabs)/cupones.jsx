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

const PRIMARY = '#C21807';
const BG = '#F5F5F7';
const INK = '#1a1a1a';

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
  const [usados, setUsados] = useState([]); // cupones ya usados por el usuario
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
    const usadoEn = {}; // id_cupon -> fecha de uso
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: mios } = await supabase
        .from('cupones_usuario')
        .select('id_cupon, usado_en')
        .eq('id_usuario', user.id);
      (mios || []).forEach((m) => {
        if (m.usado_en) usadoEn[m.id_cupon] = m.usado_en;
      });
      idsActivos = (mios || []).filter((m) => !m.usado_en).map((m) => m.id_cupon);
    }

    const todos = data || [];
    setCupones(todos.filter((c) => !usadoEn[c.id]));
    setUsados(
      todos.filter((c) => usadoEn[c.id]).map((c) => ({ ...c, usado_en: usadoEn[c.id] }))
    );
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
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
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
                size={20}
                color={mensaje.tipo === 'ok' ? '#15803d' : PRIMARY}
              />
              <Text style={[styles.mensajeText, { color: mensaje.tipo === 'ok' ? '#15803d' : PRIMARY }]}>
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
              <View key={cupon.id} style={[styles.card, activado && styles.cardActive]}>
                {/* Lado izquierdo: descuento */}
                <View style={[styles.discountSide, activado && styles.discountSideActive]}>
                  <Text style={styles.discountText} numberOfLines={1} adjustsFontSizeToFit>
                    {esPorcentaje ? `${cupon.valor}%` : formatCLP(cupon.valor)}
                  </Text>
                  <Text style={styles.discountLabel}>de descuento</Text>
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
                  <Text style={styles.description} numberOfLines={2}>
                    {cupon.descripcion || cupon.codigo}
                  </Text>
                  {cupon.minimo_compra > 0 && (
                    <Text style={styles.min}>Compra mínima: {formatCLP(cupon.minimo_compra)}</Text>
                  )}
                  <View style={styles.footer}>
                    <View style={styles.expiryBadge}>
                      <Ionicons name="time-outline" size={12} color="#888" />
                      <Text style={styles.expiry}>{fecha ? `Vence ${fecha}` : 'Sin vencimiento'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.activateBtn, activado && styles.activatedBtn]}
                      onPress={() => alternar(cupon)}
                      disabled={procesando === cupon.id}
                      activeOpacity={0.8}
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

          {/* Sección: cupones usados */}
          {usados.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Cupones usados</Text>
                <Text style={styles.sectionCount}>{usados.length}</Text>
              </View>

              {usados.map((cupon) => {
                const esPorcentaje = cupon.tipo === 'porcentaje';
                const fechaUso = formatFecha(cupon.usado_en);
                const categoria = cupon.categorias
                  ? `${cupon.categorias.emoji ?? ''} ${cupon.categorias.nombre}`.trim()
                  : 'Toda la tienda';

                return (
                  <View key={`usado-${cupon.id}`} style={[styles.card, styles.cardUsado]}>
                    <View style={[styles.discountSide, styles.discountSideUsado]}>
                      <Text style={styles.discountText} numberOfLines={1} adjustsFontSizeToFit>
                        {esPorcentaje ? `${cupon.valor}%` : formatCLP(cupon.valor)}
                      </Text>
                      <Text style={styles.discountLabel}>de descuento</Text>
                    </View>

                    <View style={styles.separator}>
                      <View style={styles.circleTop} />
                      <View style={styles.dashedLine} />
                      <View style={styles.circleBottom} />
                    </View>

                    <View style={styles.infoSide}>
                      <View style={[styles.categoriaChip, styles.categoriaChipUsado]}>
                        <Text style={[styles.categoriaText, { color: '#888' }]}>{categoria}</Text>
                      </View>
                      <Text style={[styles.description, { color: '#888' }]} numberOfLines={2}>
                        {cupon.descripcion || cupon.codigo}
                      </Text>
                      <View style={styles.footer}>
                        <View style={styles.expiryBadge}>
                          <Ionicons name="checkmark-done-outline" size={13} color="#888" />
                          <Text style={styles.expiry}>{fechaUso ? `Usado el ${fechaUso}` : 'Usado'}</Text>
                        </View>
                        <View style={styles.usadoBadge}>
                          <Text style={styles.usadoBadgeText}>Usado</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#8a8a8a', fontWeight: '500', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 120 },

  mensaje: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 14,
  },
  mensajeOk: { backgroundColor: '#dcfce7' },
  mensajeError: { backgroundColor: '#fdecea' },
  mensajeText: { fontSize: 13, fontWeight: '700', flex: 1 },

  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: '#aaa' },

  // Cupón tipo ticket
  card: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 22, marginBottom: 14, overflow: 'hidden',
    boxShadow: '0px 4px 14px rgba(0,0,0,0.07)',
  },
  cardActive: { borderWidth: 1.5, borderColor: '#FBB03B' },
  discountSide: {
    width: 96, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 22, paddingHorizontal: 6,
  },
  discountSideActive: { backgroundColor: '#F59E0B' },
  discountText: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  discountLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: 2 },
  separator: { width: 20, alignItems: 'center', justifyContent: 'center' },
  circleTop: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: BG, position: 'absolute', top: -9,
  },
  circleBottom: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: BG, position: 'absolute', bottom: -9,
  },
  dashedLine: {
    flex: 1, borderLeftWidth: 1.5,
    borderLeftColor: '#e3e3e6', borderStyle: 'dashed',
  },
  infoSide: { flex: 1, paddingVertical: 14, paddingRight: 14, paddingLeft: 2, justifyContent: 'space-between' },
  categoriaChip: {
    alignSelf: 'flex-start', backgroundColor: '#fdecea',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8,
  },
  categoriaText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  description: { fontSize: 14, fontWeight: '800', color: INK, marginBottom: 4, lineHeight: 19, letterSpacing: -0.2 },
  min: { fontSize: 11, color: '#888', marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  expiryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  expiry: { fontSize: 11, color: '#888', fontWeight: '500' },
  activateBtn: {
    backgroundColor: PRIMARY, paddingHorizontal: 16, minWidth: 92,
    paddingVertical: 8, borderRadius: 20, alignItems: 'center',
    boxShadow: '0px 3px 8px rgba(194,24,7,0.3)',
  },
  activatedBtn: { backgroundColor: '#e8f5ed', boxShadow: 'none' },
  activateBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  activatedBtnText: { color: '#1B6B3A' },

  // Cupones usados
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 18, marginBottom: 12, marginLeft: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  sectionCount: {
    fontSize: 12, fontWeight: '800', color: '#888', backgroundColor: '#e8e8ec',
    paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
  },
  cardUsado: { opacity: 0.65, boxShadow: 'none' },
  discountSideUsado: { backgroundColor: '#B0B0B5' },
  categoriaChipUsado: { backgroundColor: '#eee' },
  usadoBadge: {
    backgroundColor: '#e5e5e8', paddingHorizontal: 16, minWidth: 92,
    paddingVertical: 8, borderRadius: 20, alignItems: 'center',
  },
  usadoBadgeText: { fontSize: 12, fontWeight: '800', color: '#888' },
});